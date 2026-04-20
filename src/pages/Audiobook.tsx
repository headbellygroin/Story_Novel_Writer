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

export default function Audiobook() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [chunkStatuses, setChunkStatuses] = useState<Record<number, 'pending' | 'generating' | 'completed' | 'error'>>({});
  const [chunkAudioUrls, setChunkAudioUrls] = useState<Record<number, string>>({});
  const [, setSavedChunks] = useState<TtsChunk[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      loadSettings();
      if (currentOutlineId) loadChapters();
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => {
    if (selectedChapterId) {
      loadExistingChunks();
    }
  }, [selectedChapterId]);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('generation_settings')
        .select('*')
        .eq('project_id', currentProjectId!)
        .maybeSingle();
      setSettings(data);
    } catch (err) {
      console.error('Error loading settings:', err);
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
    if (data) {
      setSavedChunks(data);
      const statuses: Record<number, 'pending' | 'generating' | 'completed' | 'error'> = {};
      const urls: Record<number, string> = {};
      data.forEach((c) => {
        statuses[c.chunk_index] = c.status as 'pending' | 'generating' | 'completed' | 'error';
        if (c.audio_url) urls[c.chunk_index] = c.audio_url;
      });
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

    const statuses: Record<number, 'pending'> = {};
    textChunks.forEach((c) => { statuses[c.index] = 'pending'; });
    setChunkStatuses(statuses);
    setChunkAudioUrls({});
  }

  function getTtsSettings(): ComfyUITtsSettings | null {
    if (!settings?.comfyui_endpoint) return null;
    return {
      endpoint: (settings.comfyui_endpoint as string) || 'http://127.0.0.1:8188',
      workflow: (settings.comfyui_tts_workflow as Record<string, unknown>) || null,
      speaker: (settings.comfyui_tts_speaker as string) || '',
      sampleRate: (settings.comfyui_tts_sample_rate as number) || 24000,
    };
  }

  async function handleGenerateAll() {
    const ttsSettings = getTtsSettings();
    if (!ttsSettings) {
      alert('ComfyUI endpoint not configured. Set it up in Settings.');
      return;
    }
    if (!ttsSettings.workflow) {
      alert('No TTS workflow configured. Import a ComfyUI TTS workflow in Settings.');
      return;
    }

    setIsGenerating(true);

    for (const chunk of chunks) {
      if (chunkStatuses[chunk.index] === 'completed') continue;

      setCurrentChunkIndex(chunk.index);
      setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'generating' }));

      try {
        const audioUrl = await generateChunkAudio(chunk, ttsSettings);
        setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'completed' }));
        setChunkAudioUrls((prev) => ({ ...prev, [chunk.index]: audioUrl }));

        await supabase.from('tts_chunks').upsert({
          project_id: currentProjectId!,
          chapter_id: selectedChapterId,
          scene_id: chunk.sceneId || null,
          chunk_index: chunk.index,
          text_content: chunk.text,
          audio_url: audioUrl,
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

  async function handleGenerateSingle(chunk: TextChunk) {
    const ttsSettings = getTtsSettings();
    if (!ttsSettings || !ttsSettings.workflow) {
      alert('TTS workflow not configured.');
      return;
    }

    setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'generating' }));

    try {
      const audioUrl = await generateChunkAudio(chunk, ttsSettings);
      setChunkStatuses((prev) => ({ ...prev, [chunk.index]: 'completed' }));
      setChunkAudioUrls((prev) => ({ ...prev, [chunk.index]: audioUrl }));

      await supabase.from('tts_chunks').upsert({
        project_id: currentProjectId!,
        chapter_id: selectedChapterId,
        scene_id: chunk.sceneId || null,
        chunk_index: chunk.index,
        text_content: chunk.text,
        audio_url: audioUrl,
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

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingIndex(index);

    audio.onended = () => {
      setPlayingIndex(null);
      const nextIndex = index + 1;
      if (chunkAudioUrls[nextIndex]) {
        playChunk(nextIndex);
      }
    };

    audio.play();
  }

  function stopPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingIndex(null);
  }

  function playAll() {
    const firstCompleted = chunks.find((c) => chunkAudioUrls[c.index]);
    if (firstCompleted) playChunk(firstCompleted.index);
  }

  const completedCount = Object.values(chunkStatuses).filter((s) => s === 'completed').length;
  const totalCount = chunks.length;

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

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Chapter</label>
            <select
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setChunks([]);
                setChunkStatuses({});
                setChunkAudioUrls({});
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

          <button
            onClick={handlePrepareChunks}
            disabled={!selectedChapterId}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Prepare Chunks
          </button>
        </div>

        {!settings?.comfyui_tts_workflow && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              No TTS workflow configured. Import your ComfyUI TTS workflow in Settings to enable audio generation.
              You can still prepare and preview text chunks.
            </p>
          </div>
        )}
      </div>

      {chunks.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-600">
                  {totalCount} chunks prepared | {completedCount} generated
                </span>
                {totalCount > 0 && (
                  <div className="mt-1 w-48 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {completedCount > 0 && (
                  <>
                    {playingIndex !== null ? (
                      <button
                        onClick={stopPlayback}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Stop Playback
                      </button>
                    ) : (
                      <button
                        onClick={playAll}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Play All
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={handleGenerateAll}
                  disabled={isGenerating || !settings?.comfyui_tts_workflow}
                  className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? `Generating ${currentChunkIndex !== null ? currentChunkIndex + 1 : ''}/${totalCount}...` : 'Generate All Audio'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {chunks.map((chunk) => {
              const status = chunkStatuses[chunk.index] || 'pending';
              const audioUrl = chunkAudioUrls[chunk.index];
              const isPlaying = playingIndex === chunk.index;

              return (
                <div
                  key={chunk.index}
                  className={`bg-white rounded-lg shadow-sm border p-4 transition-colors ${
                    isPlaying ? 'border-emerald-400 bg-emerald-50' :
                    status === 'completed' ? 'border-emerald-200' :
                    status === 'generating' ? 'border-sky-300 bg-sky-50' :
                    status === 'error' ? 'border-red-200 bg-red-50' :
                    'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-500">Chunk {chunk.index + 1}</span>
                        {chunk.sceneTitle && (
                          <span className="text-xs text-slate-400">| {chunk.sceneTitle}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          status === 'generating' ? 'bg-sky-100 text-sky-700' :
                          status === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {status === 'generating' ? 'Generating...' : status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-3">{chunk.text}</p>
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
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 6h12v12H6z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                      )}

                      {status !== 'generating' && (
                        <button
                          onClick={() => handleGenerateSingle(chunk)}
                          disabled={isGenerating || !settings?.comfyui_tts_workflow}
                          className="px-3 py-1.5 text-xs bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 disabled:opacity-50 transition-colors"
                          title={status === 'completed' ? 'Regenerate' : 'Generate'}
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
        </>
      )}

      {chunks.length === 0 && selectedChapterId && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          <p className="text-slate-500 text-sm">
            Click "Prepare Chunks" to split the chapter text into audio-ready segments.
          </p>
        </div>
      )}
    </div>
  );
}
