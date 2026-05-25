import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import { ChapterForAudiobook, chunkChapter, TextChunk, generateChunkAudio } from '../services/audiobookService';
import { ComfyUITtsSettings } from '../services/comfyuiTtsService';

type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];
type TtsChunk = Database['public']['Tables']['tts_chunks']['Row'];

interface ChapterOption {
  id: string;
  title: string;
  order_index: number;
}

const KOKORO_SPEAKERS = [
  { value: 'af_sarah', label: 'Sarah (Female)' },
  { value: 'af_bella', label: 'Bella (Female)' },
  { value: 'af_nicole', label: 'Nicole (Female)' },
  { value: 'af_sky', label: 'Sky (Female)' },
  { value: 'am_adam', label: 'Adam (Male)' },
  { value: 'am_michael', label: 'Michael (Male)' },
  { value: 'bf_emma', label: 'Emma (Female, British)' },
  { value: 'bf_isabella', label: 'Isabella (Female, British)' },
  { value: 'bm_george', label: 'George (Male, British)' },
  { value: 'bm_lewis', label: 'Lewis (Male, British)' },
];

type ChunkStatus = 'pending' | 'generating' | 'uploading' | 'completed' | 'error';

export default function Audiobook() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [chunkStatuses, setChunkStatuses] = useState<Record<number, ChunkStatus>>({});
  const [chunkAudioUrls, setChunkAudioUrls] = useState<Record<number, string>>({});
  const [, setSavedChunks] = useState<TtsChunk[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [speaker, setSpeaker] = useState('af_sarah');
  const [speed, setSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (currentProjectId) {
      loadSettings();
      if (currentOutlineId) loadChapters();
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => {
    if (selectedChapterId) loadExistingChunks();
  }, [selectedChapterId]);

  // Sync speaker from settings default when settings load
  useEffect(() => {
    if (settings?.comfyui_tts_speaker) {
      setSpeaker(settings.comfyui_tts_speaker as string);
    }
  }, [settings]);

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

  async function loadChapters() {
    if (!currentOutlineId) return;
    const { data } = await supabase
      .from('chapters')
      .select('id, title, order_index')
      .eq('outline_id', currentOutlineId)
      .order('order_index');
    if (data) setChapters(data);
  }

  async function loadExistingChunks() {
    if (!currentProjectId || !selectedChapterId) return;
    const { data } = await supabase
      .from('tts_chunks')
      .select('*')
      .eq('project_id', currentProjectId)
      .eq('chapter_id', selectedChapterId)
      .order('chunk_index');
    if (data && data.length > 0) {
      setSavedChunks(data);
      const statuses: Record<number, ChunkStatus> = {};
      const urls: Record<number, string> = {};
      const textChunks: TextChunk[] = [];
      data.forEach((c) => {
        statuses[c.chunk_index] = c.status as ChunkStatus;
        if (c.audio_url) urls[c.chunk_index] = c.audio_url;
        textChunks.push({ index: c.chunk_index, text: c.text_content || '' });
      });
      setChunks(textChunks);
      setChunkStatuses(statuses);
      setChunkAudioUrls(urls);
    }
  }

  async function handlePrepareChunks() {
    if (!selectedChapterId) return;

    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, title, content, order_index')
      .eq('chapter_id', selectedChapterId)
      .order('order_index');

    if (!scenes || scenes.length === 0) {
      alert('No scenes with content found in this chapter.');
      return;
    }

    const chapter = chapters.find((c) => c.id === selectedChapterId);
    if (!chapter) return;

    const chapterData: ChapterForAudiobook = {
      id: chapter.id,
      title: chapter.title,
      orderIndex: chapter.order_index,
      scenes: scenes.map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content || '',
        orderIndex: s.order_index,
      })),
    };

    const textChunks = chunkChapter(chapterData);
    setChunks(textChunks);
    const statuses: Record<number, ChunkStatus> = {};
    textChunks.forEach((c) => { statuses[c.index] = 'pending'; });
    setChunkStatuses(statuses);
    setChunkAudioUrls({});
  }

  function getTtsSettings(): ComfyUITtsSettings | null {
    if (!settings?.comfyui_endpoint) return null;
    return {
      endpoint: (settings.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings.comfyui_tts_workflow as Record<string, unknown>) || null,
      speaker,
      speed,
      sampleRate: (settings.comfyui_tts_sample_rate as number) || 24000,
    };
  }

  async function handleGenerateAll() {
    const ttsSettings = getTtsSettings();
    if (!ttsSettings) { alert('ComfyUI endpoint not configured. Set it up in Settings.'); return; }
    if (!ttsSettings.workflow) { alert('No TTS workflow configured. Import a ComfyUI TTS workflow in Settings.'); return; }

    setIsGenerating(true);
    abortRef.current = false;

    for (const chunk of chunks) {
      if (abortRef.current) break;
      if (chunkStatuses[chunk.index] === 'completed') continue;

      setCurrentChunkIndex(chunk.index);

      try {
        const result = await generateChunkAudio(
          chunk,
          ttsSettings,
          currentProjectId!,
          selectedChapterId,
          (idx, status) => setChunkStatuses((prev) => ({ ...prev, [idx]: status }))
        );

        setChunkAudioUrls((prev) => ({ ...prev, [chunk.index]: result.audioUrl }));

        await supabase.from('tts_chunks').upsert({
          project_id: currentProjectId!,
          chapter_id: selectedChapterId,
          scene_id: chunk.sceneId || null,
          chunk_index: chunk.index,
          text_content: chunk.text,
          audio_url: result.audioUrl,
          supabase_storage_path: result.storagePath,
          comfyui_filename: result.comfyuiFilename,
          speaker,
          status: 'completed',
        }, { onConflict: 'project_id,chapter_id,chunk_index', ignoreDuplicates: false });
      } catch (err) {
        console.error(`Error generating chunk ${chunk.index}:`, err);
        setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'error' }));
      }
    }

    setIsGenerating(false);
    setCurrentChunkIndex(null);
  }

  function handleStopGeneration() {
    abortRef.current = true;
    setIsGenerating(false);
    setCurrentChunkIndex(null);
  }

  async function handleGenerateSingle(chunk: TextChunk) {
    const ttsSettings = getTtsSettings();
    if (!ttsSettings || !ttsSettings.workflow) { alert('TTS workflow not configured.'); return; }

    setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'generating' }));

    try {
      const result = await generateChunkAudio(
        chunk,
        ttsSettings,
        currentProjectId!,
        selectedChapterId,
        (idx, status) => setChunkStatuses((prev) => ({ ...prev, [idx]: status }))
      );

      setChunkAudioUrls((prev) => ({ ...prev, [chunk.index]: result.audioUrl }));

      await supabase.from('tts_chunks').upsert({
        project_id: currentProjectId!,
        chapter_id: selectedChapterId,
        scene_id: chunk.sceneId || null,
        chunk_index: chunk.index,
        text_content: chunk.text,
        audio_url: result.audioUrl,
        supabase_storage_path: result.storagePath,
        comfyui_filename: result.comfyuiFilename,
        speaker,
        status: 'completed',
      }, { onConflict: 'project_id,chapter_id,chunk_index', ignoreDuplicates: false });
    } catch (err) {
      console.error(`Error generating chunk ${chunk.index}:`, err);
      setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'error' }));
    }
  }

  function playChunk(index: number) {
    const url = chunkAudioUrls[index];
    if (!url) return;
    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingIndex(index);
    audio.onended = () => {
      setPlayingIndex(null);
      const nextIndex = index + 1;
      if (chunkAudioUrls[nextIndex]) playChunk(nextIndex);
    };
    audio.play();
  }

  function stopPlayback() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingIndex(null);
  }

  function playAll() {
    const first = chunks.find((c) => chunkAudioUrls[c.index]);
    if (first) playChunk(first.index);
  }

  async function downloadAll() {
    const completedChunks = chunks
      .filter((c) => chunkAudioUrls[c.index])
      .sort((a, b) => a.index - b.index);

    for (const chunk of completedChunks) {
      const url = chunkAudioUrls[chunk.index];
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chunk_${String(chunk.index + 1).padStart(4, '0')}.mp3`;
      a.click();
      URL.revokeObjectURL(a.href);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const completedCount = Object.values(chunkStatuses).filter((s) => s === 'completed').length;
  const totalCount = chunks.length;
  const hasWorkflow = !!settings?.comfyui_tts_workflow;

  function statusLabel(status: ChunkStatus): string {
    if (status === 'generating') return 'Generating...';
    if (status === 'uploading') return 'Uploading...';
    return status;
  }

  function statusColors(status: ChunkStatus, isPlaying: boolean): string {
    if (isPlaying) return 'border-emerald-400 bg-emerald-50';
    if (status === 'completed') return 'border-emerald-200';
    if (status === 'generating' || status === 'uploading') return 'border-sky-300 bg-sky-50';
    if (status === 'error') return 'border-red-200 bg-red-50';
    return 'border-slate-200';
  }

  function badgeColors(status: ChunkStatus): string {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'generating' || status === 'uploading') return 'bg-sky-100 text-sky-700';
    if (status === 'error') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
  }

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Audiobook Generator</h1>
        <ProjectSelector />
      </div>

      {/* Chapter + voice controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chapter</label>
            <select
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setChunks([]);
                setChunkStatuses({});
                setChunkAudioUrls({});
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            >
              <option value="">Choose a chapter...</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>Ch. {c.order_index + 1}: {c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Voice</label>
            <select
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            >
              {KOKORO_SPEAKERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
              <option value={speaker}>{KOKORO_SPEAKERS.find(s => s.value === speaker) ? '' : speaker}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Speed: {speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-sky-600"
            />
          </div>

          <button
            onClick={handlePrepareChunks}
            disabled={!selectedChapterId}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Prepare Chunks
          </button>
        </div>

        {!hasWorkflow && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              No TTS workflow configured. Import your ComfyUI Kokoro TTS workflow in Settings to enable audio generation.
            </p>
          </div>
        )}
      </div>

      {/* Progress bar + action buttons */}
      {chunks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-600 mb-1">
                {completedCount} / {totalCount} chunks generated
              </p>
              <div className="w-full sm:w-56 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {completedCount > 0 && (
                <>
                  {playingIndex !== null ? (
                    <button onClick={stopPlayback}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
                      Stop
                    </button>
                  ) : (
                    <button onClick={playAll}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors">
                      Play All
                    </button>
                  )}
                  <button onClick={downloadAll}
                    className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors">
                    Download All
                  </button>
                </>
              )}

              {isGenerating ? (
                <button onClick={handleStopGeneration}
                  className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
                  Stop Generation
                </button>
              ) : (
                <button
                  onClick={handleGenerateAll}
                  disabled={!hasWorkflow}
                  className="px-4 py-1.5 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
                >
                  {completedCount > 0 && completedCount < totalCount ? 'Resume Generation' : 'Generate All'}
                </button>
              )}
            </div>
          </div>

          {isGenerating && currentChunkIndex !== null && (
            <p className="text-xs text-sky-600 mt-2">
              Processing chunk {currentChunkIndex + 1} of {totalCount}...
            </p>
          )}
        </div>
      )}

      {/* Chunk list */}
      {chunks.length > 0 && (
        <div className="space-y-3">
          {chunks.map((chunk) => {
            const status = chunkStatuses[chunk.index] || 'pending';
            const audioUrl = chunkAudioUrls[chunk.index];
            const isPlaying = playingIndex === chunk.index;
            const isActive = status === 'generating' || status === 'uploading';

            return (
              <div
                key={chunk.index}
                className={`bg-white rounded-xl shadow-sm border p-4 transition-colors ${statusColors(status, isPlaying)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        #{String(chunk.index + 1).padStart(3, '0')}
                      </span>
                      {chunk.sceneTitle && (
                        <span className="text-xs text-slate-400">{chunk.sceneTitle}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors(status)}`}>
                        {statusLabel(status)}
                      </span>
                      <span className="text-xs text-slate-400">{chunk.text.length} chars</span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">{chunk.text}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {audioUrl && (
                      <button
                        onClick={() => isPlaying ? stopPlayback() : playChunk(chunk.index)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isPlaying
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                        title={isPlaying ? 'Stop' : 'Play'}
                      >
                        {isPlaying ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 6h12v12H6z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    )}

                    {!isActive && (
                      <button
                        onClick={() => handleGenerateSingle(chunk)}
                        disabled={isGenerating || !hasWorkflow}
                        className="px-3 py-1.5 text-xs bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 disabled:opacity-50 transition-colors"
                      >
                        {status === 'completed' ? 'Redo' : 'Generate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chunks.length === 0 && selectedChapterId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          <p className="text-slate-500 text-sm">
            Click "Prepare Chunks" to split the chapter into audio-ready segments (~800 chars each).
          </p>
        </div>
      )}
    </div>
  );
}
