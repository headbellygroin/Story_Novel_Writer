import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type SceneSummary = Database['public']['Tables']['scene_summaries']['Row'];

interface Props {
  sceneId: string;
  projectId: string;
  sceneContent: string;
}

export default function SceneSummaryPanel({ sceneId, projectId, sceneContent }: Props) {
  const [summary, setSummary] = useState<SceneSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    summary: '',
    key_facts: '',
    characters_involved: '',
    emotional_arc: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [sceneId]);

  async function loadSummary() {
    const { data } = await supabase
      .from('scene_summaries')
      .select('*')
      .eq('scene_id', sceneId)
      .maybeSingle();

    setSummary(data);
    if (data) {
      setFormData({
        summary: data.summary,
        key_facts: data.key_facts.join('\n'),
        characters_involved: data.characters_involved.join(', '),
        emotional_arc: data.emotional_arc,
      });
    }
  }

  async function saveSummary() {
    setSaving(true);
    try {
      const payload = {
        scene_id: sceneId,
        project_id: projectId,
        summary: formData.summary,
        key_facts: formData.key_facts.split('\n').filter(f => f.trim()),
        characters_involved: formData.characters_involved.split(',').map(c => c.trim()).filter(Boolean),
        emotional_arc: formData.emotional_arc,
        updated_at: new Date().toISOString(),
      };

      if (summary) {
        const { error } = await supabase
          .from('scene_summaries')
          .update(payload)
          .eq('id', summary.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scene_summaries')
          .insert([payload]);
        if (error) throw error;
      }

      await loadSummary();
      setEditing(false);
    } catch (error) {
      console.error('Error saving summary:', error);
    } finally {
      setSaving(false);
    }
  }

  if (!sceneContent) {
    return (
      <div className="text-xs text-slate-400 italic p-3">
        Write or generate scene content first to add a summary.
      </div>
    );
  }

  if (!editing && !summary) {
    return (
      <div className="p-3">
        <button
          onClick={() => setEditing(true)}
          className="w-full px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
        >
          Add Scene Summary
        </button>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          Summaries replace full scene text for distant context, saving token space while keeping the AI informed.
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Summary</label>
          <textarea
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            rows={3}
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Brief recap of what happens in this scene..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Key Facts (one per line)</label>
          <textarea
            value={formData.key_facts}
            onChange={(e) => setFormData({ ...formData, key_facts: e.target.value })}
            rows={3}
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Character X reveals their secret&#10;The sword is broken&#10;Location changes to the castle"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Characters Involved (comma-separated)</label>
          <input
            type="text"
            value={formData.characters_involved}
            onChange={(e) => setFormData({ ...formData, characters_involved: e.target.value })}
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Aria, Marcus, The Elder"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Emotional Arc</label>
          <input
            type="text"
            value={formData.emotional_arc}
            onChange={(e) => setFormData({ ...formData, emotional_arc: e.target.value })}
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Tension builds to confrontation, ends in uneasy truce"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveSummary}
            disabled={saving || !formData.summary.trim()}
            className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              if (summary) {
                setFormData({
                  summary: summary.summary,
                  key_facts: summary.key_facts.join('\n'),
                  characters_involved: summary.characters_involved.join(', '),
                  emotional_arc: summary.emotional_arc,
                });
              }
            }}
            className="px-3 py-1.5 text-xs bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">Scene Summary</span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-primary-600 hover:text-primary-800"
        >
          Edit
        </button>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{summary!.summary}</p>
      {summary!.key_facts.length > 0 && (
        <div>
          <span className="text-xs font-medium text-slate-500">Key Facts:</span>
          <ul className="mt-0.5 space-y-0.5">
            {summary!.key_facts.map((fact, i) => (
              <li key={i} className="text-xs text-slate-600 pl-2 border-l-2 border-slate-200">{fact}</li>
            ))}
          </ul>
        </div>
      )}
      {summary!.characters_involved.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary!.characters_involved.map((char, i) => (
            <span key={i} className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">{char}</span>
          ))}
        </div>
      )}
      {summary!.emotional_arc && (
        <p className="text-xs text-slate-500 italic">{summary!.emotional_arc}</p>
      )}
    </div>
  );
}
