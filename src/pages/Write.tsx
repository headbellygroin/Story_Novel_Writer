import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import { generateScene } from '../services/aiService';
import { formatSlidersForPrompt } from '../lib/personalitySliders';
import ProjectSelector from '../components/ProjectSelector';
import SceneSummaryPanel from '../components/write/SceneSummaryPanel';
import ContextTagsPanel from '../components/write/ContextTagsPanel';
import SceneImagePanel from '../components/write/SceneImagePanel';
import SceneBriefPanel from '../components/write/SceneBriefPanel';
import EditingPassPanel from '../components/write/EditingPassPanel';

type Scene = Database['public']['Tables']['scenes']['Row'];
type Chapter = Database['public']['Tables']['chapters']['Row'];
type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];

export default function Write() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showSceneForm, setShowSceneForm] = useState(false);
  const [sceneFormData, setSceneFormData] = useState<Partial<Scene>>({});
  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'scenes' | 'context' | 'brief' | 'image'>('scenes');

  useEffect(() => {
    if (currentProjectId && currentOutlineId) {
      loadData();
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => {
    if (selectedChapterId) {
      loadScenes();
    }
  }, [selectedChapterId]);

  async function loadData() {
    if (!currentProjectId || !currentOutlineId) return;

    setLoading(true);
    try {
      const [chaptersRes, settingsRes] = await Promise.all([
        supabase.from('chapters').select('*').eq('outline_id', currentOutlineId).order('order_index', { ascending: true }),
        supabase.from('generation_settings').select('*').eq('project_id', currentProjectId).maybeSingle(),
      ]);

      if (chaptersRes.error) throw chaptersRes.error;

      setChapters(chaptersRes.data || []);
      setSettings(settingsRes.data);

      if (chaptersRes.data && chaptersRes.data.length > 0 && !selectedChapterId) {
        setSelectedChapterId(chaptersRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadScenes() {
    if (!selectedChapterId) return;

    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('chapter_id', selectedChapterId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setScenes(data || []);

      if (data && data.length > 0 && !selectedSceneId) {
        setSelectedSceneId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading scenes:', error);
    }
  }

  async function saveScene() {
    if (!currentProjectId || !selectedChapterId) return;

    try {
      const maxOrder = scenes.length > 0 ? Math.max(...scenes.map(s => s.order_index)) : -1;
      const { data, error } = await supabase
        .from('scenes')
        .insert([{
          ...sceneFormData,
          project_id: currentProjectId,
          chapter_id: selectedChapterId,
          order_index: maxOrder + 1,
        }])
        .select()
        .single();

      if (error) throw error;

      setScenes([...scenes, data]);
      setSelectedSceneId(data.id);
      setShowSceneForm(false);
      setSceneFormData({});
    } catch (error) {
      console.error('Error saving scene:', error);
    }
  }

  async function generateSceneContent(sceneId: string) {
    if (!currentProjectId || !settings) {
      alert('Please configure AI settings first in the Settings page');
      return;
    }

    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setGenerating(true);
    try {
      const [
        outline,
        chapter,
        worldData,
        eventsRes,
        statesRes,
        refsRes,
        bibleRes,
        styleRes,
        summariesRes,
        contextTagsRes,
        prohibitedWordsRes,
      ] = await Promise.all([
        currentOutlineId ? supabase.from('outlines').select('*').eq('id', currentOutlineId).maybeSingle() : null,
        supabase.from('chapters').select('*').eq('id', scene.chapter_id).maybeSingle(),
        Promise.all([
          supabase.from('characters').select('*').eq('project_id', currentProjectId),
          supabase.from('places').select('*').eq('project_id', currentProjectId),
          supabase.from('things').select('*').eq('project_id', currentProjectId),
          supabase.from('technologies').select('*').eq('project_id', currentProjectId),
        ]),
        supabase.from('story_events').select('*').eq('project_id', currentProjectId).order('created_at'),
        supabase.from('character_states').select('*').eq('project_id', currentProjectId).order('created_at', { ascending: false }),
        supabase.from('scene_references').select('*').eq('project_id', currentProjectId).eq('active', true),
        supabase.from('story_bible_entries').select('*').eq('project_id', currentProjectId),
        supabase.from('style_anchors').select('*').eq('project_id', currentProjectId).eq('active', true),
        supabase.from('scene_summaries').select('*, scenes!inner(title, order_index, chapter_id)').eq('project_id', currentProjectId),
        supabase.from('scene_context_tags').select('*').eq('scene_id', sceneId),
        supabase.from('prohibited_words').select('word').eq('project_id', currentProjectId),
      ]);

      const prohibitedWords = (prohibitedWordsRes.data || []).map((w: { word: string }) => w.word);
      const allCharacters = worldData[0].data || [];
      const allPlaces = worldData[1].data || [];
      const allThings = worldData[2].data || [];
      const allTechs = worldData[3].data || [];
      const contextTags = contextTagsRes.data || [];
      const hasContextTags = contextTags.length > 0;

      const taggedIds = new Set(contextTags.map(t => t.entity_id));

      const characters = hasContextTags
        ? allCharacters.filter((c: Record<string, string>) => taggedIds.has(c.id))
        : allCharacters;
      const places = hasContextTags
        ? allPlaces.filter((p: Record<string, string>) => taggedIds.has(p.id))
        : allPlaces;
      const things = hasContextTags
        ? allThings.filter((t: Record<string, string>) => taggedIds.has(t.id))
        : allThings;
      const technologies = hasContextTags
        ? allTechs.filter((t: Record<string, string>) => taggedIds.has(t.id))
        : allTechs;

      const storyBibleFacts = (bibleRes.data || []).map((b: Record<string, string>) => ({
        subject: b.subject,
        fact: b.fact,
        importance: b.importance,
        category: b.category,
      }));

      const taggedBibleIds = contextTags
        .filter(t => t.entity_type === 'story_bible_entries')
        .map(t => t.entity_id);
      const filteredBibleFacts = hasContextTags && taggedBibleIds.length > 0
        ? storyBibleFacts.filter((_: Record<string, string>, i: number) => {
            const entry = (bibleRes.data || [])[i];
            return taggedBibleIds.includes(entry.id);
          })
        : storyBibleFacts;

      const styleAnchors = (styleRes.data || []).map((a: Record<string, string>) => ({
        label: a.label,
        passage: a.passage,
        notes: a.notes,
      }));

      const storyEvents = (eventsRes.data || []).map((e: Record<string, string>) => ({
        title: e.title,
        description: e.description,
        importance: e.importance,
      }));

      const latestStates = new Map<string, Record<string, string>>();
      for (const s of statesRes.data || []) {
        if (!latestStates.has(s.character_id)) {
          const char = allCharacters.find((c: Record<string, string>) => c.id === s.character_id);
          latestStates.set(s.character_id, {
            character_name: char?.name || 'Unknown',
            physical_state: s.physical_state,
            emotional_state: s.emotional_state,
            knowledge: s.knowledge,
          });
        }
      }

      const allScenes = await supabase.from('scenes').select('id, title, content').eq('project_id', currentProjectId);
      const referencedScenes: Array<{ title: string; content: string; note: string }> = [];
      for (const ref of refsRes.data || []) {
        const refScene = (allScenes.data || []).find((s: Record<string, string>) => s.id === ref.scene_id);
        if (refScene) {
          referencedScenes.push({ title: refScene.title, content: refScene.content || '', note: ref.reference_note });
        }
      }

      const sceneSummaries = (summariesRes.data || [])
        .filter((s: any) => {
          const sceneData = s.scenes;
          return sceneData &&
            sceneData.chapter_id === scene.chapter_id &&
            sceneData.order_index < scene.order_index;
        })
        .map((s: any) => ({
          sceneTitle: s.scenes?.title || 'Untitled',
          summary: s.summary,
          key_facts: s.key_facts || [],
        }));

      const recentScenes = scenes
        .filter(s => s.order_index < scene.order_index && s.content)
        .slice(-2);
      const previousScenes = recentScenes.length > 0
        ? recentScenes.map(s => `${s.title}:\n${s.content}`).join('\n\n---\n\n')
        : undefined;

      const enrichedCharacters = characters.map((c: any) => ({
        ...c,
        dialogue_style: c.dialogue_style || undefined,
        personality_sliders_text: c.personality_sliders
          ? formatSlidersForPrompt(typeof c.personality_sliders === 'string' ? JSON.parse(c.personality_sliders) : c.personality_sliders)
          : undefined,
      }));

      const content = await generateScene({
        sceneDescription: scene.description,
        context: {
          outlineSynopsis: outline?.data?.synopsis,
          chapterSummary: chapter.data?.summary,
          characters: enrichedCharacters,
          places,
          things,
          technologies,
          previousScenes: previousScenes || undefined,
          previousSceneSummaries: sceneSummaries.length > 0 ? sceneSummaries : undefined,
          storyEvents: storyEvents.length > 0 ? storyEvents : undefined,
          characterStates: latestStates.size > 0 ? Array.from(latestStates.values()) as any : undefined,
          referencedScenes: referencedScenes.length > 0 ? referencedScenes : undefined,
          storyBibleFacts: filteredBibleFacts.length > 0 ? filteredBibleFacts : undefined,
          styleAnchors: styleAnchors.length > 0 ? styleAnchors : undefined,
          prohibitedWords: prohibitedWords.length > 0 ? prohibitedWords : undefined,
        },
        settings: {
          ...settings,
          style_rules: (settings.style_rules as Record<string, boolean>) || undefined,
        },
      });

      const { error } = await supabase
        .from('scenes')
        .update({
          content,
          ai_prompt: scene.description,
          context_data: {
            outline: outline?.data?.synopsis,
            chapter: chapter.data?.summary,
            characters: characters.map((c: Record<string, string>) => c.name),
            places: places.map((p: Record<string, string>) => p.name),
            storyEvents: storyEvents.length,
            characterStates: latestStates.size,
            referencedScenes: referencedScenes.length,
            storyBibleFacts: filteredBibleFacts.length,
            styleAnchors: styleAnchors.length,
            sceneSummaries: sceneSummaries.length,
            usedContextTags: hasContextTags,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', sceneId);

      if (error) throw error;

      setScenes(scenes.map(s => s.id === sceneId ? { ...s, content } : s));
    } catch (error) {
      console.error('Error generating scene:', error);
      alert('Failed to generate scene. Please check your AI settings and ensure your local model is running.');
    } finally {
      setGenerating(false);
    }
  }

  async function updateSceneContent(sceneId: string, content: string) {
    try {
      const { error } = await supabase
        .from('scenes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', sceneId);

      if (error) throw error;

      setScenes(scenes.map(s => s.id === sceneId ? { ...s, content } : s));
    } catch (error) {
      console.error('Error updating scene:', error);
    }
  }

  async function deleteScene(sceneId: string) {
    if (!confirm('Delete this scene?')) return;

    try {
      const { error } = await supabase.from('scenes').delete().eq('id', sceneId);

      if (error) throw error;
      setScenes(scenes.filter(s => s.id !== sceneId));
      if (selectedSceneId === sceneId) {
        setSelectedSceneId(scenes[0]?.id || null);
      }
    } catch (error) {
      console.error('Error deleting scene:', error);
    }
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (!currentOutlineId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create an outline first.</div>
      </div>
    );
  }

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Write</h1>
            <ProjectSelector />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chapter</label>
              <select
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(e.target.value || null)}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                {chapters.length === 0 && <option value="">No chapters</option>}
                {chapters.map((chapter, idx) => (
                  <option key={chapter.id} value={chapter.id}>
                    {idx + 1}. {chapter.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scene</label>
              <div className="flex gap-2">
                <select
                  value={selectedSceneId || ''}
                  onChange={(e) => setSelectedSceneId(e.target.value || null)}
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  {scenes.length === 0 && <option value="">No scenes</option>}
                  {scenes.map((scene, idx) => (
                    <option key={scene.id} value={scene.id}>
                      {idx + 1}. {scene.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSceneForm(true)}
                  className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm whitespace-nowrap"
                >
                  Add Scene
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSceneForm && (
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-lg font-semibold mb-3">Add New Scene</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scene Title</label>
                <input
                  type="text"
                  value={sceneFormData.title || ''}
                  onChange={(e) => setSceneFormData({ ...sceneFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Opening scene"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scene Description</label>
                <textarea
                  value={sceneFormData.description || ''}
                  onChange={(e) => setSceneFormData({ ...sceneFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Describe what happens in this scene..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveScene}
                  disabled={!sceneFormData.title}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Add Scene
                </button>
                <button
                  onClick={() => {
                    setShowSceneForm(false);
                    setSceneFormData({});
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedScene && (
        <div className="flex-1 overflow-hidden flex">
          <div className={`${showSidebar ? 'w-72' : 'w-0'} border-r border-slate-200 bg-white overflow-y-auto transition-all flex-shrink-0`}>
            {showSidebar && (
              <div>
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setSidebarTab('scenes')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'scenes'
                        ? 'border-primary-500 text-primary-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Scenes
                  </button>
                  <button
                    onClick={() => setSidebarTab('context')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'context'
                        ? 'border-primary-500 text-primary-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Context
                  </button>
                  <button
                    onClick={() => setSidebarTab('brief')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'brief'
                        ? 'border-teal-500 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Brief
                  </button>
                  <button
                    onClick={() => setSidebarTab('image')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'image'
                        ? 'border-sky-500 text-sky-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Image
                  </button>
                </div>

                {sidebarTab === 'scenes' && (
                  <div className="p-3">
                    <h3 className="font-semibold text-slate-900 text-sm mb-2">Scenes</h3>
                    <div className="space-y-2">
                      {scenes.map((scene, idx) => (
                        <div
                          key={scene.id}
                          onClick={() => setSelectedSceneId(scene.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedSceneId === scene.id
                              ? 'bg-primary-50 border-2 border-primary-500'
                              : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs text-slate-500 mb-1">Scene {idx + 1}</div>
                          <div className="text-sm font-medium text-slate-900">{scene.title}</div>
                          {scene.content && (
                            <div className="text-xs text-green-600 mt-1">Written</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sidebarTab === 'context' && selectedScene && (
                  <div className="divide-y divide-slate-200">
                    <SceneSummaryPanel
                      sceneId={selectedScene.id}
                      projectId={currentProjectId}
                      sceneContent={selectedScene.content}
                    />
                    <ContextTagsPanel
                      sceneId={selectedScene.id}
                      projectId={currentProjectId}
                    />
                  </div>
                )}

                {sidebarTab === 'brief' && selectedScene && selectedChapterId && (
                  <div className="divide-y divide-slate-200">
                    <SceneBriefPanel
                      chapterId={selectedChapterId}
                      projectId={currentProjectId}
                      chapterTitle={chapters.find(c => c.id === selectedChapterId)?.title || ''}
                      chapterSummary={chapters.find(c => c.id === selectedChapterId)?.summary || ''}
                    />
                    <EditingPassPanel
                      sceneId={selectedScene.id}
                      projectId={currentProjectId}
                      sceneContent={selectedScene.content}
                      chapterTitle={chapters.find(c => c.id === selectedChapterId)?.title || ''}
                      onContentUpdate={(content) => {
                        updateSceneContent(selectedScene.id, content);
                      }}
                    />
                  </div>
                )}

                {sidebarTab === 'image' && selectedScene && settings && (
                  <SceneImagePanel
                    scene={selectedScene}
                    settings={settings}
                    projectId={currentProjectId}
                    onSceneUpdate={(updated) => {
                      setScenes(scenes.map(s => s.id === updated.id ? updated : s));
                    }}
                  />
                )}

                {sidebarTab === 'image' && selectedScene && !settings && (
                  <div className="p-4">
                    <p className="text-xs text-slate-500">
                      Please configure AI settings first in the Settings page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-slate-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                    title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedScene.title}</h2>
                    {selectedScene.description && (
                      <p className="text-sm text-slate-600 mt-1">{selectedScene.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => generateSceneContent(selectedScene.id)}
                    disabled={generating || !settings}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {generating ? 'Generating...' : 'Generate with AI'}
                  </button>
                  <button
                    onClick={() => deleteScene(selectedScene.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedScene.generated_image_url && (
                <div className="mb-4 relative group">
                  <img
                    src={selectedScene.generated_image_url}
                    alt={`Scene: ${selectedScene.title}`}
                    className="w-full max-h-64 object-cover rounded-lg border border-slate-200 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setSidebarTab('image')}
                      className="px-2 py-1 bg-black/60 text-white text-xs rounded backdrop-blur-sm hover:bg-black/80 transition-colors"
                    >
                      Edit in Image tab
                    </button>
                  </div>
                </div>
              )}
              <textarea
                value={selectedScene.content}
                onChange={(e) => updateSceneContent(selectedScene.id, e.target.value)}
                className="w-full h-full p-4 border-none resize-none focus:outline-none focus:ring-0 text-slate-900 leading-relaxed"
                placeholder="Scene content will appear here. Click 'Generate with AI' to create content, or start typing..."
                style={{ minHeight: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {!selectedScene && scenes.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          Add a scene to start writing
        </div>
      )}
    </div>
  );
}
