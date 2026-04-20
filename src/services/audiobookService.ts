import { ComfyUITtsSettings, generateTtsAudio } from './comfyuiTtsService';

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

export async function generateChunkAudio(
  chunk: TextChunk,
  ttsSettings: ComfyUITtsSettings,
  onProgress?: (chunkIndex: number, status: 'generating' | 'completed' | 'error') => void
): Promise<string> {
  onProgress?.(chunk.index, 'generating');
  try {
    const audioUrl = await generateTtsAudio(chunk.text, ttsSettings);
    onProgress?.(chunk.index, 'completed');
    return audioUrl;
  } catch (error) {
    onProgress?.(chunk.index, 'error');
    throw error;
  }
}
