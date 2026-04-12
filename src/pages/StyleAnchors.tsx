import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';

type StyleAnchor = Database['public']['Tables']['style_anchors']['Row'];

export default function StyleAnchors() {
  const { currentProjectId } = useStore();
  const [anchors, setAnchors] = useState<StyleAnchor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    passage: '',
    notes: '',
    active: true,
  });

  useEffect(() => {
    if (currentProjectId) loadAnchors();
  }, [currentProjectId]);

  async function loadAnchors() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('style_anchors')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnchors(data || []);
    } catch (error) {
      console.error('Error loading style anchors:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnchor() {
    if (!currentProjectId) return;

    try {
      const payload = {
        project_id: currentProjectId,
        label: formData.label,
        passage: formData.passage,
        notes: formData.notes,
        active: formData.active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('style_anchors').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('style_anchors').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      loadAnchors();
    } catch (error) {
      console.error('Error saving style anchor:', error);
    }
  }

  async function toggleActive(anchor: StyleAnchor) {
    const { error } = await supabase
      .from('style_anchors')
      .update({ active: !anchor.active, updated_at: new Date().toISOString() })
      .eq('id', anchor.id);

    if (!error) {
      setAnchors(anchors.map(a => a.id === anchor.id ? { ...a, active: !a.active } : a));
    }
  }

  async function deleteAnchor(id: string) {
    if (!confirm('Delete this style anchor?')) return;
    const { error } = await supabase.from('style_anchors').delete().eq('id', id);
    if (!error) setAnchors(anchors.filter(a => a.id !== id));
  }

  function startEdit(anchor: StyleAnchor) {
    setEditingId(anchor.id);
    setFormData({
      label: anchor.label,
      passage: anchor.passage,
      notes: anchor.notes,
      active: anchor.active,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ label: '', passage: '', notes: '', active: true });
  }

  const activeCount = anchors.filter(a => a.active).length;

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Style Anchors</h1>
          <p className="text-sm text-slate-500 mt-1">
            Reference passages that show the AI your desired writing voice. Active anchors are included in every generation prompt.
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {activeCount} active anchor{activeCount !== 1 ? 's' : ''} of {anchors.length} total
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          Add Style Anchor
        </button>
      </div>

      {activeCount > 3 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            Having more than 2-3 active anchors uses a lot of context space. Consider deactivating some to leave room for other context.
          </p>
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Style Anchor</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="e.g., 'Dialogue Example', 'Action Sequence Pacing', 'Internal Monologue'"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference Passage</label>
              <textarea
                value={formData.passage}
                onChange={(e) => setFormData({ ...formData, passage: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono leading-relaxed"
                placeholder="Paste a writing sample that exemplifies the style you want the AI to match..."
              />
              <p className="text-xs text-slate-500 mt-1">
                This can be from your own writing, a published author you want to emulate, or a passage the AI generated that you particularly liked.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="What makes this passage a good example? (e.g., 'tight pacing, no adverbs, short punchy sentences')"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anchor-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="anchor-active" className="text-sm text-slate-700">
                Active (include in AI prompts)
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveAnchor}
                disabled={!formData.label.trim() || !formData.passage.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
              >
                {editingId ? 'Update' : 'Add Anchor'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-600">Loading...</div>
      ) : anchors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-2">No style anchors yet.</p>
          <p className="text-sm text-slate-400">
            Add a passage of writing that represents the voice and style you want the AI to match.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {anchors.map(anchor => (
            <div
              key={anchor.id}
              className={`bg-white rounded-lg border p-5 transition-all ${
                anchor.active
                  ? 'border-primary-200 shadow-sm'
                  : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{anchor.label}</h3>
                  {anchor.active ? (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">Inactive</span>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(anchor)}
                    className={`text-sm ${anchor.active ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}
                  >
                    {anchor.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => startEdit(anchor)} className="text-primary-600 hover:text-primary-800 text-sm">
                    Edit
                  </button>
                  <button onClick={() => deleteAnchor(anchor.id)} className="text-red-600 hover:text-red-800 text-sm">
                    Delete
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-md p-3 mb-2">
                <p className="text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap line-clamp-6">
                  {anchor.passage}
                </p>
              </div>
              {anchor.notes && (
                <p className="text-xs text-slate-500 italic">{anchor.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
