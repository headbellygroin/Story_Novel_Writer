export interface GenerationSettings {
  model_name: string;
  api_endpoint: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  style_guide: string;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  context_length?: number;
  stop_sequences?: string[];
  style_rules?: Record<string, boolean>;
}

export interface StoryEvent {
  title: string;
  description: string;
  importance: string;
}

export interface CharacterState {
  character_name: string;
  physical_state: string;
  emotional_state: string;
  knowledge: string;
}

export interface StyleAnchorData {
  label: string;
  passage: string;
  notes: string;
}

export interface StoryBibleFact {
  subject: string;
  fact: string;
  importance: string;
  category: string;
}

export interface SceneSummaryData {
  sceneTitle: string;
  summary: string;
  key_facts: string[];
}

export interface GenerateSceneRequest {
  sceneDescription: string;
  context: {
    characters?: Array<{ name: string; role: string; personality: string; background: string; image_description?: string; dialogue_style?: string; personality_sliders_text?: string }>;
    places?: Array<{ name: string; type: string; description: string; image_description?: string }>;
    things?: Array<{ name: string; type: string; description: string; image_description?: string }>;
    technologies?: Array<{ name: string; type: string; description: string; image_description?: string }>;
    previousScenes?: string;
    previousSceneSummaries?: SceneSummaryData[];
    chapterSummary?: string;
    outlineSynopsis?: string;
    storyEvents?: StoryEvent[];
    characterStates?: CharacterState[];
    referencedScenes?: Array<{ title: string; content: string; note: string }>;
    storyBibleFacts?: StoryBibleFact[];
    styleAnchors?: StyleAnchorData[];
    prohibitedWords?: string[];
  };
  settings: GenerationSettings;
}

import { getActiveRulePrompts } from '../lib/styleRules';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function truncateToTokenBudget(text: string, maxTokens: number): string {
  const estimatedChars = Math.floor(maxTokens * 3.5);
  if (text.length <= estimatedChars) return text;
  return text.slice(0, estimatedChars) + '\n[...truncated for context length]';
}

