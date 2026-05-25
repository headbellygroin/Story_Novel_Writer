import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import StageIndicator from '../components/pipeline/StageIndicator';
import ImageReviewGrid from '../components/pipeline/ImageReviewGrid';
import LipsyncChunkList from '../components/pipeline/LipsyncChunkList';
import TtsChunkReview from '../components/pipeline/TtsChunkReview';
import {
  PipelineStage,
  PipelineProgress,
  createPipelineRun,
  runAnalysisStage,
  runImageGenerationStage,
  runAnimationStage,
  runTtsStage,
  runAudioAssemblyStage,
  runLipsyncStage,
  setPipelineError,
  buildVideoAssemblyManifest,
} from '../services/pipelineService';
import { ComfyUISettings } from '../services/comfyuiService';
import { ComfyUITtsSettings } from '../services/comfyuiTtsService';
import { ComfyUIAnimationSettings } from '../services/comfyuiAnimationService';
import { ComfyUILipsyncSettings } from '../services/comfyuiLipsyncService';
import { GenerationSettings } from '../services/aiService';

type GenSettings = Database['public']['Tables']['generation_settings']['Row'];
type PipelineRun = Database['public']['Tables']['pipeline_runs']['Row'];
type PipelineImage = Database['public']['Tables']['pipeline_images']['Row'];
type LipsyncChunk = Database['public']['Tables']['pipeline_lipsync_chunks']['Row'];
type TtsChunk = Database['public']['Tables']['tts_chunks']['Row'];

interface ChapterOption {
  id: string;
  title: string;
  order_index: number;
}

interface AssemblyRecord {
  audio_url: string;
  audio_status: string;
  audio_duration_seconds: number | null;
  audio_chunk_count: number | null;
}

