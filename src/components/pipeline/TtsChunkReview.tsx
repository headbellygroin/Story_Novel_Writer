import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { generateChunkAudio, TextChunk } from '../../services/audiobookService';
import { ComfyUITtsSettings } from '../../services/comfyuiTtsService';
import { Database } from '../../lib/database.types';

type TtsChunk = Database['public']['Tables']['tts_chunks']['Row'];

interface TtsChunkReviewProps {
  chunks: TtsChunk[];
  ttsSettings: ComfyUITtsSettings;
  projectId: string;
  chapterId: string;
  onChunkUpdated: () => void;
}

export default function TtsChunkReview({
  chunks,
  ttsSettings,
  projectId,
  chapterId,
  onChunkUpdated,
}: TtsChunkReviewProps) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handlePlay(chunk: TtsChunk) {
    if (!chunk.audio_url) return;

    if (playingIndex === chunk.chunk_index) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingIndex(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(chunk.audio_url);
    audio.onended = () => {
      setPlayingIndex(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingIndex(null);
      audioRef.current = null;
    };
    audioRef.current = audio;
    audio.play();
    setPlayingIndex(chunk.chunk_index);
  }

  function handleStartEdit(chunk: TtsChunk) {
    setEditingIndex(chunk.chunk_index);
    setEditText(chunk.text_content);
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setEditText('');
  }

  async function handleRegenerate(chunk: TtsChunk) {
    const textToUse = editingIndex === chunk.chunk_index ? editText : chunk.text_content;
    if (!textToUse.trim()) return;

    setRegeneratingIndex(chunk.chunk_index);

    try {
      const textChunk: TextChunk = {
        index: chunk.chunk_index,
        text: textToUse.trim(),
      };

      const result = await generateChunkAudio(textChunk, ttsSettings, projectId, chapterId);

      await supabase
        .from('tts_chunks')
        .update({
          text_content: textToUse.trim(),
          audio_url: result.audioUrl,
          status: 'completed',
        })
        .eq('id', chunk.id);

      setEditingIndex(null);
      setEditText('');
      onChunkUpdated();
    } catch (err) {
      console.error('Failed to regenerate chunk:', err);
      alert(`Failed to regenerate chunk ${chunk.chunk_index + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRegeneratingIndex(null);
    }
  }

  if (chunks.length === 0) return null;

  const completedChunks = chunks.filter((c) => c.status === 'completed');

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          TTS Chunks
          <span className="ml-2 font-normal text-slate-500">
            ({completedChunks.length}/{chunks.length} complete)
          </span>
        </h3>
        <p className="text-xs text-slate-400">Click text to edit, then regenerate to fix pronunciation</p>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {chunks.map((chunk) => {
          const isPlaying = playingIndex === chunk.chunk_index;
          const isEditing = editingIndex === chunk.chunk_index;
          const isRegenerating = regeneratingIndex === chunk.chunk_index;
          const isCompleted = chunk.status === 'completed';

          return (
            <div
              key={chunk.id}
              className={`border rounded-lg p-3 transition-colors ${
                isRegenerating
                  ? 'border-orange-300 bg-orange-50'
                  : isEditing
                  ? 'border-sky-300 bg-sky-50'
                  : isCompleted
                  ? 'border-slate-200 bg-white'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Chunk number */}
                <span className="text-xs font-mono text-slate-400 mt-1 flex-shrink-0 w-6 text-right">
                  {String(chunk.chunk_index + 1).padStart(2, '0')}
                </span>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 border border-sky-300 rounded text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-y"
                      disabled={isRegenerating}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(chunk)}
                      className="text-left text-sm text-slate-700 leading-relaxed hover:bg-slate-50 rounded px-1 -mx-1 transition-colors w-full"
                      title="Click to edit text"
                    >
                      <span className="line-clamp-3">{chunk.text_content}</span>
                    </button>
                  )}

                  {/* Character count */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">
                      {(isEditing ? editText : chunk.text_content).length} chars
                    </span>
                    {chunk.duration_seconds && (
                      <span className="text-xs text-slate-400">
                        {Math.round(chunk.duration_seconds)}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Play/Stop */}
                  {isCompleted && chunk.audio_url && (
                    <button
                      onClick={() => handlePlay(chunk)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isPlaying
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={isPlaying ? 'Stop' : 'Play'}
                    >
                      {isPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="5" width="4" height="14" rx="1" />
                          <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Edit cancel */}
                  {isEditing && !isRegenerating && (
                    <button
                      onClick={handleCancelEdit}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
                      title="Cancel edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {/* Regenerate */}
                  {isEditing && (
                    <button
                      onClick={() => handleRegenerate(chunk)}
                      disabled={isRegenerating || !editText.trim()}
                      className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      title="Regenerate audio with edited text"
                    >
                      {isRegenerating ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                          </svg>
                          <span>Regenerating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          <span>Regenerate</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Quick redo button when not editing */}
                  {!isEditing && isCompleted && (
                    <button
                      onClick={() => handleStartEdit(chunk)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-colors"
                      title="Edit text to fix pronunciation"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                      </svg>
                    </button>
                  )}

                  {/* Status indicator */}
                  {!isCompleted && !isRegenerating && (
                    <span className="text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-100 rounded">
                      {chunk.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
