import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type StoryEvent = Database['public']['Tables']['story_events']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];
type Chapter = Database['public']['Tables']['chapters']['Row'];
type Character = Database['public']['Tables']['characters']['Row'];

interface Props {
  projectId: string;
  scenes: Scene[];
  chapters: Chapter[];
  characters: Character[];
}

const IMPORTANCE_OPTIONS = ['low', 'medium', 'high', 'critical'];

export default function StoryEvents({ projectId, scenes, chapters, characters }: Props) {
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<StoryEvent>>({
    importance: 'medium',
    affects_world: false,
  });

  useEffect(() => {
    loadEvents();
  }, [projectId]);

  async function loadEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('story_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error) setEvents(data || []);
    setLoading(false);
  }

  async function saveEvent() {
    const payload = {
      ...formData,
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('story_events').update(payload).eq('id', editingId);
      if (!error) loadEvents();
    } else {
      const { error } = await supabase.from('story_events').insert([payload]);
      if (!error) loadEvents();
    }

    resetForm();
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this story event?')) return;
    const { error } = await supabase.from('story_events').delete().eq('id', id);
    if (!error) setEvents(events.filter(e => e.id !== id));
  }

  function startEdit(event: StoryEvent) {
    setEditingId(event.id);
    setFormData(event);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ importance: 'medium', affects_world: false });
  }

  function getSceneTitle(id: string | null) {
    if (!id) return null;
    return scenes.find(s => s.id === id)?.title;
  }

  function getChapterTitle(id: string | null) {
    if (!id) return null;
    return chapters.find(c => c.id === id)?.title;
  }

  const importanceColor: Record<string, string> = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-sky-100 text-sky-700',
    high: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
  };

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Story Event
        </button>
      </div>

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Story Event</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Character discovers the truth..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="What happened and why it matters..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Importance</label>
                <select
                  value={formData.importance || 'medium'}
                  onChange={(e) => setFormData({ ...formData, importance: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {IMPORTANCE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked Scene</label>
                <select
                  value={formData.scene_id || ''}
                  onChange={(e) => setFormData({ ...formData, scene_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">None</option>
                  {scenes.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked Chapter</label>
                <select
                  value={formData.chapter_id || ''}
                  onChange={(e) => setFormData({ ...formData, chapter_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">None</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.affects_world || false}
                    onChange={(e) => setFormData({ ...formData, affects_world: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Affects world state</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Affected Characters
              </label>
              <div className="flex flex-wrap gap-2">
                {characters.map(c => {
                  const selected = (formData.affects_characters || []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const current = formData.affects_characters || [];
                        setFormData({
                          ...formData,
                          affects_characters: selected
                            ? current.filter((id: string) => id !== c.id)
                            : [...current, c.id],
                        });
                      }}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selected
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-slate-300 text-slate-600 hover:border-primary-300'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
                {characters.length === 0 && (
                  <span className="text-sm text-slate-400">No characters in this project</span>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEvent}
                disabled={!formData.title}
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
        {events.map(event => (
          <div key={event.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${importanceColor[event.importance] || importanceColor.medium}`}>
                  {event.importance}
                </span>
                {event.affects_world && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                    World Impact
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(event)} className="text-primary-600 hover:text-primary-800 text-sm">Edit</button>
                <button onClick={() => deleteEvent(event.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
              </div>
            </div>
            {event.description && (
              <p className="text-slate-600 text-sm mb-3 whitespace-pre-wrap">{event.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {getSceneTitle(event.scene_id) && <span>Scene: {getSceneTitle(event.scene_id)}</span>}
              {getChapterTitle(event.chapter_id) && <span>Chapter: {getChapterTitle(event.chapter_id)}</span>}
              {event.affects_characters && event.affects_characters.length > 0 && (
                <span>
                  Affects: {event.affects_characters.map(id => characters.find(c => c.id === id)?.name).filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-600">
          No story events tracked yet. Add events to help the AI maintain consistency.
        </div>
      )}
    </div>
  );
}