export default function Pipeline() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [settings, setSettings] = useState<Partial<GenSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [pipelineRun, setPipelineRun] = useState<PipelineRun | null>(null);
  const [images, setImages] = useState<PipelineImage[]>([]);
  const [lipsyncChunks, setLipsyncChunks] = useState<LipsyncChunk[]>([]);
  const [ttsChunks, setTtsChunks] = useState<TtsChunk[]>([]);
  const [assembly, setAssembly] = useState<AssemblyRecord | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lipsyncImageUrl, setLipsyncImageUrl] = useState('');
  const [genre, setGenre] = useState('');
  const [showAnimated, setShowAnimated] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      loadSettings();
      loadGenre();
      if (currentOutlineId) loadChapters();
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => {
    if (selectedChapterId && currentProjectId) loadPipelineRun();
  }, [selectedChapterId, currentProjectId]);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('generation_settings')
        .select('*')
        .eq('project_id', currentProjectId!)
        .maybeSingle();
      setSettings(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadGenre() {
    const { data } = await supabase
      .from('projects')
      .select('genre')
      .eq('id', currentProjectId!)
      .maybeSingle();
    if (data) setGenre(data.genre || '');
  }

  async function loadChapters() {
    if (!currentOutlineId) return;
    const { data } = await supabase
      .from('chapters')
      .select('id, title, order_index')
      .eq('outline_id', currentOutlineId)
      .order('order_index');
    if (data) setChapters(data);
  }

  async function loadPipelineRun() {
    const { data } = await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('project_id', currentProjectId!)
      .eq('chapter_id', selectedChapterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setPipelineRun(data);
    if (data) {
      setLipsyncImageUrl(data.lipsync_image_url || '');
      await loadRunData(data.id);
    } else {
      setImages([]);
      setLipsyncChunks([]);
      setTtsChunks([]);
      setAssembly(null);
    }
  }

  async function loadRunData(runId: string) {
    const [imgRes, lsRes, ttsRes, assemblyRes] = await Promise.all([
      supabase.from('pipeline_images').select('*').eq('pipeline_run_id', runId).order('order_index'),
      supabase.from('pipeline_lipsync_chunks').select('*').eq('pipeline_run_id', runId).order('chunk_index'),
      supabase.from('tts_chunks').select('*').eq('project_id', currentProjectId!).eq('chapter_id', selectedChapterId).order('chunk_index'),
      supabase.from('pipeline_assembly').select('*').eq('pipeline_run_id', runId).maybeSingle(),
    ]);

    setImages(imgRes.data || []);
    setLipsyncChunks(lsRes.data || []);
    setTtsChunks(ttsRes.data || []);
    setAssembly(assemblyRes.data as AssemblyRecord | null);
  }

  const onProgress = useCallback((p: PipelineProgress) => setProgress(p), []);

  function getAiSettings(): GenerationSettings {
    return {
      model_name: settings?.model_name || '',
      api_endpoint: settings?.api_endpoint || '',
      temperature: settings?.temperature || 0.7,
      max_tokens: settings?.max_tokens || 2000,
      system_prompt: settings?.system_prompt || '',
      style_guide: settings?.style_guide || '',
      top_p: settings?.top_p,
      context_length: settings?.context_length,
      stop_sequences: settings?.stop_sequences || undefined,
    };
  }

  function getComfySettings(): ComfyUISettings {
    return {
      endpoint: (settings?.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings?.comfyui_workflow as Record<string, unknown>) || null,
      orientation: ((settings as Record<string, unknown>)?.image_orientation as 'portrait' | 'landscape' | 'square') ?? 'portrait',
      noiseMode: ((settings as Record<string, unknown>)?.image_noise_mode as 'random' | 'fixed') ?? 'random',
      noiseSeed: ((settings as Record<string, unknown>)?.image_noise_seed as number) ?? 42,
      batchSize: 1,
    };
  }

  function getTtsSettings(): ComfyUITtsSettings {
    return {
      endpoint: (settings?.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings?.comfyui_tts_workflow as Record<string, unknown>) || null,
      speaker: (settings?.comfyui_tts_speaker as string) || 'af_sarah',
      sampleRate: (settings?.comfyui_tts_sample_rate as number) || 24000,
    };
  }

  function getAnimationSettings(): ComfyUIAnimationSettings {
    return {
      endpoint: (settings?.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings?.comfyui_animation_workflow as Record<string, unknown>) || null,
      orientation: ((settings as Record<string, unknown>)?.animation_orientation as 'portrait' | 'landscape' | 'square') ?? 'portrait',
      noiseMode: ((settings as Record<string, unknown>)?.animation_noise_mode as 'random' | 'fixed') ?? 'random',
      noiseSeed: ((settings as Record<string, unknown>)?.animation_noise_seed as number) ?? 42,
    };
  }

  function getLipsyncSettings(): ComfyUILipsyncSettings {
    return {
      endpoint: (settings?.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings?.comfyui_lipsync_workflow as Record<string, unknown>) || null,
    };
  }

  async function ensureRun(): Promise<string> {
    if (pipelineRun) return pipelineRun.id;
    const id = await createPipelineRun(currentProjectId!, selectedChapterId);
    await loadPipelineRun();
    return id;
  }

  async function run<T>(fn: () => Promise<T>) {
    setIsRunning(true);
    try {
      await fn();
      await loadPipelineRun();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (pipelineRun) await setPipelineError(pipelineRun.id, msg);
      alert(`Pipeline error: ${msg}`);
      await loadPipelineRun();
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }

  async function handleStartAnalysis() {
    if (!selectedChapterId || isRunning) return;
    await run(async () => {
      const runId = await ensureRun();
      await runAnalysisStage(runId, currentProjectId!, selectedChapterId, genre, getAiSettings(), onProgress);
      await runImageGenerationStage(runId, currentProjectId!, selectedChapterId, getComfySettings(), onProgress);
    });
  }

  async function handleRunAnimation() {
    if (!pipelineRun || isRunning) return;
    const animSettings = getAnimationSettings();
    if (!animSettings.workflow) { alert('No animation workflow configured. Import one in Settings.'); return; }
    await run(() => runAnimationStage(pipelineRun.id, currentProjectId!, selectedChapterId, animSettings, onProgress));
  }

  async function handleRunTts() {
    if (!pipelineRun || isRunning) return;
    const ttsSettings = getTtsSettings();
    if (!ttsSettings.workflow) { alert('No TTS workflow configured. Import one in Settings.'); return; }
    await run(() => runTtsStage(pipelineRun.id, currentProjectId!, selectedChapterId, ttsSettings, onProgress));
  }

  async function handleAssembleAudio() {
    if (!pipelineRun || isRunning) return;
    await run(() => runAudioAssemblyStage(pipelineRun.id, currentProjectId!, selectedChapterId, onProgress));
  }

  async function handleExportManifest() {
    if (!pipelineRun) return;
    const chapter = chapters.find((c) => c.id === selectedChapterId);
    const manifest = await buildVideoAssemblyManifest(
      pipelineRun.id,
      currentProjectId!,
      selectedChapterId,
      chapter?.order_index ?? 0
    );
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.chapterLabel.replace(/\s/g, '_')}_manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRunLipsync() {
    if (!pipelineRun || isRunning || !lipsyncImageUrl.trim()) return;
    const lsSettings = getLipsyncSettings();
    if (!lsSettings.workflow) { alert('No lip-sync workflow configured. Import one in Settings.'); return; }
    const chapter = chapters.find((c) => c.id === selectedChapterId);
    await run(() => runLipsyncStage(
      pipelineRun.id,
      currentProjectId!,
      selectedChapterId,
      lipsyncImageUrl.trim(),
      lsSettings,
      chapter?.order_index || 0,
      onProgress
    ));
  }

  function toggleAudioPlayback() {
    if (!assembly?.audio_url) return;
    if (audioPlaying) {
      audioRef.current?.pause();
      setAudioPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(assembly.audio_url);
        audioRef.current.onended = () => setAudioPlaying(false);
      }
      audioRef.current.play();
      setAudioPlaying(true);
    }
  }

  function downloadAudio() {
    if (!assembly?.audio_url) return;
    const a = document.createElement('a');
    a.href = assembly.audio_url;
    a.download = `chapter_audio.wav`;
    a.click();
  }

  async function handleNewRun() {
    if (!selectedChapterId) return;
    await createPipelineRun(currentProjectId!, selectedChapterId);
    setImages([]); setLipsyncChunks([]); setTtsChunks([]); setAssembly(null); setProgress(null);
    await loadPipelineRun();
  }

  const currentStage: PipelineStage = (pipelineRun?.current_stage as PipelineStage) || 'idle';
  const currentStatus = pipelineRun?.status || 'idle';

  const hasCompletedTts = ttsChunks.some((c) => c.status === 'completed');
  const completedTtsCount = ttsChunks.filter((c) => c.status === 'completed').length;
  const audioAssembled = assembly?.audio_status === 'completed' && !!assembly?.audio_url;

  const canAnalyze = selectedChapterId && !isRunning && (!pipelineRun || currentStage === 'idle');
  const canAnimate = !!(pipelineRun && (currentStage === 'images_review' || currentStage === 'animation_review') && !isRunning);
  const canTts = !!(pipelineRun && (currentStage === 'animation_review' || currentStage === 'tts_review' || currentStage === 'assembling_audio' || currentStage === 'assembling_video') && !isRunning);
  const canAssembleAudio = !!(pipelineRun && hasCompletedTts && !isRunning);
  const canExportManifest = !!(pipelineRun && hasCompletedTts && images.length > 0);
  const canLipsync = !!(pipelineRun && hasCompletedTts && lipsyncImageUrl.trim() && !isRunning);

  const STAGE_FLOW: PipelineStage[] = [
    'analyzing', 'generating_images', 'images_review', 'animating', 'animation_review',
    'generating_tts', 'tts_review', 'assembling_audio', 'assembling_video',
    'video_review', 'generating_lipsync', 'lipsync_complete',
  ];

  function stageAfter(_stage: PipelineStage, target: PipelineStage): boolean {
    return STAGE_FLOW.indexOf(currentStage) >= STAGE_FLOW.indexOf(target);
  }

  if (!currentProjectId) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="text-center text-slate-600">Please select or create a project first.</div></div>;
  }
  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="text-center text-slate-600">Loading...</div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Production Pipeline</h1>
        <ProjectSelector />
      </div>

      {/* Chapter selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Chapter</label>
            <select
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setPipelineRun(null); setImages([]); setLipsyncChunks([]);
                setTtsChunks([]); setAssembly(null); setProgress(null);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Choose a chapter...</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>Ch. {c.order_index + 1}: {c.title}</option>
              ))}
            </select>
          </div>
          {pipelineRun && (
            <button onClick={handleNewRun} disabled={isRunning}
              className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap">
              New Run
            </button>
          )}
        </div>
      </div>

      {selectedChapterId && (
        <>
          {/* Stage indicator + progress */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <StageIndicator currentStage={currentStage} status={currentStatus} />
            {progress && isRunning && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{progress.message}</span>
                  <span className="text-slate-500 font-mono text-xs">{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            {pipelineRun?.error_message && currentStatus === 'error' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{pipelineRun.error_message}</p>
              </div>
            )}
          </div>

          {/* Stage 1: Analyze + Generate Images */}
          {(currentStage === 'idle' || !pipelineRun) && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 text-sm font-bold flex items-center justify-center">1</span>
                <h2 className="text-lg font-semibold text-slate-900">Analyze & Generate Images</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                The LLM analyzes the chapter text, identifies key visual moments, then generates a scene image for each one.
              </p>
              <button onClick={handleStartAnalysis} disabled={!canAnalyze}
                className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 font-medium transition-colors">
                {isRunning ? 'Running...' : 'Start Analysis & Image Generation'}
              </button>
            </div>
          )}

          {/* Image review grid */}
          {images.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 text-sm font-bold flex items-center justify-center">1</span>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Generated Images
                    <span className="ml-2 text-sm font-normal text-slate-500">({images.length})</span>
                  </h2>
                </div>
                {images.some((img) => img.animated_url) && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={showAnimated} onChange={(e) => setShowAnimated(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600" />
                    Show animated
                  </label>
                )}
              </div>
              <ImageReviewGrid images={images} showAnimated={showAnimated} />
            </div>
          )}

          {/* Stage 2: Animate */}
          {stageAfter(currentStage, 'images_review') && currentStage !== 'idle' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-sm font-bold flex items-center justify-center">2</span>
                <h2 className="text-lg font-semibold text-slate-900">Animate Images</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Each still image gets subtle motion — glowing lights, swaying elements, flickering effects — via LTX 2.3.
                These looping animations replace the stills in the final video.
              </p>
              {!settings?.comfyui_animation_workflow && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  No animation workflow configured. Import one in Settings.
                </p>
              )}
              <button onClick={handleRunAnimation} disabled={!canAnimate || !settings?.comfyui_animation_workflow}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors">
                {isRunning && currentStage === 'animating' ? 'Animating...' : 'Animate All Images'}
              </button>
              {images.some((img) => img.animated_url) && (
                <p className="text-xs text-teal-600 mt-2">
                  {images.filter((img) => img.animated_url).length} of {images.length} images animated.
                </p>
              )}
            </div>
          )}

          {/* Stage 3: TTS */}
          {stageAfter(currentStage, 'animation_review') && currentStage !== 'idle' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-sm font-bold flex items-center justify-center">3</span>
                <h2 className="text-lg font-semibold text-slate-900">Generate TTS Narration</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                The chapter text is split into chunks and narrated via Kokoro TTS. Each chunk is uploaded to storage.
              </p>
              {!settings?.comfyui_tts_workflow && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  No TTS workflow configured. Import one in Settings.
                </p>
              )}
              <button onClick={handleRunTts} disabled={!canTts || !settings?.comfyui_tts_workflow}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium transition-colors">
                {isRunning && currentStage === 'generating_tts' ? 'Generating TTS...' : 'Generate TTS Audio'}
              </button>
              {ttsChunks.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{completedTtsCount} of {ttsChunks.length} chunks complete</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${ttsChunks.length > 0 ? (completedTtsCount / ttsChunks.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              {/* TTS Chunk Review - play, edit text, regenerate individual chunks */}
              {ttsChunks.length > 0 && (
                <TtsChunkReview
                  chunks={ttsChunks}
                  ttsSettings={getTtsSettings()}
                  projectId={currentProjectId!}
                  chapterId={selectedChapterId}
                  onChunkUpdated={() => loadPipelineRun()}
                />
              )}
            </div>
          )}

          {/* Stage 4: Audio Assembly */}
          {hasCompletedTts && stageAfter(currentStage, 'tts_review') && currentStage !== 'idle' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center justify-center">4</span>
                <h2 className="text-lg font-semibold text-slate-900">Assemble Chapter Audio</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                All {completedTtsCount} TTS chunks are stitched together into a single chapter audio file using the Web Audio API,
                then saved to storage. This is the master audio track for the chapter video.
              </p>

              {audioAssembled ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Chapter audio assembled</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {assembly?.audio_chunk_count} chunks &bull; {Math.round(assembly?.audio_duration_seconds ?? 0)}s
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={toggleAudioPlayback}
                        className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${audioPlaying ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                        {audioPlaying ? 'Pause' : 'Preview'}
                      </button>
                      <button onClick={downloadAudio}
                        className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors">
                        Download WAV
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <button onClick={handleAssembleAudio} disabled={!canAssembleAudio}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors">
                {isRunning && currentStage === 'assembling_audio' ? 'Assembling...' : audioAssembled ? 'Re-assemble Audio' : 'Assemble Chapter Audio'}
              </button>
            </div>
          )}

          {/* Stage 5: Video Assembly Manifest */}
          {canExportManifest && stageAfter(currentStage, 'tts_review') && currentStage !== 'idle' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-sm font-bold flex items-center justify-center">5</span>
                <h2 className="text-lg font-semibold text-slate-900">Video Assembly Manifest</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Export a JSON manifest containing all Supabase Storage URLs — animated scenes, assembled audio,
                text anchors, and timing metadata. Use this with FFmpeg or a video editor to produce the final
                YouTube litRPG chapter video.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
                <p>images: {images.length} scenes ({images.filter(i => i.animated_url).length} animated)</p>
                <p>audio: {audioAssembled ? `${Math.round(assembly?.audio_duration_seconds ?? 0)}s assembled` : `${completedTtsCount} chunks (not yet assembled)`}</p>
                <p>all URLs: permanent Supabase Storage (survive ComfyUI restarts)</p>
              </div>
              <button onClick={handleExportManifest} disabled={!canExportManifest}
                className="px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 font-medium transition-colors">
                Export Video Manifest
              </button>
            </div>
          )}

          {/* Stage 6: Lipsync */}
          {hasCompletedTts && stageAfter(currentStage, 'tts_review') && currentStage !== 'idle' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 text-sm font-bold flex items-center justify-center">6</span>
                <h2 className="text-lg font-semibold text-slate-900">Lipsync Reading Video</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                A character "reads" each TTS chunk via LTX 2.3 lipsync. One video clip per chunk.
                Select a front-facing character image — use any generated scene image from above, or paste a URL.
              </p>

              {/* Image picker from generated images */}
              {images.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">Pick from generated images:</p>
                  <div className="flex gap-2 flex-wrap">
                    {images.map((img) => {
                      const url = img.image_url || '';
                      if (!url) return null;
                      return (
                        <button key={img.id} onClick={() => setLipsyncImageUrl(url)}
                          className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${lipsyncImageUrl === url ? 'border-rose-500' : 'border-slate-200 hover:border-slate-400'}`}>
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Or paste a character image URL</label>
                <input type="text" value={lipsyncImageUrl} onChange={(e) => setLipsyncImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                  placeholder="https://... or Supabase Storage URL" />
              </div>

              {lipsyncImageUrl && (
                <div className="mb-4">
                  <img src={lipsyncImageUrl} alt="Lipsync character"
                    className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}

              {!settings?.comfyui_lipsync_workflow && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  No lip-sync workflow configured. Import one in Settings.
                </p>
              )}

              <button onClick={handleRunLipsync} disabled={!canLipsync || !settings?.comfyui_lipsync_workflow}
                className="px-6 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-medium transition-colors">
                {isRunning && currentStage === 'generating_lipsync' ? 'Generating Lipsync...' : 'Generate Lipsync Videos'}
              </button>

              {lipsyncChunks.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Lipsync Chunks
                      <span className="ml-2 font-normal text-slate-500">
                        ({lipsyncChunks.filter(c => c.status === 'completed').length}/{lipsyncChunks.length} complete)
                      </span>
                    </h3>
                  </div>
                  <LipsyncChunkList chunks={lipsyncChunks} />
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!pipelineRun && !isRunning && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5" />
              </svg>
              <p className="text-slate-500 text-sm mb-1">No pipeline run for this chapter yet.</p>
              <p className="text-slate-400 text-xs">Click "Start Analysis & Image Generation" to begin.</p>
            </div>
          )}
        </>
      )}

      {!selectedChapterId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-slate-500 text-sm">Select a chapter to start the production pipeline.</p>
        </div>
      )}
    </div>
  );
}
