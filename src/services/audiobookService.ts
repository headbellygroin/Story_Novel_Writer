import { supabase } from '../lib/supabase';
import { ComfyUITtsSettings, TtsResult, generateTtsAudio } from './comfyuiTtsService';

export interface TextChunk {
  index: number;
  text: string;
  sceneId?: string;
  sceneTitle?: string;
}

const CHUNK_MAX_CHARS = 1000;
const CHUNK_MIN_CHARS = 100;

function splitAtSentenceBoundary(text: string, maxLen: number): [string, string] {
  if (text.length <= maxLen) return [text, ''];

  const sentenceEnders = /[.!?]["'\u201D\u2019)]*\s/g;
  let lastGoodBreak = -1;
  let match: RegExpExecArray | null;

  while ((match = sentenceEnders.exec(text)) !== null) {
    const endPos = match.index + match[0].length;
    if (endPos <= maxLen) {
      lastGoodBreak = endPos;
    } else {
      break;
    }
  }

  if (lastGoodBreak > CHUNK_MIN_CHARS) {
    return [text.slice(0, lastGoodBreak).trim(), text.slice(lastGoodBreak).trim()];
  }

  const paragraphBreak = text.lastIndexOf('\n\n', maxLen);
  if (paragraphBreak > CHUNK_MIN_CHARS) {
    return [text.slice(0, paragraphBreak).trim(), text.slice(paragraphBreak).trim()];
  }

  const lineBreak = text.lastIndexOf('\n', maxLen);
  if (lineBreak > CHUNK_MIN_CHARS) {
    return [text.slice(0, lineBreak).trim(), text.slice(lineBreak).trim()];
  }

  return [text.slice(0, maxLen).trim(), text.slice(maxLen).trim()];
}

export function chunkText(text: string, sceneId?: string, sceneTitle?: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let remaining = text.trim();
  let index = 0;

  while (remaining.length > 0) {
    const [chunk, rest] = splitAtSentenceBoundary(remaining, CHUNK_MAX_CHARS);
    if (chunk.length > 0) {
      chunks.push({ index, text: chunk, sceneId, sceneTitle });
      index++;
    }
    remaining = rest;
  }

  return chunks;
}

export interface ChapterForAudiobook {
  id: string;
  title: string;
  orderIndex: number;
  scenes: Array<{
    id: string;
    title: string;
    content: string;
    orderIndex: number;
  }>;
}

export function chunkChapter(chapter: ChapterForAudiobook): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  const sortedScenes = [...chapter.scenes].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const scene of sortedScenes) {
    if (!scene.content || scene.content.trim().length === 0) continue;

    const sceneChunks = chunkText(scene.content, scene.id, scene.title);
    for (const chunk of sceneChunks) {
      allChunks.push({ ...chunk, index: globalIndex });
      globalIndex++;
    }
  }

  return allChunks;
}

/**
 * Fetch the audio blob from ComfyUI and upload it to Supabase Storage.
 * Returns the public URL and the storage path.
 */
async function uploadAudioToStorage(
  result: TtsResult,
  projectId: string,
  chapterId: string,
  chunkIndex: number
): Promise<{ publicUrl: string; storagePath: string }> {
  const res = await fetch(result.audioUrl);
  if (!res.ok) throw new Error(`Failed to fetch audio from ComfyUI: ${res.status}`);

  const blob = await res.blob();
  const ext = result.filename.split('.').pop() || 'mp3';
  const storagePath = `${projectId}/${chapterId}/chunk_${String(chunkIndex).padStart(4, '0')}.${ext}`;

  const { error } = await supabase.storage
    .from('audiobook-audio')
    .upload(storagePath, blob, {
      contentType: blob.type || 'audio/mpeg',
      upsert: true,
    });

  if (error) throw new Error(`Supabase storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('audiobook-audio')
    .getPublicUrl(storagePath);

  return { publicUrl: urlData.publicUrl, storagePath };
}

export interface ChunkGenerationResult {
  audioUrl: string;
  storagePath: string;
  comfyuiFilename: string;
}

export async function generateChunkAudio(
  chunk: TextChunk,
  ttsSettings: ComfyUITtsSettings,
  projectId: string,
  chapterId: string,
  onProgress?: (chunkIndex: number, status: 'generating' | 'uploading' | 'completed' | 'error') => void
): Promise<ChunkGenerationResult> {
  onProgress?.(chunk.index, 'generating');

  let result: TtsResult;
  try {
    result = await generateTtsAudio(chunk.text, ttsSettings);
  } catch (error) {
    onProgress?.(chunk.index, 'error');
    throw error;
  }

  onProgress?.(chunk.index, 'uploading');
  try {
    const { publicUrl, storagePath } = await uploadAudioToStorage(
      result,
      projectId,
      chapterId,
      chunk.index
    );
    onProgress?.(chunk.index, 'completed');
    return { audioUrl: publicUrl, storagePath, comfyuiFilename: result.filename };
  } catch (uploadError) {
    // Fallback: use the ComfyUI URL directly if upload fails
    console.warn('Supabase upload failed, using ComfyUI URL directly:', uploadError);
    onProgress?.(chunk.index, 'completed');
    return { audioUrl: result.audioUrl, storagePath: '', comfyuiFilename: result.filename };
  }
}