export async function generateScene(request: GenerateSceneRequest): Promise<string> {
  const { sceneDescription, context, settings } = request;

  const contextLength = settings.context_length || 4096;
  const reservedForOutput = settings.max_tokens;
  const reservedForPromptFrame = 300;
  const availableForContext = contextLength - reservedForOutput - reservedForPromptFrame;

  const contextPrompt = buildContextPrompt(context, availableForContext);

  const activeRules = settings.style_rules ? getActiveRulePrompts(settings.style_rules) : [];
  const rulesBlock = activeRules.length > 0
    ? `\n\n=== ENFORCED STYLE RULES ===\n${activeRules.join('\n\n')}\n`
    : '';

  const prohibitedBlock = context.prohibitedWords && context.prohibitedWords.length > 0
    ? `\n\n=== PROHIBITED WORDS AND PHRASES ===\nDo NOT use any of these words or phrases in the generated text:\n${context.prohibitedWords.join(', ')}\n`
    : '';

  const fullPrompt = `${settings.system_prompt}${rulesBlock}${prohibitedBlock}

${settings.style_guide ? `Writing Style Guidelines:\n${settings.style_guide}\n\n` : ''}${contextPrompt}

Scene to write:
${sceneDescription}

Write this scene with vivid detail, engaging dialogue, and strong character voice. Focus on showing rather than telling.`;

  try {
    const requestBody: Record<string, unknown> = {
      prompt: fullPrompt,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
    };

    if (settings.top_p !== undefined) requestBody.top_p = settings.top_p;
    if (settings.top_k !== undefined) requestBody.top_k = settings.top_k;
    if (settings.repetition_penalty !== undefined) requestBody.repetition_penalty = settings.repetition_penalty;
    if (settings.presence_penalty !== undefined) requestBody.presence_penalty = settings.presence_penalty;
    if (settings.frequency_penalty !== undefined) requestBody.frequency_penalty = settings.frequency_penalty;
    if (settings.stop_sequences && settings.stop_sequences.length > 0) {
      requestBody.stop = settings.stop_sequences;
    }

    const response = await fetch(settings.api_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return data.choices?.[0]?.text || data.text || data.results?.[0]?.text || 'No content generated';
  } catch (error) {
    console.error('Error generating scene:', error);
    throw error;
  }
}

interface ContextSection {
  key: string;
  content: string;
  priority: number;
}

function buildContextPrompt(context: GenerateSceneRequest['context'], tokenBudget: number): string {
  const sections: ContextSection[] = [];

  if (context.storyBibleFacts && context.storyBibleFacts.length > 0) {
    const sorted = [...context.storyBibleFacts].sort((a, b) => {
      const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (rank[b.importance] || 0) - (rank[a.importance] || 0);
    });
    const facts = sorted
      .map(f => `[${f.importance.toUpperCase()}] ${f.subject}: ${f.fact}`)
      .join('\n');
    sections.push({
      key: 'bible',
      content: `=== STORY BIBLE (CANONICAL FACTS - DO NOT CONTRADICT) ===\n${facts}`,
      priority: 11,
    });
  }

  if (context.styleAnchors && context.styleAnchors.length > 0) {
    const anchors = context.styleAnchors
      .map(a => `--- ${a.label} ---\n${a.notes ? `(${a.notes})\n` : ''}${a.passage}`)
      .join('\n\n');
    sections.push({
      key: 'style',
      content: `=== STYLE REFERENCE (MATCH THIS VOICE AND TONE) ===\n${anchors}`,
      priority: 12,
    });
  }

  if (context.outlineSynopsis) {
    sections.push({ key: 'synopsis', content: `=== STORY SYNOPSIS ===\n${context.outlineSynopsis}`, priority: 5 });
  }

  if (context.chapterSummary) {
    sections.push({ key: 'chapter', content: `=== CHAPTER SUMMARY ===\n${context.chapterSummary}`, priority: 6 });
  }

  if (context.storyEvents && context.storyEvents.length > 0) {
    const sorted = [...context.storyEvents].sort((a, b) => {
      const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (rank[b.importance] || 0) - (rank[a.importance] || 0);
    });
    const events = sorted
      .map(e => `[${e.importance.toUpperCase()}] ${e.title}: ${e.description}`)
      .join('\n');
    sections.push({ key: 'events', content: `=== IMPORTANT STORY EVENTS (FOR CONSISTENCY) ===\n${events}`, priority: 8 });
  }

  if (context.characterStates && context.characterStates.length > 0) {
    const states = context.characterStates
      .map(s => `${s.character_name}:\n  Physical: ${s.physical_state}\n  Emotional: ${s.emotional_state}\n  Knowledge: ${s.knowledge}`)
      .join('\n\n');
    sections.push({ key: 'states', content: `=== CHARACTER CURRENT STATES ===\n${states}`, priority: 7 });
  }

  if (context.characters && context.characters.length > 0) {
    const charInfo = context.characters.map(c => {
      let info = `- ${c.name} (${c.role}): ${c.personality}\n  Background: ${c.background}`;
      if (c.dialogue_style) info += `\n  Dialogue Style: ${c.dialogue_style}`;
      if (c.personality_sliders_text) info += `\n  Personality Profile:\n${c.personality_sliders_text.split('\n').map(l => `    ${l}`).join('\n')}`;
      if (c.image_description) info += `\n  Visual: ${c.image_description}`;
      return info;
    }).join('\n');
    sections.push({ key: 'characters', content: `=== CHARACTERS IN THIS SCENE ===\n${charInfo}`, priority: 4 });
  }

  if (context.places && context.places.length > 0) {
    const placeInfo = context.places.map(p => {
      let info = `- ${p.name} (${p.type}): ${p.description}`;
      if (p.image_description) info += `\n  Visual: ${p.image_description}`;
      return info;
    }).join('\n');
    sections.push({ key: 'places', content: `=== SETTING ===\n${placeInfo}`, priority: 3 });
  }

  if (context.things && context.things.length > 0) {
    const thingInfo = context.things.map(t => {
      let info = `- ${t.name} (${t.type}): ${t.description}`;
      if (t.image_description) info += `\n  Visual: ${t.image_description}`;
      return info;
    }).join('\n');
    sections.push({ key: 'things', content: `=== IMPORTANT OBJECTS ===\n${thingInfo}`, priority: 2 });
  }

  if (context.technologies && context.technologies.length > 0) {
    const techInfo = context.technologies.map(t => {
      let info = `- ${t.name} (${t.type}): ${t.description}`;
      if (t.image_description) info += `\n  Visual: ${t.image_description}`;
      return info;
    }).join('\n');
    sections.push({ key: 'tech', content: `=== TECHNOLOGY/MAGIC SYSTEMS ===\n${techInfo}`, priority: 2 });
  }

  if (context.referencedScenes && context.referencedScenes.length > 0) {
    const refs = context.referencedScenes
      .map(r => `Scene: "${r.title}"\nReference Note: ${r.note}\nContent:\n${r.content}`)
      .join('\n\n---\n\n');
    sections.push({ key: 'refs', content: `=== REFERENCED SCENES (MAINTAIN CONSISTENCY) ===\n${refs}`, priority: 9 });
  }

  if (context.previousSceneSummaries && context.previousSceneSummaries.length > 0) {
    const summaries = context.previousSceneSummaries
      .map(s => {
        let text = `"${s.sceneTitle}": ${s.summary}`;
        if (s.key_facts.length > 0) {
          text += `\n  Key facts: ${s.key_facts.join('; ')}`;
        }
        return text;
      })
      .join('\n\n');
    sections.push({
      key: 'summaries',
      content: `=== PREVIOUS SCENE SUMMARIES (COMPRESSED HISTORY) ===\n${summaries}`,
      priority: 10,
    });
  }

  if (context.previousScenes) {
    sections.push({ key: 'previous', content: `=== PREVIOUS SCENES IN THIS CHAPTER ===\n${context.previousScenes}`, priority: 10 });
  }

  sections.sort((a, b) => b.priority - a.priority);

  const result: string[] = [];
  let usedTokens = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    if (usedTokens + sectionTokens <= tokenBudget) {
      result.push(section.content);
      usedTokens += sectionTokens;
    } else {
      const remaining = tokenBudget - usedTokens;
      if (remaining > 100) {
        result.push(truncateToTokenBudget(section.content, remaining));
        break;
      }
      break;
    }
  }

  return result.join('\n\n');
}
