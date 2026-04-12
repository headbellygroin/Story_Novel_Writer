import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type SceneReference = Database['public']['Tables']['scene_references']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];

interface Props {
  projectId: string;
  scenes: Scene[];
}

const REFERENCE_TYPES = ['foreshadowing', 'callback', 'continuity', 'character_arc', 'world_building', 'plot_thread'];

export default function SceneReferences({ projectId, scenes }: Props) {
  const [references, setReferences] = useState<SceneReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SceneReference>>({ active: true, reference_type: 'continuity' });

  useEffect(() => {
    loadReferences();
  }, [projectId]);

  async function loadReferences() {
    setLoading(true);
    const { data, error } = await supabase
      .from('scene_references')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error) setReferences(data || []);
    setLoading(false);
  }

  async function saveReference() {
    const payload = {
      ...formData,
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('scene_references').update(payload).eq('id', editingId);
      if (!error) loadReferences();
    } else {
      const { error } = await supabase.from('scene_references').insert([payload]);
      if (!error) loadReferences();
    }

    resetForm();
  }

  async function deleteReference(id: string) {
    if (!confirm('Remove this scene reference?')) return;
    const { error } = await supabase.from('scene_references').delete().eq('id', id);
    if (!error) setReferences(references.filter(r => r.id !== id));
  }

  async function toggleActive(ref: SceneReference) {
    const { error } = await supabase
      .from('scene_references')
      .update({ active: !ref.active })
      .eq('id', ref.id);

    if (!error) {
      setReferences(references.map(r => r.id === ref.id ? { ...r, active: !r.active } : r));
    }
  }

  function startEdit(ref: SceneReference) {
    setEditingId(ref.id);
    setFormData(ref);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ active: true, reference_type: 'continuity' });
  }

  const typeColor: Record<string, string> = {
    foreshadowing: 'bg-amber-100 text-amber-700',
    callback: 'bg-sky-100 text-sky-700',
    continuity: 'bg-green-100 text-green-700',
    character_arc: 'bg-rose-100 text-rose-700',
    world_building: 'bg-teal-100 text-teal-700',
    plot_thread: 'bg-orange-100 text-orange-700',
  };

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Scene Reference
        </button>
        <p className="text-xs text-slate-500">
          Active references are included in AI context during generation
        </p>
      </div>

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Scene Reference</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scene</label>
                <select
                  value={formData.scene_id || ''}
                  onChange={(e) => setFormData({ ...formData, scene_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select scene...</option>
                  {scenes.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference Type</label>
                <select
                  value={formData.reference_type || 'continuity'}
                  onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {REFERENCE_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference Note</label>
              <textarea
                value={formData.reference_note || ''}
                onChange={(e) => setFormData({ ...formData, reference_note: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Why this scene matters for future continuity..."
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active !== false}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-slate-700">Active (include in AI context)</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveReference}
                disabled={!formData.scene_id}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {editingId ? 'Update' : 'Add'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {references.map(ref => {
          const scene = scenes.find(s => s.id === ref.scene_id);
          return (
            <div
              key={ref.id}
              className={`bg-white rounded-lg shadow-sm border p-5 transition-opacity ${
                ref.active ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">{scene?.title || 'Unknown scene'}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColor[ref.reference_type] || typeColor.continuity}`}>
                    {ref.reference_type.replace('_', ' ')}
                  </span>
                  {!ref.active && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(ref)}
                    className="text-sm text-slate-600 hover:text-slate-800"
                  >
                    {ref.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => startEdit(ref)} className="text-primary-600 hover:text-primary-800 text-sm">Edit</button>
                  <button onClick={() => deleteReference(ref.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                </div>
              </div>
              {ref.reference_note && (
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{ref.reference_note}</p>
              )}
            </div>
          );
        })}
      </div>

      {references.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-600">
          No scene references yet. Mark important scenes so the AI can reference them for consistency.
        </div>
      )}
    </div>
  );
}
