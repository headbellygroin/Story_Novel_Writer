import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import {
  SeriesPlan,
  ChapterBrief,
  SceneBlueprint,
  PipelineState,
  PipelineLevel,
  PipelineMode,
  PipelineProgress,
  getOrCreatePipelineState,
  updatePipelineState,
  deletePipelineState,
  runLevel1SeriesArchitect,
  runLevel2BookArchitect,
  saveLevel2Chapters,
  runLevel3ChapterBrief,
  runLevel4SceneBlueprints,
  runLevel5SceneWriter,
  runLevel6Assembly,
  deleteSeriesPlans,
  deleteChapterBriefs,
  deleteSceneBlueprints,
} from '../services/seriesPipelineService';
import { extractCharacterStatesFromBook } from '../services/characterStateService';

type LevelStatus = 'pending' | 'running' | 'complete' | 'stale';

interface LevelConfig {
  level: PipelineLevel;
  title: string;
  description: string;
  statusKey: keyof Pick<PipelineState, 'level1_status' | 'level2_status' | 'level3_status' | 'level4_status' | 'level5_status' | 'level6_status'>;
}

const LEVELS: LevelConfig[] = [
  { level: 1, title: 'Series Architect', description: 'Full series roadmap across all books', statusKey: 'level1_status' },
  { level: 2, title: 'Book Architect', description: 'Chapter outlines per book (sequential)', statusKey: 'level2_status' },
  { level: 3, title: 'Chapter Architect', description: 'Design briefs for every chapter', statusKey: 'level3_status' },
  { level: 4, title: 'Scene Architect', description: 'Scene blueprints from chapter briefs', statusKey: 'level4_status' },
  { level: 5, title: 'Scene Writer', description: 'Prose generation from blueprints', statusKey: 'level5_status' },
  { level: 6, title: 'Assembly', description: 'Compile chapters and book manuscripts', statusKey: 'level6_status' },
];

