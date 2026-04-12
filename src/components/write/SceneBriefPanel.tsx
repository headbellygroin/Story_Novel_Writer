import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { generateScene } from '../../services/aiService';
import { buildSceneBriefPrompt } from '../../services/workflowPrompts';

interface SceneBriefPanelProps {
  chapterId: string;
  projectId: string;
  chapterTitle: string;
  chapterSummary: string;
}

interface SceneBrief {
  id: string;
  pov_character: string;
  genre: string;
  plot_beats: string;
  scene_function: string;
  characters_in_scene: string;
  setting_details: string;
  conflict: string;
  tone_notes: string;
  symbolism: string;
  continuity_notes: string;
  other_notes: string;
}

const BRIEF_FIELDS = [
  { key: 'pov_character', label: 'POV Character' },
  { key: 'scene_function', label: 'Scene Function' },
  { key: 'plot_beats', label: 'Plot Beats' },
  { key: 'characters_in_scene', label: 'Characters in Scene' },
  { key: 'setting_details', label: 'Setting Details' },
  { key: 'conflict', label: 'Main Conflict' },
  { key: 'tone_notes', label: 'Tone & Style Notes' },
  { key: 'symbolism', label: 'Symbolism / Themes' },
  { key: 'continuity_notes', label: 'Continuity Notes' },
  { key: 'other_notes', label: 'Other Notes' },
] as const;

export default function SceneBriefPanel({ chapterId, projectId, chapterTitle, chapterSummary }: SceneBriefPanelProps) {
  const [brief, setBrief] = useState<SceneBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadBrief();
  }, [chapterId]);

  async function loadBrief() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('scene_briefs')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('project_id', projectId)
        .maybeSingle();

      setBrief(data);
    } catch (error) {
      console.error('Error loading scene brief:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateBrief() {
    setGenerating(true);
    try {
      const [settingsRes, outlineRes, charsRes, placesRes, thingsRes, techsRes, projectRes] = await Promise.all([
        supabase.from('generation_settings').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('outlines').select('synopsis').eq('project_id', projectId).limit(1),
        supabase.from('characters').select('name, role, personality, background, description, dialogue_style, personality_sliders').eq('project_id', projectId),
        supabase.from('places').select('name, type, description').eq('project_id', projectId),
        supabase.from('things').select('name, type, description').eq('project_id', projectId),
        supabase.from('technologies').select('name, type, description').eq('project_id', projectId),
        supabase.from('projects').select('genre').eq('id', projectId).maybeSingle(),
      ]);

      if (!settingsRes.data) {
        alert('Please configure AI settings first.');
        return;
      }

      const characters = (charsRes.data || [])
        .map((c: Record<string, string>) => `- ${c.name} (${c.role}): ${c.personality}\n  Background: ${c.background}${c.dialogue_style ? `\n  Dialogue: ${c.dialogue_style}` : ''}`)
        .join('\n');

      const worldbuilding = [
        ...(placesRes.data || []).map((p: Record<string, string>) => `Location - ${p.name} (${p.type}): ${p.description}`),
        ...(thingsRes.data || []).map((t: Record<string, string>) => `Object - ${t.name} (${t.type}): ${t.description}`),
        ...(techsRes.data || []).map((t: Record<string, string>) => `System - ${t.name} (${t.type}): ${t.description}`),
      ].join('\n');

      const synopsis = outlineRes.data?.[0]?.synopsis || '';
      const genre = projectRes.data?.genre || '';

      const prompt = buildSceneBriefPrompt(
        chapterTitle,
        chapterSummary,
        synopsis,
        characters,
        worldbuilding,
        '',
        genre,
      );

      const result = await generateScene({
        sceneDescription: prompt,
        context: {},
        settings: {
          ...settingsRes.data,
          style_rules: (settingsRes.data.style_rules as Record<string, boolean>) || undefined,
        },
      });

      const payload = {
        chapter_id: chapterId,
        project_id: projectId,
        plot_beats: result,
        genre,
        updated_at: new Date().toISOString(),
      };

      if (brief) {
        await supabase.from('scene_briefs').update(payload).eq('id', brief.id);
        setBrief({ ...brief, ...payload });
      } else {
        const { data } = await supabase
          .from('scene_briefs')
          .insert([payload])
          .select()
          .single();
        if (data) setBrief(data);
      }
    } catch (error) {
      console.error('Error generating scene brief:', error);
      alert('Failed to generate scene brief. Check AI settings.');
    } finally {
      setGenerating(false);
    }
  }

  async function saveField(field: string, value: string) {
    if (!brief) return;
    try {
      await supabase
        .from('scene_briefs')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', brief.id);
      setBrief({ ...brief, [field]: value });
    } catch (error) {
      console.error('Error saving field:', error);
    }
    setEditingField(null);
  }

  if (loading) return <div className="p-3 text-xs text-slate-400">Loading brief...</div>;

  const filledFields = brief
    ? BRIEF_FIELDS.filter(f => (brief as unknown as Record<string, string>)[f.key]?.trim()).length
    : 0;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <svg
            className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Scene Brief
          {filledFields > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
              {filledFields}/{BRIEF_FIELDS.length}
            </span>
          )}
        </button>
        <button
          onClick={generateBrief}
          disabled={generating}
          className="px-2 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating...' : brief ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {expanded && brief && (
        <div className="space-y-2 mt-3">
          {BRIEF_FIELDS.map(field => {
            const value = (brief as unknown as Record<string, string>)[field.key] || '';
            const isEditing = editingField === field.key;

            return (
              <div key={field.key} className="border border-slate-100 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 cursor-pointer"
                  onClick={() => {
                    if (isEditing) {
                      saveField(field.key, editValue);
                    } else {
                      setEditingField(field.key);
                      setEditValue(value);
                    }
                  }}
                >
                  <span className="text-xs font-medium text-slate-600">{field.label}</span>
                  {value && !isEditing && (
                    <span className="text-xs text-teal-600">Edit</span>
                  )}
                </div>
                {isEditing ? (
                  <div className="p-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                      autoFocus
                    />
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => saveField(field.key, editValue)}
                        className="px-2 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : value ? (
                  <div className="px-2.5 py-2 text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {value.slice(0, 300)}{value.length > 300 ? '...' : ''}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {expanded && !brief && (
        <p className="text-xs text-slate-400 mt-2">
          No scene brief yet. Click Generate to create one based on chapter outline and world data.
        </p>
      )}
    </div>
  );
}
