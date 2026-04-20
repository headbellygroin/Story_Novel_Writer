import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import StageIndicator from '../components/pipeline/StageIndicator';
import ImageReviewGrid from '../components/pipeline/ImageReviewGrid';
import LipsyncChunkList from '../components/pipeline/LipsyncChunkList';
import {
  PipelineStage,
  PipelineProgress,
  createPipelineRun,
  runAnalysisStage,
  runImageGenerationStage,
  runAnimationStage,
  runTtsStage,
  runLipsyncStage,
  setPipelineError,
  buildVideoAssemblyData,
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
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lipsyncImageUrl, setLipsyncImageUrl] = useState('');
  const [genre, setGenre] = useState('');
  const [showAnimated, setShowAnimated] = useState(false);

  useEffect(() => {
    if (currentProjectId) {
      loadSettings();
      loadGenre();
      if (currentOutlineId) loadChapters();
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => {
    if (selectedChapterId && currentProjectId) {
      loadPipelineRun();
    }
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
    }
  }

  async function loadRunData(runId: string) {
    const [imgRes, lsRes, ttsRes] = await Promise.all([
      supabase
        .from('pipeline_images')
        .select('*')
        .eq('pipeline_run_id', runId)
        .order('order_index'),
      supabase
        .from('pipeline_lipsync_chunks')
        .select('*')
        .eq('pipeline_run_id', runId)
        .order('chunk_index'),
      supabase
        .from('tts_chunks')
        .select('*')
        .eq('project_id', currentProjectId!)
        .eq('chapter_id', selectedChapterId)
        .order('chunk_index'),
    ]);

    setImages(imgRes.data || []);
    setLipsyncChunks(lsRes.data || []);
    setTtsChunks(ttsRes.data || []);
  }

  const onProgress = useCallback((p: PipelineProgress) => {
    setProgress(p);
  }, []);

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
      checkpoint: (settings?.comfyui_checkpoint as string) || '',
      width: settings?.image_width || 768,
      height: settings?.image_height || 512,
      steps: settings?.image_steps || 25,
      cfgScale: settings?.image_cfg_scale || 7,
      sampler: (settings?.image_sampler as string) || 'euler_ancestral',
      negativePrompt: (settings?.image_negative_prompt as string) || '',
    };
  }

  function getTtsSettings(): ComfyUITtsSettings {
    return {
      endpoint: (settings?.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings?.comfyui_tts_workflow as Record<string, unknown>) || null,
      speaker: (settings?.comfyui_tts_speaker as string) || '',
      sampleRate: (settings?.comfyui_tts_sample_rate as number) || 24000,
    };
  }

  function getAnimationSettings(): ComfyUIAnimationSettings {
    return {
      endpoint: (settings?.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings?.comfyui_animation_workflow as Record<string, unknown>) || null,
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

  async function handleStartAnalysis() {
    if (!selectedChapterId || isRunning) return;
    setIsRunning(true);
    try {
      const runId = await ensureRun();
      await runAnalysisStage(runId, currentProjectId!, selectedChapterId, genre, getAiSettings(), onProgress);
      await runImageGenerationStage(runId, getComfySettings(), onProgress);
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

  async function handleRunAnimation() {
    if (!pipelineRun || isRunning) return;
    const animSettings = getAnimationSettings();
    if (!animSettings.workflow) {
      alert('No animation workflow configured. Import one in Settings.');
      return;
    }
    setIsRunning(true);
    try {
      await runAnimationStage(pipelineRun.id, animSettings, onProgress);
      await loadPipelineRun();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await setPipelineError(pipelineRun.id, msg);
      alert(`Animation error: ${msg}`);
      await loadPipelineRun();
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }

  async function handleRunTts() {
    if (!pipelineRun || isRunning) return;
    const ttsSettings = getTtsSettings();
    if (!ttsSettings.workflow) {
      alert('No TTS workflow configured. Import one in Settings.');
      return;
    }
    setIsRunning(true);
    try {
      await runTtsStage(pipelineRun.id, currentProjectId!, selectedChapterId, ttsSettings, onProgress);
      await loadPipelineRun();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await setPipelineError(pipelineRun.id, msg);
      alert(`TTS error: ${msg}`);
      await loadPipelineRun();
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }

  async function handleRunLipsync() {
    if (!pipelineRun || isRunning || !lipsyncImageUrl.trim()) return;
    const lsSettings = getLipsyncSettings();
    if (!lsSettings.workflow) {
      alert('No lip-sync workflow configured. Import one in Settings.');
      return;
    }
    const chapter = chapters.find((c) => c.id === selectedChapterId);
    setIsRunning(true);
    try {
      await runLipsyncStage(
        pipelineRun.id,
        currentProjectId!,
        selectedChapterId,
        lipsyncImageUrl.trim(),
        lsSettings,
        chapter?.order_index || 0,
        onProgress
      );
      await loadPipelineRun();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await setPipelineError(pipelineRun.id, msg);
      alert(`Lip-sync error: ${msg}`);
      await loadPipelineRun();
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }

  async function handleNewRun() {
    if (!selectedChapterId) return;
    const id = await createPipelineRun(currentProjectId!, selectedChapterId);
    setPipelineRun(null);
    setImages([]);
    setLipsyncChunks([]);
    setTtsChunks([]);
    setProgress(null);
    await loadPipelineRun();
    return id;
  }

  function handleAssemblyExport() {
    if (!pipelineRun) return;
    const chapter = chapters.find((c) => c.id === selectedChapterId);
    const completedTts = ttsChunks.filter((c) => c.status === 'completed');
    const data = buildVideoAssemblyData(images, completedTts, chapter?.order_index || 0);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.chapterLabel.replace(/\s/g, '_')}_assembly.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentStage: PipelineStage = (pipelineRun?.current_stage as PipelineStage) || 'idle';
  const currentStatus = pipelineRun?.status || 'idle';
  const canAnalyze = selectedChapterId && !isRunning && (!pipelineRun || currentStage === 'idle');
  const canAnimate = pipelineRun && (currentStage === 'images_review' || currentStage === 'animation_review') && !isRunning;
  const canTts = pipelineRun && (currentStage === 'animation_review' || currentStage === 'tts_review') && !isRunning;
  const hasCompletedTts = ttsChunks.some((c) => c.status === 'completed');
  const canAssemble = pipelineRun && hasCompletedTts && images.length > 0;
  const canLipsync = pipelineRun && hasCompletedTts && lipsyncImageUrl.trim() && !isRunning &&
    (currentStage === 'tts_review' || currentStage === 'video_review' || currentStage === 'generating_lipsync');

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Production Pipeline</h1>
        <ProjectSelector />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Chapter</label>
            <select
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setPipelineRun(null);
                setImages([]);
                setLipsyncChunks([]);
                setTtsChunks([]);
                setProgress(null);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Choose a chapter...</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ch. {c.order_index + 1}: {c.title}
                </option>
              ))}
            </select>
          </div>

          {pipelineRun && (
            <button
              onClick={handleNewRun}
              disabled={isRunning}
              className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              New Run
            </button>
          )}
        </div>
      </div>

      {selectedChapterId && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <StageIndicator currentStage={currentStage} status={currentStatus} />

            {progress && isRunning && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{progress.message}</span>
                  <span className="text-slate-500 font-mono text-xs">
                    {progress.current}/{progress.total}
                  </span>
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

          {/* Stage 1: Start Analysis + Image Generation */}
          {(currentStage === 'idle' || !pipelineRun) && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Stage 1: Analyze & Generate Images</h2>
              <p className="text-sm text-slate-600 mb-4">
                The LLM will analyze your chapter text, identify key visual moments, then generate images for each one.
                This runs the analysis and image generation together -- you review the results after.
              </p>
              <button
                onClick={handleStartAnalysis}
                disabled={!canAnalyze}
                className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isRunning ? 'Running...' : 'Start Analysis & Image Generation'}
              </button>
            </div>
          )}

          {/* Image Review */}
          {images.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {currentStage === 'images_review' ? 'Review Generated Images' : 'Generated Images'}
                </h2>
                {images.some((img) => img.animated_url) && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAnimated}
                      onChange={(e) => setShowAnimated(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    Show animated
                  </label>
                )}
              </div>
              <ImageReviewGrid images={images} showAnimated={showAnimated} />
            </div>
          )}

          {/* Stage 2: Animate */}
          {(currentStage === 'images_review' || currentStage === 'animation_review') && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Stage 2: Animate Images</h2>
              <p className="text-sm text-slate-600 mb-4">
                Each image will be animated with subtle motion described by the LLM -- glowing lights,
                swaying elements, flickering effects. One image at a time through ComfyUI.
              </p>
              {!settings?.comfyui_animation_workflow && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  No animation workflow configured. Import one in Settings to enable this stage.
                </p>
              )}
              <button
                onClick={handleRunAnimation}
                disabled={!canAnimate || !settings?.comfyui_animation_workflow}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isRunning ? 'Animating...' : 'Animate All Images'}
              </button>
            </div>
          )}

          {/* Stage 3: TTS */}
          {(currentStage === 'animation_review' || currentStage === 'tts_review') && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Stage 3: Generate TTS Audio</h2>
              <p className="text-sm text-slate-600 mb-4">
                The chapter text will be chunked and sent through the TTS workflow to create narration audio.
              </p>
              {!settings?.comfyui_tts_workflow && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  No TTS workflow configured. Import one in Settings.
                </p>
              )}
              <button
                onClick={handleRunTts}
                disabled={!canTts || !settings?.comfyui_tts_workflow}
                className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isRunning ? 'Generating TTS...' : 'Generate TTS Audio'}
              </button>

              {ttsChunks.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-slate-600">
                    {ttsChunks.filter((c) => c.status === 'completed').length} of {ttsChunks.length} TTS chunks completed.
                  </p>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${ttsChunks.length > 0 ? (ttsChunks.filter((c) => c.status === 'completed').length / ttsChunks.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage 4: Video Assembly */}
          {canAssemble && (currentStage === 'tts_review' || currentStage === 'video_review' || currentStage === 'generating_lipsync' || currentStage === 'lipsync_complete') && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Stage 4: Video Assembly Data</h2>
              <p className="text-sm text-slate-600 mb-4">
                Export the assembly data (image URLs, audio URLs, text anchors) as a JSON file.
                This contains everything needed to assemble the litRPG video externally --
                images timed to the correct story passages with the TTS audio.
              </p>
              <button
                onClick={handleAssemblyExport}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
              >
                Export Assembly Data
              </button>
            </div>
          )}

          {/* Stage 5: Lip-sync */}
          {hasCompletedTts && (currentStage === 'tts_review' || currentStage === 'video_review' || currentStage === 'generating_lipsync' || currentStage === 'lipsync_complete') && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Stage 5: Lip-sync Generation</h2>
              <p className="text-sm text-slate-600 mb-4">
                Select the character image to use as the lip-sync face. The system will take each TTS audio chunk
                and generate a lip-sync video of this character "reading" the text.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lip-sync Character Image URL
                </label>
                <input
                  type="text"
                  value={lipsyncImageUrl}
                  onChange={(e) => setLipsyncImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Paste the URL of the character image to use for lip-sync..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use a front-facing character image. Can be a ComfyUI /view URL or any accessible image URL.
                </p>
              </div>

              {lipsyncImageUrl && (
                <div className="mb-4 inline-block">
                  <img
                    src={lipsyncImageUrl}
                    alt="Lip-sync character"
                    className="w-32 h-32 object-cover rounded-lg border border-slate-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {!settings?.comfyui_lipsync_workflow && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  No lip-sync workflow configured. Import one in Settings.
                </p>
              )}

              <div>
                <button
                  onClick={handleRunLipsync}
                  disabled={!canLipsync || !settings?.comfyui_lipsync_workflow}
                  className="px-6 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {isRunning ? 'Generating Lip-sync...' : 'Generate Lip-sync Videos'}
                </button>
              </div>

              {lipsyncChunks.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Lip-sync Chunks</h3>
                  <LipsyncChunkList chunks={lipsyncChunks} />
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!pipelineRun && !isRunning && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 12 6 12.504 6 13.125" />
              </svg>
              <p className="text-slate-500 text-sm mb-2">No pipeline run yet for this chapter.</p>
              <p className="text-slate-400 text-xs">
                Click "Start Analysis & Image Generation" above to begin the production pipeline.
              </p>
            </div>
          )}
        </>
      )}

      {!selectedChapterId && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-slate-500 text-sm">
            Select a chapter to start the production pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
