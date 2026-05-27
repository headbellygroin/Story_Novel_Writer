import { waitUntilQueueFree, generateClientId } from './comfyuiService';
import { comfyProxyGet, comfyProxyPost, comfyProxyUpload, comfyProxyMediaUrl } from '../lib/proxyFetch';
import type { VideoResult } from './comfyuiAnimationService';
export type { VideoResult };

export type LipsyncOrientation = 'portrait' | 'landscape' | 'square';
export type LipsyncNoiseMode = 'random' | 'fixed';

export const LIPSYNC_DIMENSIONS: Record<LipsyncOrientation, { width: number; height: number }> = {
  portrait:  { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square:    { width: 1080, height: 1080 },
};

export interface ComfyUILipsyncSettings {
  endpoint: string;
  workflow: Record<string, unknown> | null;
  orientation?: LipsyncOrientation;
  noiseMode?: LipsyncNoiseMode;
  noiseSeed?: number;
}

interface QueueResponse {
  prompt_id: string;
}

interface HistoryOutput {
  gifs?: Array<{ filename: string; subfolder: string; type: string }>;
  images?: Array<{ filename: string; subfolder: string; type: string }>;
  videos?: Array<{ filename: string; subfolder: string; type: string }>;
}

interface HistoryEntry {
  outputs: Record<string, HistoryOutput>;
}

// ---------------------------------------------------------------------------
// File upload helpers
// ComfyUI LoadImage / LoadAudio nodes reference files by name inside the
// ComfyUI /input folder. We must upload blobs there before running the prompt.
// ---------------------------------------------------------------------------

async function uploadFileToComfyUI(
  endpoint: string,
  blob: Blob,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append('image', blob, filename);
  form.append('type', 'input');
  form.append('overwrite', 'true');

  const res = await comfyProxyUpload(endpoint, '/upload/image', form);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload ${filename} to ComfyUI: ${err}`);
  }

  const data = await res.json();
  return (data.name as string) || filename;
}

async function fetchAndUpload(
  endpoint: string,
  url: string,
  filename: string
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const blob = await res.blob();
  return uploadFileToComfyUI(endpoint, blob, filename);
}

// ---------------------------------------------------------------------------
// Audio duration helper
// We decode the audio blob in the browser to get its exact duration so the
// workflow Duration node matches the clip length.
// ---------------------------------------------------------------------------

async function getAudioDurationSeconds(audioUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
      audio.src = '';
    });
    audio.addEventListener('error', () => resolve(16)); // safe fallback
    audio.src = audioUrl;
  });
}

// ---------------------------------------------------------------------------
// Video output finder — checks SaveVideo node first, then any video file
// ---------------------------------------------------------------------------

const VIDEO_EXTS = ['.mp4', '.webm', '.gif', '.mkv'];

function findVideoOutput(entry: HistoryEntry, endpoint: string): VideoResult | null {
  for (const nodeOutput of Object.values(entry.outputs)) {
    const files = nodeOutput.gifs || nodeOutput.videos || nodeOutput.images;
    if (files && files.length > 0) {
      const file = files[0];
      if (VIDEO_EXTS.some((ext) => file.filename.endsWith(ext))) {
        const viewPath = `/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}`;
        return {
          comfyUrl: comfyProxyMediaUrl(endpoint, viewPath),
          filename: file.filename,
          subfolder: file.subfolder,
          type: file.type,
        };
      }
    }
  }
  for (const nodeOutput of Object.values(entry.outputs)) {
    const allFiles = [
      ...(nodeOutput.gifs || []),
      ...(nodeOutput.videos || []),
      ...(nodeOutput.images || []),
    ];
    if (allFiles.length > 0) {
      const file = allFiles[0];
      const viewPath = `/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}`;
      return {
        comfyUrl: comfyProxyMediaUrl(endpoint, viewPath),
        filename: file.filename,
        subfolder: file.subfolder,
        type: file.type,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Workflow preparation
//
// Fixed settings for the LTX 2.3 Portrait Lipsync workflow:
//   269        LoadImage         ← character image filename (after upload)
//   276        LoadAudio         ← audio filename (after upload)
//   340:319    PrimitiveStringMultiline "Prompt" ← scene description
//   340:331    PrimitiveFloat "Duration"  ← audio duration in seconds
//   340:330    PrimitiveInt "Width"       ← 1080 (portrait, fixed)
//   340:324    PrimitiveInt "Height"      ← 1920 (portrait, fixed)
//   340:323    PrimitiveInt "Frame Rate"  ← 30 (fixed)
// ---------------------------------------------------------------------------

function prepareLipsyncWorkflow(
  workflow: Record<string, unknown>,
  imageFilename: string,
  audioFilename: string,
  scenePrompt: string,
  audioDurationSeconds: number,
  orientation: LipsyncOrientation = 'portrait',
  noiseMode: LipsyncNoiseMode = 'random',
  noiseSeed = 42
): Record<string, unknown> {
  const w: Record<string, unknown> = JSON.parse(JSON.stringify(workflow));
  const { width, height } = LIPSYNC_DIMENSIONS[orientation];

  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId] as Record<string, unknown>;
    const classType = node.class_type as string;
    const inputs = (node.inputs || {}) as Record<string, unknown>;
    const title = ((node._meta as Record<string, unknown>)?.title as string) || '';

    switch (classType) {
      case 'LoadImage':
        inputs.image = imageFilename;
        node.inputs = inputs;
        break;

      case 'LoadAudio':
        inputs.audio = audioFilename;
        delete inputs.audioUI;
        node.inputs = inputs;
        break;

      case 'PrimitiveStringMultiline':
        if (title === 'Prompt') {
          inputs.value = scenePrompt;
          node.inputs = inputs;
        }
        break;

      case 'PrimitiveFloat':
        if (title === 'Duration') {
          inputs.value = Math.round(audioDurationSeconds * 100) / 100;
          node.inputs = inputs;
        }
        break;

      case 'PrimitiveInt':
        if (title === 'Width') {
          inputs.value = width;
          node.inputs = inputs;
        } else if (title === 'Height') {
          inputs.value = height;
          node.inputs = inputs;
        } else if (title === 'Frame Rate') {
          inputs.value = 30;
          node.inputs = inputs;
        }
        break;

      case 'RandomNoise':
        inputs.noise_seed = noiseMode === 'fixed'
          ? noiseSeed
          : Math.floor(Math.random() * 2 ** 32);
        node.inputs = inputs;
        break;
    }
  }

  return w;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildLipsyncPrompt(backgroundPrompt: string, characterPrompt: string): string {
  const parts: string[] = [];
  if (backgroundPrompt.trim()) parts.push(`Background: ${backgroundPrompt.trim()}`);
  if (characterPrompt.trim()) parts.push(`Character: ${characterPrompt.trim()}`);
  return parts.join('\n\n');
}

export async function generateLipsync(
  characterImageUrl: string,
  audioUrl: string,
  settings: ComfyUILipsyncSettings,
  scenePrompt = ''
): Promise<VideoResult> {
  const endpoint = settings.endpoint.replace(/\/$/, '');

  if (!settings.workflow) {
    throw new Error('No lip-sync workflow configured. Import a ComfyUI lip-sync workflow in Settings.');
  }

  await waitUntilQueueFree(endpoint);

  const imageExt = characterImageUrl.includes('.png') ? '.png' : '.jpg';
  const audioExt = audioUrl.includes('.wav') ? '.wav' : '.mp3';
  const imageFilename = `lipsync_character${imageExt}`;
  const audioFilename = `lipsync_audio${audioExt}`;

  const [uploadedImage, uploadedAudio, audioDuration] = await Promise.all([
    fetchAndUpload(endpoint, characterImageUrl, imageFilename),
    fetchAndUpload(endpoint, audioUrl, audioFilename),
    getAudioDurationSeconds(audioUrl),
  ]);

  const workflow = prepareLipsyncWorkflow(
    settings.workflow,
    uploadedImage,
    uploadedAudio,
    scenePrompt,
    audioDuration,
    settings.orientation ?? 'portrait',
    settings.noiseMode ?? 'random',
    settings.noiseSeed ?? 42
  );

  const clientId = generateClientId();
  const queueRes = await comfyProxyPost(endpoint, '/prompt', { prompt: workflow, client_id: clientId });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the lip-sync workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return pollForLipsyncResult(endpoint, prompt_id);
}

// ---------------------------------------------------------------------------
// Result polling via HTTP proxy
// ---------------------------------------------------------------------------

async function pollForLipsyncResult(endpoint: string, promptId: string): Promise<VideoResult> {
  const maxAttempts = 400;
  const pollInterval = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));
    try {
      const res = await comfyProxyGet(endpoint, `/history/${promptId}`);
      if (!res.ok) continue;
      const history: Record<string, HistoryEntry> = await res.json();
      const entry = history[promptId];
      if (!entry) continue;
      const result = findVideoOutput(entry, endpoint);
      if (result) return result;
    } catch {
      continue;
    }
  }
  throw new Error('Lip-sync generation timed out after 20 minutes');
}
