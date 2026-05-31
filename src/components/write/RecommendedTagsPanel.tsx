import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TagRecommendation } from '../../services/contextRecommendationService';

interface Props {
  recommendations: TagRecommendation[];
  chapterId: string;
  projectId: string;
  onAccepted: () => void;
  onDismiss: () => void;
}

const typeColors: Record<string, string> = {
  characters: 'bg-sky-50 text-sky-700 border-sky-200',
  places: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  things: 'bg-amber-50 text-amber-700 border-amber-200',
  technologies: 'bg-rose-50 text-rose-700 border-rose-200',
  story_bible_entries: 'bg-slate-50 text-slate-700 border-slate-200',
};

const typeLabels: Record<string, string> = {
  characters: 'Character',
  places: 'Place',
  things: 'Thing',
  technologies: 'Technology',
  story_bible_entries: 'Story Bible',
};

export default function RecommendedTagsPanel({ recommendations, chapterId, projectId, onAccepted, onDismiss }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(recommendations.map(r => r.entity.id)));
  const [saving, setSaving] = useState(false);

  function toggleEntity(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(recommendations.map(r => r.entity.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function acceptSelected() {
    setSaving(true);
    try {
      const toInsert = recommendations
        .filter(r => selected.has(r.entity.id))
        .map(r => ({
          chapter_id: chapterId,
          project_id: projectId,
          entity_type: r.entity.type,
          entity_id: r.entity.id,
          entity_name: r.entity.name,
        }));

      if (toInsert.length > 0) {
        // Remove existing chapter tags first to avoid duplicates
        await supabase
          .from('chapter_context_tags')
          .delete()
          .eq('chapter_id', chapterId);

        await supabase
          .from('chapter_context_tags')
          .insert(toInsert);
      }

      onAccepted();
    } catch (error) {
      console.error('Error saving recommended tags:', error);
    } finally {
      setSaving(false);
    }
  }

  const grouped = recommendations.reduce((acc, r) => {
    if (!acc[r.entity.type]) acc[r.entity.type] = [];
    acc[r.entity.type].push(r);
    return acc;
  }, {} as Record<string, TagRecommendation[]>);

  return (
    <div className="border border-teal-200 bg-teal-50/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-teal-800">Recommended Context Tags</h4>
        <button
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>

      <p className="text-xs text-slate-600 mb-3">
        Based on the Design Brief, these entities are relevant to this chapter.
        Deselect any you want to exclude.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={selectAll}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium"
        >
          Select All
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={selectNone}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium"
        >
          Select None
        </button>
        <span className="text-xs text-slate-400 ml-auto">
          {selected.size} / {recommendations.length}
        </span>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {Object.entries(grouped).map(([type, recs]) => (
          <div key={type}>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              {typeLabels[type] || type}
            </div>
            <div className="space-y-1">
              {recs.map(rec => (
                <label
                  key={rec.entity.id}
                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    selected.has(rec.entity.id)
                      ? typeColors[type] || 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-100 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(rec.entity.id)}
                    onChange={() => toggleEntity(rec.entity.id)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium block">{rec.entity.name}</span>
                    <span className="text-xs text-slate-500 block truncate">{rec.reason}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={acceptSelected}
          disabled={saving || selected.size === 0}
          className="flex-1 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : `Accept ${selected.size} Tags`}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
