import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import {
  DraftProfile,
  DRAFT_PROFILES,
  getOrCreateRun,
  updateRunState,
  saveSceneContent,
  generateSceneContent,
  assembleChapter,
  assembleBook,
  extractBibleEntries,
  generateChapterSummary,
  getProductionStats,
  type GenerationRunState,
  type ProductionStats,
} from '../services/novelProductionService';

type TabId = 'dashboard' | 'autowrite' | 'assembly' | 'voices' | 'bible';

export default function Production() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [run, setRun] = useState<GenerationRunState | null>(null);
  const [draftProfile, setDraftProfile] = useState<DraftProfile>('novel_draft');
  const [isWriting, setIsWriting] = useState(false);
  const [currentActivity, setCurrentActivity] = useState('');
  const abortRef = useRef(false);
  const [settings, setSettings] = useState<any>(null);

  // Assembly state
  const [chapters, setChapters] = useState<any[]>([]);
  const [assemblies, setAssemblies] = useState<any[]>([]);
  const [manuscript, setManuscript] = useState<any>(null);
  const [assembling, setAssembling] = useState<string | null>(null);

  // Voice state
  const [voices, setVoices] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);

  // Bible extraction state
  const [extractions, setExtractions] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    if (!currentProjectId) return;

    const [statsData, settingsRes, chaptersRes, assembliesRes, manuscriptRes, voicesRes, charsRes, extractionsRes] = await Promise.all([
      getProductionStats(currentProjectId),
      supabase.from('generation_settings').select('*').eq('project_id', currentProjectId).maybeSingle(),
      currentOutlineId ? supabase.from('chapters').select('*').eq('outline_id', currentOutlineId).order('order_index') : Promise.resolve({ data: [] }),
      supabase.from('chapter_assemblies').select('*').eq('project_id', currentProjectId),
      currentOutlineId ? supabase.from('book_manuscripts').select('*').eq('outline_id', currentOutlineId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('character_voices').select('*').eq('project_id', currentProjectId),
      supabase.from('characters').select('*').eq('project_id', currentProjectId),
      supabase.from('bible_extraction_queue').select('*').eq('project_id', currentProjectId).eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    ]);

    setStats(statsData);
    setSettings(settingsRes.data);
    setChapters(chaptersRes.data || []);
    setAssemblies(assembliesRes.data || []);
    setManuscript(manuscriptRes.data);
    setVoices(voicesRes.data || []);
    setCharacters(charsRes.data || []);
    setExtractions(extractionsRes.data || []);

    if (statsData.currentRun && ['running', 'paused', 'failed'].includes(statsData.currentRun.status)) {
      setRun(statsData.currentRun);
      setDraftProfile(statsData.currentRun.draftProfile);
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function startAutoWrite() {
    if (!currentProjectId || !currentOutlineId || !settings) return;

    abortRef.current = false;
    setIsWriting(true);

    try {
      const runState = await getOrCreateRun(currentProjectId, currentOutlineId, draftProfile);
      setRun(runState);
      await updateRunState(runState.id, { status: 'running', started_at: new Date().toISOString() });
      setRun(r => r ? { ...r, status: 'running' } : r);

      // Load all chapters and scenes
      const { data: allChapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('outline_id', currentOutlineId)
        .order('order_index', { ascending: true });

      if (!allChapters || allChapters.length === 0) {
        await updateRunState(runState.id, { status: 'failed', error_message: 'No chapters found.' });
        setRun(r => r ? { ...r, status: 'failed', errorMessage: 'No chapters found.' } : r);
        setIsWriting(false);
        return;
      }

      const chapterIds = allChapters.map(c => c.id);
      const { data: allScenes } = await supabase
        .from('scenes')
        .select('*')
        .in('chapter_id', chapterIds)
        .order('order_index', { ascending: true });

      if (!allScenes || allScenes.length === 0) {
        await updateRunState(runState.id, { status: 'failed', error_message: 'No scenes found. Create scenes first.' });
        setRun(r => r ? { ...r, status: 'failed', errorMessage: 'No scenes found. Create scenes first.' } : r);
        setIsWriting(false);
        return;
      }

      // Update totals
      await updateRunState(runState.id, { total_chapters: allChapters.length, total_scenes: allScenes.length });

      let completedScenes = runState.completedScenes;
      let totalWords = runState.totalWords;
      let startChapter = runState.currentChapterIndex;
      let startScene = runState.currentSceneIndex;

      for (let ci = startChapter; ci < allChapters.length; ci++) {
        if (abortRef.current) break;
        const chapter = allChapters[ci];
        const chapterScenes = allScenes.filter(s => s.chapter_id === chapter.id);

        if (chapterScenes.length === 0) continue;

        const sceneStart = ci === startChapter ? startScene : 0;

        for (let si = sceneStart; si < chapterScenes.length; si++) {
          if (abortRef.current) break;
          const scene = chapterScenes[si];

          // Skip scenes with existing content
          if (scene.content && scene.content.length > 200) {
            completedScenes++;
            totalWords += scene.content.trim().split(/\s+/).length;
            continue;
          }

          setCurrentActivity(`Chapter ${ci + 1}: ${chapter.title} / Scene ${si + 1}: ${scene.title}`);
          await updateRunState(runState.id, {
            current_chapter_index: ci,
            current_scene_index: si,
            completed_scenes: completedScenes,
            total_words: totalWords,
            status: 'running',
          });
          setRun(r => r ? {
            ...r, currentChapterIndex: ci, currentSceneIndex: si,
            completedScenes, totalWords, status: 'running',
          } : r);

          try {
            const result = await generateSceneContent(
              currentProjectId, currentOutlineId, scene, chapter.id,
              si, allChapters, allScenes, draftProfile, settings,
            );

            if (abortRef.current) break;

            if (!result || result.trim().length < 50) {
              throw new Error('Generation returned insufficient output');
            }

            // Save scene content (with retry and verification)
            await saveSceneContent(scene.id, result);

            // Update local reference for continuity
            scene.content = result;

            const sceneWords = result.trim().split(/\s+/).length;
            completedScenes++;
            totalWords += sceneWords;

            // Save progress after every scene
            await updateRunState(runState.id, {
              completed_scenes: completedScenes,
              total_words: totalWords,
              current_scene_index: si + 1,
            });

            setRun(r => r ? { ...r, completedScenes, totalWords } : r);

            // Background: extract bible entries (non-blocking)
            extractBibleEntries(currentProjectId, scene.id, result, settings).catch(() => {});

          } catch (err: any) {
            await updateRunState(runState.id, {
              status: 'failed',
              error_message: `Failed at ${chapter.title} / ${scene.title}: ${err.message}`,
              current_chapter_index: ci,
              current_scene_index: si,
            });
            setRun(r => r ? {
              ...r, status: 'failed',
              errorMessage: `Failed at ${chapter.title} / ${scene.title}: ${err.message}`,
            } : r);
            setIsWriting(false);
            setCurrentActivity('');
            return;
          }
        }

        // After all scenes in chapter: assemble chapter
        if (!abortRef.current) {
          setCurrentActivity(`Assembling: ${chapter.title}`);
          const assembled = await assembleChapter(currentProjectId, chapter.id);

          // Generate chapter summary
          if (assembled.content.length > 200) {
            const summary = await generateChapterSummary(assembled.content, settings);
            if (summary) {
              await supabase.from('chapter_assemblies')
                .update({ summary })
                .eq('chapter_id', chapter.id);
            }
          }
        }

        // Reset scene index for next chapter
        startScene = 0;
      }

      if (!abortRef.current) {
        // Assemble the full book
        setCurrentActivity('Assembling full book manuscript...');
        await assembleBook(currentProjectId, currentOutlineId);

        await updateRunState(runState.id, {
          status: 'completed',
          completed_scenes: completedScenes,
          total_words: totalWords,
          completed_at: new Date().toISOString(),
        });
        setRun(r => r ? { ...r, status: 'completed', completedScenes, totalWords } : r);
      } else {
        await updateRunState(runState.id, {
          status: 'paused',
          error_message: 'Paused by user. Resume to continue.',
        });
        setRun(r => r ? { ...r, status: 'paused', errorMessage: 'Paused by user. Resume to continue.' } : r);
      }

    } catch (err: any) {
      setRun(r => r ? { ...r, status: 'failed', errorMessage: err.message } : r);
    } finally {
      setIsWriting(false);
      setCurrentActivity('');
      loadAll();
    }
  }

  function stopAutoWrite() {
    abortRef.current = true;
  }

  async function handleAssembleChapter(chapterId: string) {
    if (!currentProjectId) return;
    setAssembling(chapterId);
    await assembleChapter(currentProjectId, chapterId);
    await loadAll();
    setAssembling(null);
  }

  async function handleAssembleBook() {
    if (!currentProjectId || !currentOutlineId) return;
    setAssembling('book');
    await assembleBook(currentProjectId, currentOutlineId);
    await loadAll();
    setAssembling(null);
  }

  async function handleApproveExtraction(id: string) {
    const extraction = extractions.find(e => e.id === id);
    if (!extraction || !currentProjectId) return;

    // Create the entity
    if (extraction.extraction_type === 'character') {
      await supabase.from('characters').insert({
        project_id: currentProjectId,
        name: extraction.name,
        description: extraction.description,
      });
    } else if (extraction.extraction_type === 'location') {
      await supabase.from('places').insert({
        project_id: currentProjectId,
        name: extraction.name,
        description: extraction.description,
      });
    } else {
      await supabase.from('story_bible_entries').insert({
        project_id: currentProjectId,
        category: extraction.extraction_type,
        subject: extraction.name,
        fact: extraction.description,
        importance: 'medium',
      });
    }

    await supabase.from('bible_extraction_queue').update({ status: 'approved' }).eq('id', id);
    setExtractions(extractions.filter(e => e.id !== id));
  }

  async function handleRejectExtraction(id: string) {
    await supabase.from('bible_extraction_queue').update({ status: 'rejected' }).eq('id', id);
    setExtractions(extractions.filter(e => e.id !== id));
  }

  async function handleResetRun() {
    if (!run) return;
    await supabase.from('generation_runs').delete().eq('id', run.id);
    setRun(null);
    loadAll();
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  const assemblyMap = new Map(assemblies.map(a => [a.chapter_id, a]));

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'autowrite', label: 'Auto-Write' },
    { id: 'assembly', label: 'Assembly' },
    { id: 'voices', label: 'Character Voices' },
    { id: 'bible', label: 'World Extractions', badge: extractions.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Production</h1>
        <ProjectSelector />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
                activeTab === tab.id
                  ? 'bg-white border border-slate-200 border-b-white text-slate-900 -mb-px'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <DashboardPanel stats={stats} run={run} />
      )}

      {/* Auto-Write Tab */}
      {activeTab === 'autowrite' && (
        <AutoWritePanel
          run={run}
          draftProfile={draftProfile}
          setDraftProfile={setDraftProfile}
          isWriting={isWriting}
          currentActivity={currentActivity}
          settings={settings}
          onStart={startAutoWrite}
          onStop={stopAutoWrite}
          onReset={handleResetRun}
        />
      )}

      {/* Assembly Tab */}
      {activeTab === 'assembly' && (
        <AssemblyPanel
          chapters={chapters}
          assemblyMap={assemblyMap}
          manuscript={manuscript}
          assembling={assembling}
          onAssembleChapter={handleAssembleChapter}
          onAssembleBook={handleAssembleBook}
        />
      )}

      {/* Voices Tab */}
      {activeTab === 'voices' && (
        <VoicesPanel
          voices={voices}
          characters={characters}
          projectId={currentProjectId}
          onReload={loadAll}
        />
      )}

      {/* Bible Extractions Tab */}
      {activeTab === 'bible' && (
        <BiblePanel
          extractions={extractions}
          onApprove={handleApproveExtraction}
          onReject={handleRejectExtraction}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function DashboardPanel({ stats, run }: { stats: ProductionStats | null; run: GenerationRunState | null }) {
  if (!stats) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Books Assembled" value={stats.booksCompleted} />
        <StatCard label="Chapters Done" value={stats.chaptersCompleted} />
        <StatCard label="Scenes Written" value={stats.scenesCompleted} />
        <StatCard label="Total Words" value={stats.totalWords.toLocaleString()} />
      </div>

      {/* Current Run Status */}
      {run && run.status !== 'idle' && (
        <div className="bg-slate-900 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            {run.status === 'running' && <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />}
            {run.status === 'paused' && <div className="w-3 h-3 bg-amber-400 rounded-full" />}
            {run.status === 'completed' && <div className="w-3 h-3 bg-green-400 rounded-full" />}
            {run.status === 'failed' && <div className="w-3 h-3 bg-red-400 rounded-full" />}
            <span className="text-lg font-semibold capitalize">{run.status}</span>
            <span className="text-sm text-slate-400 ml-auto">{DRAFT_PROFILES[run.draftProfile].label}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-slate-400">Chapters</div>
              <div className="text-xl font-bold">{run.currentChapterIndex + 1}/{run.totalChapters}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Scenes Done</div>
              <div className="text-xl font-bold">{run.completedScenes}/{run.totalScenes}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Words Written</div>
              <div className="text-xl font-bold">{run.totalWords.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Est. Remaining</div>
              <div className="text-xl font-bold">{estimateTime(run)}</div>
            </div>
          </div>

          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="bg-green-400 h-3 rounded-full transition-all duration-700"
              style={{ width: `${(run.completedScenes / Math.max(run.totalScenes, 1)) * 100}%` }}
            />
          </div>

          {run.errorMessage && (
            <div className="mt-3 text-sm text-red-300">{run.errorMessage}</div>
          )}
        </div>
      )}

      {!run && (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600 mb-2">No active generation run.</p>
          <p className="text-sm text-slate-500">Go to the Auto-Write tab to start writing your book.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function AutoWritePanel({
  run, draftProfile, setDraftProfile, isWriting, currentActivity, settings,
  onStart, onStop, onReset,
}: {
  run: GenerationRunState | null;
  draftProfile: DraftProfile;
  setDraftProfile: (p: DraftProfile) => void;
  isWriting: boolean;
  currentActivity: string;
  settings: any;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Auto-Write Book</h2>
        <p className="text-sm text-slate-600 mb-4">
          Automatically generates prose for every scene, assembles chapters, and builds the full manuscript.
          Saves after every scene. Safe to leave running for hours.
        </p>

        {/* Draft Profile Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Draft Quality</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.entries(DRAFT_PROFILES) as [DraftProfile, typeof DRAFT_PROFILES[DraftProfile]][]).map(([key, profile]) => (
              <button
                key={key}
                onClick={() => setDraftProfile(key)}
                disabled={isWriting}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  draftProfile === key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                } ${isWriting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-sm font-medium">{profile.label}</div>
                <div className="text-xs opacity-70">{profile.wordRange} words/scene</div>
              </button>
            ))}
          </div>
        </div>

        {!settings && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
            <span className="text-sm text-amber-800">No AI settings configured. Go to the Settings page to set up your model endpoint first.</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {(!run || run.status === 'idle' || run.status === 'completed') && (
            <button
              onClick={onStart}
              disabled={isWriting || !settings}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {run?.status === 'completed' ? 'Start New Run' : 'Start Writing'}
            </button>
          )}

          {(run?.status === 'paused' || run?.status === 'failed') && (
            <>
              <button
                onClick={onStart}
                disabled={isWriting || !settings}
                className="px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                Resume
              </button>
              <button
                onClick={onReset}
                disabled={isWriting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Reset Run
              </button>
            </>
          )}

          {isWriting && (
            <button
              onClick={onStop}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Pause
            </button>
          )}
        </div>

        {/* Activity Indicator */}
        {isWriting && currentActivity && (
          <div className="mt-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-slate-700 font-medium">{currentActivity}</span>
            </div>
          </div>
        )}

        {/* Run Progress */}
        {run && run.status !== 'idle' && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{run.completedScenes} / {run.totalScenes} scenes</span>
              <span>{run.totalWords.toLocaleString()} words</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  run.status === 'failed' ? 'bg-red-500' :
                  run.status === 'completed' ? 'bg-green-500' : 'bg-slate-800'
                }`}
                style={{ width: `${(run.completedScenes / Math.max(run.totalScenes, 1)) * 100}%` }}
              />
            </div>
            {run.errorMessage && run.status !== 'completed' && (
              <div className="text-xs text-red-600 mt-1">{run.errorMessage}</div>
            )}
          </div>
        )}
      </div>

      {/* Long-run info */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Long-Run Reliability</h3>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>- Saves immediately after every scene completes</li>
          <li>- Assembles each chapter automatically when all its scenes are done</li>
          <li>- Resumes from exact position after pause, failure, or browser refresh</li>
          <li>- Never repeats already-completed scenes</li>
          <li>- Safe to leave running overnight or during entire workday</li>
        </ul>
      </div>
    </div>
  );
}

function AssemblyPanel({
  chapters, assemblyMap, manuscript, assembling, onAssembleChapter, onAssembleBook,
}: {
  chapters: any[];
  assemblyMap: Map<string, any>;
  manuscript: any;
  assembling: string | null;
  onAssembleChapter: (id: string) => void;
  onAssembleBook: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Book Assembly */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Book Manuscript</h2>
            {manuscript && (
              <p className="text-sm text-slate-500">
                {manuscript.chapter_count} chapters | {manuscript.word_count.toLocaleString()} words | Status: {manuscript.status}
              </p>
            )}
          </div>
          <button
            onClick={onAssembleBook}
            disabled={assembling === 'book' || chapters.length === 0}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {assembling === 'book' ? 'Assembling...' : 'Assemble Book'}
          </button>
        </div>
        {manuscript?.content && (
          <details className="mt-3">
            <summary className="text-sm text-slate-600 cursor-pointer hover:text-slate-900">Preview manuscript</summary>
            <pre className="mt-2 p-4 bg-slate-50 rounded-lg text-xs text-slate-700 max-h-96 overflow-y-auto whitespace-pre-wrap">
              {manuscript.content.slice(0, 5000)}{manuscript.content.length > 5000 ? '\n\n[...truncated for preview...]' : ''}
            </pre>
          </details>
        )}
      </div>

      {/* Chapter Assembly List */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Chapter Assembly</h2>
        <div className="space-y-3">
          {chapters.map((chapter, idx) => {
            const assembly = assemblyMap.get(chapter.id);
            return (
              <div key={chapter.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-6">{idx + 1}.</span>
                    <span className="text-sm font-medium text-slate-900 truncate">{chapter.title}</span>
                    {assembly && (
                      <span className="text-xs text-slate-500 shrink-0">
                        {assembly.word_count.toLocaleString()} words | {assembly.scene_count} scenes
                      </span>
                    )}
                  </div>
                  {assembly?.summary && (
                    <p className="text-xs text-slate-500 mt-1 ml-8 line-clamp-2">{assembly.summary}</p>
                  )}
                </div>
                <button
                  onClick={() => onAssembleChapter(chapter.id)}
                  disabled={assembling === chapter.id}
                  className="ml-3 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0"
                >
                  {assembling === chapter.id ? '...' : assembly ? 'Re-assemble' : 'Assemble'}
                </button>
              </div>
            );
          })}
          {chapters.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">No chapters found. Select an outline with chapters.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function VoicesPanel({
  voices, characters, projectId, onReload,
}: {
  voices: any[];
  characters: any[];
  projectId: string;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  function startEdit(charId: string) {
    const existing = voices.find(v => v.character_id === charId);
    setEditing(charId);
    setForm(existing || {
      speaking_style: '',
      vocabulary: '',
      personality_traits: '',
      emotional_tendencies: '',
      relationship_dynamics: '',
      sample_dialogue: '',
    });
  }

  async function saveVoice() {
    if (!editing) return;
    const existing = voices.find(v => v.character_id === editing);

    if (existing) {
      await supabase.from('character_voices').update({
        ...form,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('character_voices').insert({
        project_id: projectId,
        character_id: editing,
        ...form,
      });
    }

    setEditing(null);
    setForm({});
    onReload();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Character Voice Profiles</h2>
        <p className="text-sm text-slate-600 mb-4">
          Define voice profiles that get injected into scene generation automatically.
          Keeps characters sounding consistent across hundreds of scenes.
        </p>

        <div className="space-y-3">
          {characters.filter(c => !c.name?.includes('Cover') && !c.name?.includes('cover')).map(char => {
            const voice = voices.find(v => v.character_id === char.id);
            return (
              <div key={char.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-slate-900">{char.name}</span>
                  {voice && (
                    <span className="ml-2 text-xs text-green-600 font-medium">Voice defined</span>
                  )}
                </div>
                <button
                  onClick={() => startEdit(char.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {voice ? 'Edit' : 'Define Voice'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Voice Profile: {characters.find(c => c.id === editing)?.name}
          </h3>
          <div className="space-y-4">
            {[
              { key: 'speaking_style', label: 'Speaking Style', placeholder: 'e.g., Clipped sentences, dry humor, occasional profanity' },
              { key: 'vocabulary', label: 'Vocabulary', placeholder: 'e.g., Nautical terms, working-class slang, avoids academic language' },
              { key: 'personality_traits', label: 'Personality Traits', placeholder: 'e.g., Guarded but loyal, impulsive when threatened' },
              { key: 'emotional_tendencies', label: 'Emotional Tendencies', placeholder: 'e.g., Deflects vulnerability with jokes, slow to anger but explosive' },
              { key: 'relationship_dynamics', label: 'Relationship Dynamics', placeholder: 'e.g., Protective of Cook, competitive with Engineer, wary of strangers' },
              { key: 'sample_dialogue', label: 'Sample Dialogue', placeholder: 'Paste 2-3 lines that capture their voice' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                <textarea
                  value={form[field.key] || ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  rows={field.key === 'sample_dialogue' ? 4 : 2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
            <div className="flex gap-3">
              <button
                onClick={saveVoice}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Save Voice
              </button>
              <button
                onClick={() => { setEditing(null); setForm({}); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BiblePanel({
  extractions, onApprove, onReject,
}: {
  extractions: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const typeColors: Record<string, string> = {
    character: 'bg-blue-100 text-blue-700',
    location: 'bg-green-100 text-green-700',
    technology: 'bg-amber-100 text-amber-700',
    organization: 'bg-teal-100 text-teal-700',
    event: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">World-Building Extractions</h2>
      <p className="text-sm text-slate-600 mb-4">
        New elements discovered during writing. Approve to add them to your Story Bible, or reject to discard.
      </p>

      {extractions.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          No pending extractions. New discoveries will appear here as scenes are generated.
        </p>
      ) : (
        <div className="space-y-3">
          {extractions.map(ext => (
            <div key={ext.id} className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[ext.extraction_type] || 'bg-slate-100 text-slate-700'}`}>
                {ext.extraction_type}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{ext.name}</div>
                <div className="text-xs text-slate-600 mt-0.5">{ext.description}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => onApprove(ext.id)}
                  className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(ext.id)}
                  className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function estimateTime(run: GenerationRunState): string {
  if (run.completedScenes === 0 || run.status !== 'running') return '--';
  const remaining = run.totalScenes - run.completedScenes;
  const avgMinutes = 2;
  const totalMinutes = remaining * avgMinutes;
  if (totalMinutes < 60) return `~${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `~${hours}h ${mins}m`;
}
