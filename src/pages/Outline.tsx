import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import { generateScene } from '../services/aiService';
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

  // Auto-Write state
  const [autoWriteActive, setAutoWriteActive] = useState(false);
  const [autoWriteProgress, setAutoWriteProgress] = useState<{
    currentChapter: number;
    totalChapters: number;
    currentScene: number;
    totalScenes: number;
    chapterTitle: string;
    sceneTitle: string;
    completedScenes: number;
    totalAllScenes: number;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    error: string;
  }>({
    currentChapter: 0, totalChapters: 0, currentScene: 0, totalScenes: 0,
    chapterTitle: '', sceneTitle: '', completedScenes: 0, totalAllScenes: 0,
    status: 'idle', error: '',
  });
  const autoWriteAbortRef = useRef(false);
  const [showAutoWrite, setShowAutoWrite] = useState(false);

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

      console.log('[Outline] Loaded outlines:', outlinesRes.data?.length, 'for project:', currentProjectId);
      console.log('[Outline] currentOutlineId:', currentOutlineId);
      if (outlinesRes.data) {
        console.log('[Outline] Available outlines:', outlinesRes.data.map(o => ({ id: o.id, title: o.title })));
      }

      setOutlines(outlinesRes.data || []);
      setCharacters(charactersRes.data || []);
      setPlaces(placesRes.data || []);

      if (outlinesRes.data && outlinesRes.data.length > 0) {
        const ids = outlinesRes.data.map(o => o.id);
        if (!currentOutlineId || !ids.includes(currentOutlineId)) {
          setCurrentOutlineId(outlinesRes.data[0].id);
        }
      } else if (currentOutlineId) {
        setCurrentOutlineId(null);
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
      console.log('[Outline] Loaded chapters for outline', currentOutlineId, ':', data?.length);
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

  async function loadAutoWriteSettings() {
    if (!currentProjectId) return null;
    const { data } = await supabase
      .from('generation_settings')
      .select('*')
      .eq('project_id', currentProjectId)
      .maybeSingle();
    return data;
  }

  async function startAutoWrite() {
    if (!currentProjectId || !currentOutlineId) return;

    const settings = await loadAutoWriteSettings();
    if (!settings) {
      setAutoWriteProgress(p => ({ ...p, status: 'failed', error: 'No AI settings configured. Go to Settings page first.' }));
      return;
    }

    // Load all chapters for this outline
    const { data: allChapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('outline_id', currentOutlineId)
      .order('order_index', { ascending: true });

    if (!allChapters || allChapters.length === 0) {
      setAutoWriteProgress(p => ({ ...p, status: 'failed', error: 'No chapters found in this outline.' }));
      return;
    }

    // Load all scenes for all chapters
    const chapterIds = allChapters.map(c => c.id);
    const { data: allScenes } = await supabase
      .from('scenes')
      .select('*')
      .in('chapter_id', chapterIds)
      .order('order_index', { ascending: true });

    if (!allScenes || allScenes.length === 0) {
      setAutoWriteProgress(p => ({ ...p, status: 'failed', error: 'No scenes found. Create scenes in your chapters first (use the Series Wizard or add them manually on the Write page).' }));
      return;
    }

    // Load world context
    const [bibleRes, manifestoRes, charsRes] = await Promise.all([
      supabase.from('story_bible_entries').select('*').eq('project_id', currentProjectId).limit(30),
      supabase.from('franchise_manifesto').select('*').eq('project_id', currentProjectId).maybeSingle(),
      supabase.from('characters').select('*').eq('project_id', currentProjectId),
    ]);

    const worldContext = {
      bible: (bibleRes.data || []).map((e: any) => `[${e.category}] ${e.subject}: ${e.fact}`).join('\n'),
      manifesto: manifestoRes.data?.content || '',
      characters: (charsRes.data || []).map((c: any) => `${c.name}: ${c.description || ''}`).join('\n'),
    };

    // Get the outline synopsis for context
    const currentOutlineData = outlines.find(o => o.id === currentOutlineId);
    const outlineSynopsis = currentOutlineData?.synopsis || '';

    setAutoWriteActive(true);
    autoWriteAbortRef.current = false;

    const totalScenes = allScenes.length;
    setAutoWriteProgress({
      currentChapter: 0, totalChapters: allChapters.length,
      currentScene: 0, totalScenes: 0,
      chapterTitle: '', sceneTitle: '',
      completedScenes: 0, totalAllScenes: totalScenes,
      status: 'running', error: '',
    });

    let completedCount = 0;

    for (let ci = 0; ci < allChapters.length; ci++) {
      if (autoWriteAbortRef.current) break;
      const chapter = allChapters[ci];
      const chapterScenes = allScenes.filter(s => s.chapter_id === chapter.id);

      if (chapterScenes.length === 0) continue;

      // Get previous chapter content for continuity
      let previousChapterEnding = '';
      if (ci > 0) {
        const prevChapter = allChapters[ci - 1];
        const prevScenes = allScenes.filter(s => s.chapter_id === prevChapter.id);
        const lastPrevScene = prevScenes[prevScenes.length - 1];
        if (lastPrevScene?.content && lastPrevScene.content.length > 100) {
          previousChapterEnding = lastPrevScene.content.slice(-800);
        }
      }

      for (let si = 0; si < chapterScenes.length; si++) {
        if (autoWriteAbortRef.current) break;
        const scene = chapterScenes[si];

        // Skip scenes that already have substantial content
        if (scene.content && scene.content.length > 200) {
          completedCount++;
          continue;
        }

        setAutoWriteProgress(p => ({
          ...p,
          currentChapter: ci + 1,
          totalChapters: allChapters.length,
          currentScene: si + 1,
          totalScenes: chapterScenes.length,
          chapterTitle: chapter.title || `Chapter ${ci + 1}`,
          sceneTitle: scene.title || `Scene ${si + 1}`,
          completedScenes: completedCount,
        }));

        // Build prompt
        const previousSceneContent = si > 0 && chapterScenes[si - 1]?.content
          ? `\n\n=== PREVIOUS SCENE ENDING ===\n${chapterScenes[si - 1].content.slice(-600)}`
          : previousChapterEnding ? `\n\n=== PREVIOUS CHAPTER ENDING ===\n${previousChapterEnding}` : '';

        const prompt = `=== BOOK OUTLINE ===
${outlineSynopsis.slice(0, 2000)}

=== CHAPTER: ${chapter.title} ===
${chapter.summary || ''}

=== SCENE BRIEF: ${scene.title} ===
${scene.description || scene.content || 'Write the opening scene for this chapter.'}
${previousSceneContent}

=== WORLD CONTEXT ===
${worldContext.characters.slice(0, 1500)}
${worldContext.bible.slice(0, 1500)}

=== TASK ===
Write this scene as polished prose fiction. Use third-person limited POV. Write 1500-2500 words.
Include:
- Sensory detail (sight, sound, smell, texture)
- Character interiority and subtext
- Natural dialogue with distinct character voices
- Scene-level tension and pacing
- A clear opening hook and closing beat that transitions to the next scene

Do NOT include headers, scene titles, or metadata. Write only the prose.`;

        try {
          const result = await generateScene({
            sceneDescription: prompt,
            generationMode: 'scene',
            contextMode: 'full',
            worldRichness: 'balanced',
            planningMode: 'creative',
            context: {},
            settings,
          });

          if (autoWriteAbortRef.current) break;

          if (!result || result.trim().length < 100) {
            setAutoWriteProgress(p => ({
              ...p, status: 'failed',
              error: `Scene "${scene.title}" in ${chapter.title} returned insufficient output. Stopping. All prior scenes are saved.`,
            }));
            setAutoWriteActive(false);
            return;
          }

          // Save to DB
          await supabase.from('scenes').update({
            content: result,
            status: 'draft',
            updated_at: new Date().toISOString(),
          }).eq('id', scene.id);

          completedCount++;
          // Update the local allScenes reference for continuity
          scene.content = result;

        } catch (err: any) {
          setAutoWriteProgress(p => ({
            ...p, status: 'failed',
            error: `Failed at "${scene.title}" in ${chapter.title}: ${err.message}. All prior scenes are saved.`,
          }));
          setAutoWriteActive(false);
          return;
        }
      }
    }

    if (!autoWriteAbortRef.current) {
      setAutoWriteProgress(p => ({
        ...p, status: 'completed', completedScenes: completedCount,
      }));
    }
    setAutoWriteActive(false);
  }

  function stopAutoWrite() {
    autoWriteAbortRef.current = true;
    setAutoWriteProgress(p => ({ ...p, status: 'paused', error: 'Stopped by user. All completed scenes are saved.' }));
    setAutoWriteActive(false);
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAutoWrite(!showAutoWrite)}
                disabled={autoWriteActive}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {showAutoWrite ? 'Hide Auto-Write' : 'Auto-Write Book'}
              </button>
              <button
                onClick={() => setShowChapterForm(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Add Chapter
              </button>
            </div>
          </div>

          {/* Auto-Write Panel */}
          {showAutoWrite && (
            <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Auto-Write Book</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Automatically generate prose for every scene in this outline. Runs through each chapter in order, writing each scene using the outline, chapter brief, and world data as context.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-xs text-amber-800">
                  Scenes that already have content (200+ characters) will be skipped. Generation saves after each scene completes. If generation fails or is stopped, all prior scenes are preserved. You can resume later -- it will pick up from where it left off.
                </p>
              </div>

              {autoWriteProgress.status === 'idle' && (
                <button
                  onClick={startAutoWrite}
                  disabled={chapters.length === 0}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Start Writing All Scenes
                </button>
              )}

              {autoWriteProgress.status === 'running' && (
                <div className="space-y-3">
                  <div className="bg-slate-900 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm text-white font-medium">
                        Writing: {autoWriteProgress.chapterTitle} / {autoWriteProgress.sceneTitle}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      Chapter {autoWriteProgress.currentChapter}/{autoWriteProgress.totalChapters} | Scene {autoWriteProgress.currentScene}/{autoWriteProgress.totalScenes} | {autoWriteProgress.completedScenes}/{autoWriteProgress.totalAllScenes} total scenes done
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-green-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(autoWriteProgress.completedScenes / Math.max(autoWriteProgress.totalAllScenes, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={stopAutoWrite}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}

              {autoWriteProgress.status === 'completed' && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <span className="text-sm font-medium text-green-800">
                    Auto-write complete. {autoWriteProgress.completedScenes} scenes written. Visit the Write page to review and refine.
                  </span>
                </div>
              )}

              {(autoWriteProgress.status === 'failed' || autoWriteProgress.status === 'paused') && (
                <div className="space-y-3">
                  <div className={`${autoWriteProgress.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border rounded-md p-3`}>
                    <span className={`text-sm ${autoWriteProgress.status === 'failed' ? 'text-red-700' : 'text-amber-700'}`}>
                      {autoWriteProgress.error}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setAutoWriteProgress(p => ({ ...p, status: 'idle', error: '' }));
                      startAutoWrite();
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    Resume Writing
                  </button>
                </div>
              )}
            </div>
          )}

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
