import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';

type Outline = Database['public']['Tables']['outlines']['Row'];
type Chapter = Database['public']['Tables']['chapters']['Row'];
type Character = Database['public']['Tables']['characters']['Row'];
type Place = Database['public']['Tables']['places']['Row'];

export default function Outline() {
  const { currentProjectId, currentOutlineId, setCurrentOutlineId } = useStore();
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [, setLoading] = useState(true);
  const [showOutlineForm, setShowOutlineForm] = useState(false);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [outlineFormData, setOutlineFormData] = useState<Partial<Outline>>({});
  const [chapterFormData, setChapterFormData] = useState<Partial<Chapter>>({});
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      loadData();
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentOutlineId) {
      loadChapters();
    }
  }, [currentOutlineId]);

  async function loadData() {
    if (!currentProjectId) return;

    setLoading(true);
    try {
      const [outlinesRes, charactersRes, placesRes] = await Promise.all([
        supabase.from('outlines').select('*').eq('project_id', currentProjectId).order('created_at', { ascending: false }),
        supabase.from('characters').select('*').eq('project_id', currentProjectId),
        supabase.from('places').select('*').eq('project_id', currentProjectId),
      ]);

      if (outlinesRes.error) throw outlinesRes.error;
      if (charactersRes.error) throw charactersRes.error;
      if (placesRes.error) throw placesRes.error;

      setOutlines(outlinesRes.data || []);
      setCharacters(charactersRes.data || []);
      setPlaces(placesRes.data || []);

      if (outlinesRes.data && outlinesRes.data.length > 0 && !currentOutlineId) {
        setCurrentOutlineId(outlinesRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadChapters() {
    if (!currentOutlineId) return;

    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('outline_id', currentOutlineId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setChapters(data || []);
    } catch (error) {
      console.error('Error loading chapters:', error);
    }
  }

  async function createOutline() {
    if (!currentProjectId) return;

    try {
      const { data, error } = await supabase
        .from('outlines')
        .insert([{ ...outlineFormData, project_id: currentProjectId }])
        .select()
        .single();

      if (error) throw error;

      setOutlines([data, ...outlines]);
      setCurrentOutlineId(data.id);
      setShowOutlineForm(false);
      setOutlineFormData({});
    } catch (error) {
      console.error('Error creating outline:', error);
    }
  }

  async function updateOutline() {
    if (!editingOutlineId) return;

    try {
      const { error } = await supabase
        .from('outlines')
        .update({
          ...outlineFormData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingOutlineId);

      if (error) throw error;

      setOutlines(outlines.map(o => o.id === editingOutlineId ? { ...o, ...outlineFormData } as Outline : o));
      setShowOutlineForm(false);
      setEditingOutlineId(null);
      setOutlineFormData({});
    } catch (error) {
      console.error('Error updating outline:', error);
    }
  }

  async function deleteOutline(id: string) {
    if (!confirm('Delete this outline and all its chapters? This cannot be undone.')) return;

    try {
      const { error } = await supabase.from('outlines').delete().eq('id', id);

      if (error) throw error;

      const remaining = outlines.filter(o => o.id !== id);
      setOutlines(remaining);

      if (currentOutlineId === id) {
        setCurrentOutlineId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (error) {
      console.error('Error deleting outline:', error);
    }
  }

  function startEditOutline(outline: Outline) {
    setEditingOutlineId(outline.id);
    setOutlineFormData(outline);
    setShowOutlineForm(true);
  }

  async function saveChapter() {
    if (!currentProjectId || !currentOutlineId) return;

    try {
      const payload = {
        ...chapterFormData,
        project_id: currentProjectId,
        outline_id: currentOutlineId,
        updated_at: new Date().toISOString(),
      };

      if (editingChapterId) {
        const { error } = await supabase
          .from('chapters')
          .update(payload)
          .eq('id', editingChapterId);

        if (error) throw error;
      } else {
        const maxOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order_index)) : -1;
        const { error } = await supabase
          .from('chapters')
          .insert([{ ...payload, order_index: maxOrder + 1 }]);

        if (error) throw error;
      }

      loadChapters();
      setShowChapterForm(false);
      setEditingChapterId(null);
      setChapterFormData({});
    } catch (error) {
      console.error('Error saving chapter:', error);
    }
  }

  async function deleteChapter(id: string) {
    if (!confirm('Delete this chapter?')) return;

    try {
      const { error } = await supabase.from('chapters').delete().eq('id', id);

      if (error) throw error;
      setChapters(chapters.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting chapter:', error);
    }
  }

  function startEditChapter(chapter: Chapter) {
    setEditingChapterId(chapter.id);
    setChapterFormData(chapter);
    setShowChapterForm(true);
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  const currentOutline = outlines.find(o => o.id === currentOutlineId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Story Outline</h1>
        <ProjectSelector />
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Outline:
          </label>
          <select
            value={currentOutlineId || ''}
            onChange={(e) => setCurrentOutlineId(e.target.value || null)}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {outlines.length === 0 && <option value="">No outlines</option>}
            {outlines.map((outline) => (
              <option key={outline.id} value={outline.id}>
                {outline.title}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowOutlineForm(true)}
          className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          New Outline
        </button>
      </div>

      {showOutlineForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4">{editingOutlineId ? 'Edit' : 'Create'} Story Outline</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={outlineFormData.title || ''}
                onChange={(e) => setOutlineFormData({ ...outlineFormData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Main Story Outline"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Synopsis</label>
              <textarea
                value={outlineFormData.synopsis || ''}
                onChange={(e) => setOutlineFormData({ ...outlineFormData, synopsis: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Overall story synopsis..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Act Structure</label>
              <textarea
                value={outlineFormData.act_structure || ''}
                onChange={(e) => setOutlineFormData({ ...outlineFormData, act_structure: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Three-act structure notes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Themes</label>
              <textarea
                value={outlineFormData.themes || ''}
                onChange={(e) => setOutlineFormData({ ...outlineFormData, themes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Major themes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={editingOutlineId ? updateOutline : createOutline}
                disabled={!outlineFormData.title}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingOutlineId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowOutlineForm(false);
                  setEditingOutlineId(null);
                  setOutlineFormData({});
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {currentOutline && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-slate-900">{currentOutline.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => startEditOutline(currentOutline)}
                className="text-primary-600 hover:text-primary-800 text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => deleteOutline(currentOutline.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
          {currentOutline.synopsis && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Synopsis</h3>
              <p className="text-slate-600 whitespace-pre-wrap">{currentOutline.synopsis}</p>
            </div>
          )}
          {currentOutline.act_structure && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Act Structure</h3>
              <p className="text-slate-600 whitespace-pre-wrap">{currentOutline.act_structure}</p>
            </div>
          )}
          {currentOutline.themes && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Themes</h3>
              <p className="text-slate-600 whitespace-pre-wrap">{currentOutline.themes}</p>
            </div>
          )}
        </div>
      )}

      {currentOutlineId && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-900">Chapters</h2>
            <button
              onClick={() => setShowChapterForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Chapter
            </button>
          </div>

          {showChapterForm && (
            <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold mb-4">{editingChapterId ? 'Edit' : 'Add'} Chapter</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={chapterFormData.title || ''}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Chapter 1: The Beginning"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Summary</label>
                  <textarea
                    value={chapterFormData.summary || ''}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, summary: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="What happens in this chapter..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Key Events</label>
                  <textarea
                    value={chapterFormData.key_events || ''}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, key_events: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Important events in this chapter..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">POV Character</label>
                    <select
                      value={chapterFormData.pov_character_id || ''}
                      onChange={(e) => setChapterFormData({ ...chapterFormData, pov_character_id: e.target.value || null })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">None</option>
                      {characters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Setting</label>
                    <select
                      value={chapterFormData.setting_place_id || ''}
                      onChange={(e) => setChapterFormData({ ...chapterFormData, setting_place_id: e.target.value || null })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">None</option>
                      {places.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={saveChapter}
                    disabled={!chapterFormData.title}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editingChapterId ? 'Update' : 'Add'}
                  </button>
                  <button
                    onClick={() => {
                      setShowChapterForm(false);
                      setEditingChapterId(null);
                      setChapterFormData({});
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {chapters.map((chapter, idx) => (
              <div key={chapter.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-1">Chapter {idx + 1}</div>
                    <h3 className="text-lg font-semibold text-slate-900">{chapter.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditChapter(chapter)}
                      className="text-primary-600 hover:text-primary-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteChapter(chapter.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {chapter.summary && (
                  <p className="text-slate-600 text-sm mb-3 whitespace-pre-wrap">{chapter.summary}</p>
                )}
                {chapter.key_events && (
                  <div className="text-sm mb-3">
                    <span className="font-medium text-slate-700">Key Events:</span>
                    <p className="text-slate-600 mt-1 whitespace-pre-wrap">{chapter.key_events}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-slate-500">
                  {chapter.pov_character_id && (
                    <span>POV: {characters.find(c => c.id === chapter.pov_character_id)?.name}</span>
                  )}
                  {chapter.setting_place_id && (
                    <span>Setting: {places.find(p => p.id === chapter.setting_place_id)?.name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {chapters.length === 0 && !showChapterForm && (
            <div className="text-center py-12 text-slate-600">
              No chapters yet. Add your first chapter to start outlining your story!
            </div>
          )}
        </>
      )}
    </div>
  );
}