export default function SeriesPipeline() {
  const { currentProjectId } = useStore();
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [seriesPlans, setSeriesPlans] = useState<SeriesPlan[]>([]);
  const [mode, setMode] = useState<PipelineMode>('guided');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [expandedLevel, setExpandedLevel] = useState<PipelineLevel | null>(null);

  // Level 1 inputs
  const [bookCount, setBookCount] = useState(7);
  const [seriesPremise, setSeriesPremise] = useState('');
  const [genre, setGenre] = useState('');
  const [endingState, setEndingState] = useState('');

  // Level 2 inputs
  const [chapterCount, setChapterCount] = useState(12);
  const [currentBookForL2, setCurrentBookForL2] = useState(1);

  // Chapter briefs state
  const [chapterBriefs, setChapterBriefs] = useState<ChapterBrief[]>([]);
  const [sceneBlueprints, setSceneBlueprints] = useState<SceneBlueprint[]>([]);
  const [characterStateCounts, setCharacterStateCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (currentProjectId) {
      loadPipelineData();
    }
  }, [currentProjectId]);

  async function loadPipelineData() {
    if (!currentProjectId) return;

    const [plansRes, briefsRes, blueprintsRes, stateRes, charStatesRes] = await Promise.all([
      supabase.from('series_plans').select('*').eq('project_id', currentProjectId).order('book_number'),
      supabase.from('chapter_briefs').select('*').eq('project_id', currentProjectId).order('book_number'),
      supabase.from('scene_blueprints').select('*').eq('project_id', currentProjectId).order('order_index'),
      supabase.from('pipeline_state').select('*').eq('project_id', currentProjectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('character_states').select('book_number').eq('project_id', currentProjectId).eq('extraction_source', 'pipeline'),
    ]);

    setSeriesPlans(plansRes.data || []);
    setChapterBriefs(briefsRes.data || []);
    setSceneBlueprints(blueprintsRes.data || []);
    if (stateRes.data) setPipelineState(stateRes.data as PipelineState);

    const counts: Record<number, number> = {};
    for (const row of (charStatesRes.data || [])) {
      if (row.book_number != null) {
        counts[row.book_number] = (counts[row.book_number] || 0) + 1;
      }
    }
    setCharacterStateCounts(counts);
  }

  function addLog(msg: string) {
    setLog(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  function handleProgress(p: PipelineProgress) {
    setProgress(p);
    addLog(p.message);
  }

  // ------ LEVEL 1 ------

  async function executeLevel1() {
    if (!currentProjectId) return;
    setIsRunning(true);
    addLog(`Starting Level 1: Series Architect (${bookCount} books)...`);

    try {
      const state = await getOrCreatePipelineState(currentProjectId, mode);
      await updatePipelineState(state.id, { level1_status: 'running', is_running: true, current_level: 1, started_at: new Date().toISOString() });

      const plans = await runLevel1SeriesArchitect(
        currentProjectId,
        bookCount,
        seriesPremise,
        genre,
        endingState,
        handleProgress,
      );

      setSeriesPlans(plans);
      await updatePipelineState(state.id, { level1_status: 'complete', is_running: false });
      setPipelineState({ ...state, level1_status: 'complete' as LevelStatus } as PipelineState);
      addLog(`Level 1 complete: ${plans.length} book plans generated.`);
    } catch (err: any) {
      addLog(`Level 1 FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ LEVEL 2 ------

  async function executeLevel2(bookNum: number) {
    if (!currentProjectId) return;
    if (seriesPlans.length === 0) {
      addLog('Cannot run Level 2: No series plans exist. Run Level 1 first.');
      return;
    }

    setIsRunning(true);
    addLog(`Starting Level 2: Book Architect for Book ${bookNum}...`);

    try {
      const state = await getOrCreatePipelineState(currentProjectId, mode);
      await updatePipelineState(state.id, { level2_status: 'running', is_running: true, current_level: 2, current_book: bookNum });

      const result = await runLevel2BookArchitect(
        currentProjectId,
        bookNum,
        seriesPlans,
        chapterCount,
        handleProgress,
      );

      // Create outline for this book
      const plan = seriesPlans.find(p => p.book_number === bookNum);
      const { data: outline } = await supabase
        .from('outlines')
        .insert({
          project_id: currentProjectId,
          title: plan?.title || `Book ${bookNum}`,
          synopsis: plan?.high_level_outline || '',
        })
        .select()
        .single();

      if (outline) {
        // Load characters and places for linking
        const [charsRes, placesRes] = await Promise.all([
          supabase.from('characters').select('id, name').eq('project_id', currentProjectId),
          supabase.from('places').select('id, name').eq('project_id', currentProjectId),
        ]);

        await saveLevel2Chapters(
          currentProjectId,
          outline.id,
          bookNum,
          result,
          charsRes.data || [],
          placesRes.data || [],
        );

        addLog(`Level 2 complete for Book ${bookNum}: Outline "${outline.title}" created with chapters.`);
      }

      // Check if all books are done
      const allBooksOutlined = bookNum >= seriesPlans.length;
      if (allBooksOutlined) {
        await updatePipelineState(state.id, { level2_status: 'complete', is_running: false });
      } else {
        await updatePipelineState(state.id, { is_running: false, current_book: bookNum });
      }

      await loadPipelineData();
    } catch (err: any) {
      addLog(`Level 2 FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ LEVEL 3 ------

  async function executeLevel3ForBook(bookNum: number) {
    if (!currentProjectId) return;
    setIsRunning(true);
    addLog(`Starting Level 3: Chapter Briefs for Book ${bookNum}...`);

    try {
      const plan = seriesPlans.find(p => p.book_number === bookNum);
      if (!plan?.outline_id) {
        addLog(`Book ${bookNum} has no outline. Run Level 2 first.`);
        return;
      }

      const { data: chapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('outline_id', plan.outline_id)
        .order('order_index', { ascending: true });

      if (!chapters || chapters.length === 0) {
        addLog(`No chapters found for Book ${bookNum}.`);
        return;
      }

      const state = await getOrCreatePipelineState(currentProjectId, mode);
      await updatePipelineState(state.id, { level3_status: 'running', is_running: true, current_level: 3, current_book: bookNum });

      for (const chapter of chapters) {
        // Skip if brief already exists
        const existing = chapterBriefs.find(b => b.chapter_id === chapter.id && b.status === 'complete');
        if (existing) {
          addLog(`Skipping Ch${chapter.order_index + 1} (brief exists)`);
          continue;
        }

        await runLevel3ChapterBrief(currentProjectId, chapter.id, bookNum, seriesPlans, handleProgress);
      }

      await updatePipelineState(state.id, { is_running: false });
      await loadPipelineData();
      addLog(`Level 3 complete for Book ${bookNum}.`);
    } catch (err: any) {
      addLog(`Level 3 FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ LEVEL 4 ------

  async function executeLevel4ForBook(bookNum: number) {
    if (!currentProjectId) return;
    setIsRunning(true);
    addLog(`Starting Level 4: Scene Blueprints for Book ${bookNum}...`);

    try {
      const plan = seriesPlans.find(p => p.book_number === bookNum);
      if (!plan?.outline_id) {
        addLog(`Book ${bookNum} has no outline. Run Level 2 first.`);
        return;
      }

      const { data: chapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('outline_id', plan.outline_id)
        .order('order_index', { ascending: true });

      if (!chapters || chapters.length === 0) return;

      const state = await getOrCreatePipelineState(currentProjectId, mode);
      await updatePipelineState(state.id, { level4_status: 'running', is_running: true, current_level: 4, current_book: bookNum });

      for (const chapter of chapters) {
        const brief = chapterBriefs.find(b => b.chapter_id === chapter.id && b.status === 'complete');
        if (!brief) {
          addLog(`Skipping Ch${chapter.order_index + 1} (no brief found)`);
          continue;
        }

        // Skip if blueprints already exist
        const existingBps = sceneBlueprints.filter(bp => bp.chapter_id === chapter.id);
        if (existingBps.length > 0) {
          addLog(`Skipping Ch${chapter.order_index + 1} (blueprints exist)`);
          continue;
        }

        const blueprints = await runLevel4SceneBlueprints(currentProjectId, chapter.id, brief, handleProgress);

        // Create scene records for each blueprint
        for (let i = 0; i < blueprints.length; i++) {
          const bp = blueprints[i];
          const { data: scene } = await supabase
            .from('scenes')
            .insert({
              project_id: currentProjectId,
              chapter_id: chapter.id,
              title: bp.title,
              description: `POV: ${bp.pov_character}\nSetting: ${bp.setting}\n\n${bp.opening_beat}\n\n${bp.conflict_tension}`,
              order_index: i,
            })
            .select()
            .single();

          if (scene) {
            await supabase
              .from('scene_blueprints')
              .update({ scene_id: scene.id })
              .eq('id', bp.id);
          }
        }
      }

      await updatePipelineState(state.id, { is_running: false });
      await loadPipelineData();
      addLog(`Level 4 complete for Book ${bookNum}.`);
    } catch (err: any) {
      addLog(`Level 4 FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ LEVEL 5 ------

  async function executeLevel5ForBook(bookNum: number) {
    if (!currentProjectId) return;
    setIsRunning(true);
    addLog(`Starting Level 5: Scene Writer for Book ${bookNum}...`);

    try {
      const plan = seriesPlans.find(p => p.book_number === bookNum);
      if (!plan?.outline_id) {
        addLog(`Book ${bookNum} has no outline.`);
        return;
      }

      const { data: chapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('outline_id', plan.outline_id)
        .order('order_index', { ascending: true });

      if (!chapters || chapters.length === 0) return;

      const state = await getOrCreatePipelineState(currentProjectId, mode);
      await updatePipelineState(state.id, { level5_status: 'running', is_running: true, current_level: 5, current_book: bookNum });

      for (const chapter of chapters) {
        const brief = chapterBriefs.find(b => b.chapter_id === chapter.id && b.status === 'complete');
        if (!brief) continue;

        const { data: scenes } = await supabase
          .from('scenes')
          .select('*')
          .eq('chapter_id', chapter.id)
          .order('order_index', { ascending: true });

        if (!scenes) continue;

        for (const scene of scenes) {
          // Skip if already has content
          if (scene.content && scene.content.length > 200) {
            addLog(`Skipping scene "${scene.title}" (already written)`);
            continue;
          }

          const blueprint = sceneBlueprints.find(bp => bp.scene_id === scene.id);
          if (!blueprint) {
            addLog(`Skipping scene "${scene.title}" (no blueprint)`);
            continue;
          }

          await runLevel5SceneWriter(currentProjectId, scene.id, blueprint, brief, plan, handleProgress);
        }
      }

      await updatePipelineState(state.id, { is_running: false });
      addLog(`Level 5 complete for Book ${bookNum}.`);
    } catch (err: any) {
      addLog(`Level 5 FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ LEVEL 6 ------

  async function executeLevel6ForBook(bookNum: number) {
    if (!currentProjectId) return;
    setIsRunning(true);
    addLog(`Starting Level 6: Assembly for Book ${bookNum}...`);

    try {
      const plan = seriesPlans.find(p => p.book_number === bookNum);
      if (!plan?.outline_id) {
        addLog(`Book ${bookNum} has no outline.`);
        return;
      }

      const state = await getOrCreatePipelineState(currentProjectId, mode);
      await updatePipelineState(state.id, { level6_status: 'running', is_running: true, current_level: 6, current_book: bookNum });

      await runLevel6Assembly(currentProjectId, plan.outline_id, bookNum, handleProgress);

      await updatePipelineState(state.id, { level6_status: 'complete', is_running: false, completed_at: new Date().toISOString() });
      addLog(`Level 6 complete: Book ${bookNum} assembled.`);
    } catch (err: any) {
      addLog(`Level 6 FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ CHARACTER STATE EXTRACTION ------

  async function handleExtractStates(bookNum: number) {
    if (!currentProjectId) return;
    setIsRunning(true);
    addLog(`Extracting character states from Book ${bookNum}...`);

    try {
      const snapshots = await extractCharacterStatesFromBook(currentProjectId, bookNum, addLog);
      addLog(`Extraction complete: ${snapshots.length} character states saved for Book ${bookNum}.`);
      await loadPipelineData();
    } catch (err: any) {
      addLog(`Extraction FAILED: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  // ------ ACCELERATED MODE ------

  async function runAccelerated() {
    if (!currentProjectId) return;
    addLog('Starting Accelerated Full-Series Mode...');

    // Level 1
    await executeLevel1();

    // Level 2: all books
    for (let b = 1; b <= bookCount; b++) {
      await executeLevel2(b);
    }

    // Reload to get latest plans with outline_ids
    await loadPipelineData();

    // Level 3: all books
    for (let b = 1; b <= bookCount; b++) {
      await executeLevel3ForBook(b);
    }

    // Level 4: all books
    for (let b = 1; b <= bookCount; b++) {
      await executeLevel4ForBook(b);
    }

    // Level 5 & 6: book by book
    for (let b = 1; b <= bookCount; b++) {
      await executeLevel5ForBook(b);
      await executeLevel6ForBook(b);
      addLog(`Book ${b} complete. Continuity data available for Book ${b + 1}.`);
    }

    addLog('ACCELERATED MODE COMPLETE. Full series drafted.');
  }

  // ------ DELETE HANDLERS ------

  async function handleDeleteLevel(level: PipelineLevel) {
    if (!currentProjectId) return;
    const labels = ['', 'series plans', 'chapter outlines', 'chapter briefs', 'scene blueprints', 'scene drafts', 'assemblies'];
    if (!confirm(`Delete all ${labels[level]} for this project? This cannot be undone.`)) return;

    try {
      if (level === 1) {
        await deleteSeriesPlans(currentProjectId);
        setSeriesPlans([]);
      } else if (level === 3) {
        await deleteChapterBriefs(currentProjectId);
        setChapterBriefs([]);
      } else if (level === 4) {
        await deleteSceneBlueprints(currentProjectId);
        setSceneBlueprints([]);
      }
      addLog(`Deleted all ${labels[level]}.`);
    } catch (err: any) {
      addLog(`Delete failed: ${err.message}`);
    }
  }

  async function handleResetPipeline() {
    if (!currentProjectId) return;
    if (!confirm('Reset pipeline state? This clears progress tracking but does NOT delete generated content.')) return;
    await deletePipelineState(currentProjectId);
    setPipelineState(null);
    addLog('Pipeline state reset.');
  }

  // ------ RENDER ------

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  function getLevelStatus(level: PipelineLevel): LevelStatus {
    if (!pipelineState) {
      if (level === 1 && seriesPlans.length > 0) return 'complete';
      if (level === 3 && chapterBriefs.length > 0) return 'complete';
      if (level === 4 && sceneBlueprints.length > 0) return 'complete';
      return 'pending';
    }
    const key = LEVELS.find(l => l.level === level)?.statusKey;
    if (!key) return 'pending';
    return (pipelineState as any)[key] as LevelStatus;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Series Pipeline</h1>
          <p className="text-slate-600 mt-1">Full-series multi-pass generation: broad structure first, then progressive detail</p>
        </div>
        <ProjectSelector />
      </div>

      {/* Mode Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Mode:</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as PipelineMode)}
            className="rounded-md border-slate-300 text-sm"
          >
            <option value="guided">Guided (approve each level)</option>
            <option value="accelerated">Accelerated (unattended)</option>
          </select>
        </div>
        {mode === 'accelerated' && (
          <button
            onClick={runAccelerated}
            disabled={isRunning}
            className="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm font-medium"
          >
            {isRunning ? 'Running...' : 'Run Full Pipeline'}
          </button>
        )}
        <button
          onClick={handleResetPipeline}
          className="px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Reset State
        </button>
      </div>

      {/* Level Cards */}
      <div className="space-y-4 mb-8">
        {LEVELS.map((levelConfig) => {
          const status = getLevelStatus(levelConfig.level);
          const isExpanded = expandedLevel === levelConfig.level;

          return (
            <div key={levelConfig.level} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedLevel(isExpanded ? null : levelConfig.level)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    status === 'complete' ? 'bg-teal-100 text-teal-800' :
                    status === 'running' ? 'bg-amber-100 text-amber-800' :
                    status === 'stale' ? 'bg-orange-100 text-orange-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {levelConfig.level}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{levelConfig.title}</h3>
                    <p className="text-sm text-slate-500">{levelConfig.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    status === 'complete' ? 'bg-teal-50 text-teal-700' :
                    status === 'running' ? 'bg-amber-50 text-amber-700' :
                    status === 'stale' ? 'bg-orange-50 text-orange-700' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {status}
                  </span>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                  {levelConfig.level === 1 && renderLevel1Panel()}
                  {levelConfig.level === 2 && renderLevel2Panel()}
                  {levelConfig.level === 3 && renderLevel3Panel()}
                  {levelConfig.level === 4 && renderLevel4Panel()}
                  {levelConfig.level === 5 && renderLevel5Panel()}
                  {levelConfig.level === 6 && renderLevel6Panel()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Log */}
      {log.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-slate-300">Pipeline Log</h3>
            <button onClick={() => setLog([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
          </div>
          <div className="space-y-1 font-mono text-xs text-slate-400">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {progress && isRunning && (
        <div className="fixed bottom-4 left-4 bg-white border border-slate-200 shadow-lg rounded-lg px-4 py-3 max-w-md z-50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
            <div>
              <p className="text-sm font-medium text-slate-800">Level {progress.level}: {LEVELS[progress.level - 1]?.title}</p>
              <p className="text-xs text-slate-500">{progress.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ------ LEVEL PANELS ------

  function renderLevel1Panel() {
    return (
      <div className="space-y-4">
        {seriesPlans.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-800">Generated Series Plan ({seriesPlans.length} books)</h4>
              <button
                onClick={() => handleDeleteLevel(1)}
                className="text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Delete All Plans
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {seriesPlans.map(plan => (
                <div key={plan.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500">Book {plan.book_number}</span>
                    <span className="font-medium text-slate-900 text-sm">{plan.title}</span>
                  </div>
                  <p className="text-xs text-slate-600">{plan.core_theme}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.high_level_outline}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {(plan as any).ownership_status && (
                      <GateBadge label="Own" status={(plan as any).ownership_status} />
                    )}
                    {(plan as any).msu_status && (
                      <GateBadge label="MSU" status={(plan as any).msu_status} />
                    )}
                    {(plan as any).reveal_status && (
                      <GateBadge label="Rev" status={(plan as any).reveal_status} />
                    )}
                    {characterStateCounts[plan.book_number] != null && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-sky-50 text-sky-700 border-sky-200">
                        States: {characterStateCounts[plan.book_number]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Number of Books</label>
                <input
                  type="number"
                  value={bookCount}
                  onChange={(e) => setBookCount(parseInt(e.target.value) || 1)}
                  min={1}
                  max={12}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Genre</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Epic fantasy, sci-fi thriller..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Series Premise</label>
              <textarea
                value={seriesPremise}
                onChange={(e) => setSeriesPremise(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="What is this series about? The core concept and hook..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Series Ending State</label>
              <textarea
                value={endingState}
                onChange={(e) => setEndingState(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Where does the story ultimately end? Final state of the world and characters..."
              />
            </div>
            <button
              onClick={executeLevel1}
              disabled={isRunning || !seriesPremise}
              className="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm font-medium"
            >
              {isRunning ? 'Generating...' : 'Generate Series Architecture'}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderLevel2Panel() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Book Number</label>
            <select
              value={currentBookForL2}
              onChange={(e) => setCurrentBookForL2(parseInt(e.target.value))}
              className="rounded-md border-slate-300 text-sm"
            >
              {seriesPlans.map(p => (
                <option key={p.book_number} value={p.book_number}>
                  Book {p.book_number}: {p.title}
                </option>
              ))}
              {seriesPlans.length === 0 && <option value={1}>No plans yet</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chapters per Book</label>
            <input
              type="number"
              value={chapterCount}
              onChange={(e) => setChapterCount(parseInt(e.target.value) || 10)}
              min={5}
              max={30}
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="self-end">
            <button
              onClick={() => executeLevel2(currentBookForL2)}
              disabled={isRunning || seriesPlans.length === 0}
              className="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm font-medium"
            >
              {isRunning ? 'Generating...' : `Generate Book ${currentBookForL2} Chapters`}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Each book is generated with knowledge of all prior books. Run sequentially (Book 1, then 2, then 3...) for best continuity.
        </p>
        {seriesPlans.filter(p => p.outline_id).length > 0 && (
          <div className="text-sm text-slate-600">
            Books with outlines: {seriesPlans.filter(p => p.outline_id).map(p => `Book ${p.book_number}`).join(', ')}
          </div>
        )}
      </div>
    );
  }

  function renderLevel3Panel() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Generate design briefs for all chapters in a book. Requires Level 2 (chapter outlines) to be complete.
          </p>
          {chapterBriefs.length > 0 && (
            <button
              onClick={() => handleDeleteLevel(3)}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Delete All Briefs
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {seriesPlans.filter(p => p.outline_id).map(plan => (
            <button
              key={plan.book_number}
              onClick={() => executeLevel3ForBook(plan.book_number)}
              disabled={isRunning}
              className="px-3 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm"
            >
              Book {plan.book_number}
            </button>
          ))}
        </div>
        {chapterBriefs.length > 0 && (
          <div className="text-sm text-slate-600">
            {chapterBriefs.length} chapter briefs generated across {[...new Set(chapterBriefs.map(b => b.book_number))].length} books.
          </div>
        )}
      </div>
    );
  }

  function renderLevel4Panel() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Generate scene blueprints and create scene records. Requires Level 3 (chapter briefs).
          </p>
          {sceneBlueprints.length > 0 && (
            <button
              onClick={() => handleDeleteLevel(4)}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Delete All Blueprints
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {seriesPlans.filter(p => p.outline_id).map(plan => (
            <button
              key={plan.book_number}
              onClick={() => executeLevel4ForBook(plan.book_number)}
              disabled={isRunning}
              className="px-3 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm"
            >
              Book {plan.book_number}
            </button>
          ))}
        </div>
        {sceneBlueprints.length > 0 && (
          <div className="text-sm text-slate-600">
            {sceneBlueprints.length} scene blueprints generated.
          </div>
        )}
      </div>
    );
  }

  function renderLevel5Panel() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Write prose for all scenes from their blueprints. Requires Level 4 (scene blueprints). Skips scenes that already have content.
        </p>
        <div className="flex items-center gap-3">
          {seriesPlans.filter(p => p.outline_id).map(plan => (
            <button
              key={plan.book_number}
              onClick={() => executeLevel5ForBook(plan.book_number)}
              disabled={isRunning}
              className="px-3 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm"
            >
              Book {plan.book_number}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderLevel6Panel() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Assemble written scenes into chapters and chapters into book manuscripts. After assembly, extract character states for continuity in subsequent books.
        </p>
        <div className="flex items-center gap-3">
          {seriesPlans.filter(p => p.outline_id).map(plan => (
            <button
              key={plan.book_number}
              onClick={() => executeLevel6ForBook(plan.book_number)}
              disabled={isRunning}
              className="px-3 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 text-sm"
            >
              Book {plan.book_number}
            </button>
          ))}
        </div>
        {seriesPlans.filter(p => p.outline_id).length > 0 && (
          <div className="border-t border-slate-100 pt-3 mt-3">
            <p className="text-sm font-medium text-slate-700 mb-2">Character State Extraction</p>
            <p className="text-xs text-slate-500 mb-2">
              Extract character states after a book is assembled. These states are injected into subsequent book generation to prevent character regression.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {seriesPlans.filter(p => p.outline_id).map(plan => (
                <button
                  key={`extract-${plan.book_number}`}
                  onClick={() => handleExtractStates(plan.book_number)}
                  disabled={isRunning}
                  className="px-3 py-1.5 border border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 disabled:opacity-50 text-xs font-medium"
                >
                  Extract Book {plan.book_number}
                  {characterStateCounts[plan.book_number] != null && (
                    <span className="ml-1.5 text-[10px] bg-sky-100 px-1 rounded">{characterStateCounts[plan.book_number]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

function GateBadge({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    passed: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    needs_review: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const colorClass = colors[status] || 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colorClass}`}>
      {label}: {status === 'needs_review' ? 'review' : status}
    </span>
  );
}
