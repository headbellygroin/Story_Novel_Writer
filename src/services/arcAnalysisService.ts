import { supabase } from '../lib/supabase';
import { PERSONALITY_SLIDERS } from '../lib/personalitySliders';
import { Database } from '../lib/database.types';

type Character = Database['public']['Tables']['characters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];
type ArcEvent = Database['public']['Tables']['character_arc_events']['Row'];

export interface SliderAdjustment {
  slider_id: string;
  delta: number;
  reasoning: string;
}

export interface ArcAnalysisResult {
  character_id: string;
  character_name: string;
  adjustments: SliderAdjustment[];
}

const ANALYSIS_PROMPT = `You are analyzing a scene to detect personality shifts in characters.

Given the scene content and the character's current personality slider positions, identify any meaningful shifts that occurred DUE TO EVENTS IN THIS SCENE.

Available sliders:
{{SLIDERS}}

Current character positions:
{{CHARACTER_STATE}}

Scene content:
{{SCENE_CONTENT}}

Instructions:
- Only flag adjustments when a scene event clearly warrants a personality shift
- Use small deltas (-2 to +2) for most events; reserve larger shifts (-3 to -5, +3 to +5) for traumatic/transformative moments
- Delta is applied to the current value (positive = toward positive pole, negative = toward negative pole)
- Provide brief but specific reasoning referencing what happened in the scene
- If no meaningful shifts occurred for this character, return an empty array

Respond with ONLY a JSON array (no markdown, no explanation):
[{"slider_id": "stress_calm", "delta": -2, "reasoning": "Witnessed partner's betrayal, shattering his sense of security"}]

If no shifts: []`;

function buildSliderList(): string {
  return PERSONALITY_SLIDERS.map(s => `- ${s.id}: ${s.negativePole} <-> ${s.positivePole}`).join('\n');
}

function buildCharacterState(character: Character): string {
  const sliders = typeof character.personality_sliders === 'string'
    ? JSON.parse(character.personality_sliders)
    : character.personality_sliders;

  if (!sliders || Object.keys(sliders).length === 0) {
    return `${character.name}: No baseline sliders set`;
  }

  const lines = PERSONALITY_SLIDERS.map(s => {
    const val = sliders[s.id];
    if (val === undefined) return null;
    return `  ${s.label}: ${val}`;
  }).filter(Boolean);

  return `${character.name}:\n${lines.join('\n')}`;
}

export async function analyzeSceneForArcShifts(
  scene: Scene,
  characters: Character[],
  settings: { api_endpoint: string; model_name: string; temperature: number; max_tokens: number },
): Promise<ArcAnalysisResult[]> {
  if (!scene.content || scene.content.trim().length < 100) return [];

  const results: ArcAnalysisResult[] = [];
  const sliderList = buildSliderList();

  for (const character of characters) {
    const characterState = buildCharacterState(character);
    const prompt = ANALYSIS_PROMPT
      .replace('{{SLIDERS}}', sliderList)
      .replace('{{CHARACTER_STATE}}', characterState)
      .replace('{{SCENE_CONTENT}}', scene.content.slice(0, 6000));

    try {
      const isChatEndpoint = settings.api_endpoint.includes('/chat/completions');
      const baseBody: Record<string, unknown> = {
        temperature: 0.3,
        max_tokens: 500,
      };
      if (settings.model_name) baseBody.model = settings.model_name;

      const requestBody: Record<string, unknown> = isChatEndpoint
        ? { ...baseBody, messages: [{ role: 'user', content: prompt }] }
        : { ...baseBody, prompt };

      const response = await fetch(settings.api_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, stream: false }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content
        || data.choices?.[0]?.text
        || data.text
        || '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const adjustments: SliderAdjustment[] = JSON.parse(jsonMatch[0]);
      if (adjustments.length > 0) {
        results.push({
          character_id: character.id,
          character_name: character.name,
          adjustments,
        });
      }
    } catch {
      // skip characters where analysis fails
    }
  }

  return results;
}

export async function saveArcEvents(
  projectId: string,
  sceneId: string,
  results: ArcAnalysisResult[],
): Promise<void> {
  const rows = results.flatMap(r =>
    r.adjustments.map(a => ({
      project_id: projectId,
      character_id: r.character_id,
      scene_id: sceneId,
      slider_id: a.slider_id,
      delta: a.delta,
      reasoning: a.reasoning,
      status: 'proposed',
    }))
  );

  if (rows.length === 0) return;
  await supabase.from('character_arc_events').insert(rows);
}

export async function getArcEventsForCharacter(
  projectId: string,
  characterId: string,
): Promise<ArcEvent[]> {
  const { data } = await supabase
    .from('character_arc_events')
    .select('*')
    .eq('project_id', projectId)
    .eq('character_id', characterId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function getAcceptedArcEventsForCharacter(
  projectId: string,
  characterId: string,
): Promise<ArcEvent[]> {
  const { data } = await supabase
    .from('character_arc_events')
    .select('*')
    .eq('project_id', projectId)
    .eq('character_id', characterId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true });
  return data || [];
}

export function computeEvolvedSliders(
  baselineSliders: Record<string, number>,
  acceptedEvents: ArcEvent[],
): Record<string, number> {
  const evolved = { ...baselineSliders };
  for (const event of acceptedEvents) {
    if (evolved[event.slider_id] !== undefined) {
      evolved[event.slider_id] = Math.max(-10, Math.min(10, evolved[event.slider_id] + event.delta));
    }
  }
  return evolved;
}

export async function updateArcEventStatus(
  id: string,
  status: 'accepted' | 'rejected',
): Promise<void> {
  await supabase
    .from('character_arc_events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
}
