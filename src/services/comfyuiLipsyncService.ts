import { waitUntilQueueFree } from './comfyuiService';

export interface ComfyUILipsyncSettings {
  endpoint: string;
  workflow: Record<string, unknown> | null;
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

  const res = await fetch(`${endpoint}/upload/image`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload ${filename} to ComfyUI: ${err}`);
  }

  const data = await res.json();
  return (data.name as string) || filename;
}

// Fetches a URL and uploads it to ComfyUI, returning the stored filename.
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

function findVideoOutput(entry: HistoryEntry, endpoint: string): string | null {
  for (const nodeOutput of Object.values(entry.outputs)) {
    const files = nodeOutput.gifs || nodeOutput.videos || nodeOutput.images;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.filename.endsWith('.mp4') ||
        file.filename.endsWith('.webm') ||
        file.filename.endsWith('.gif') ||
        file.filename.endsWith('.mkv')
      ) {
        return `${endpoint}/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}`;
      }
    }
  }
  // Fallback: return first available file from any output
  for (const nodeOutput of Object.values(entry.outputs)) {
    const allFiles = [
      ...(nodeOutput.gifs || []),
      ...(nodeOutput.videos || []),
      ...(nodeOutput.images || []),
    ];
    if (allFiles.length > 0) {
      const file = allFiles[0];
      return `${endpoint}/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}`;
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
  audioDurationSeconds: number
): Record<string, unknown> {
  const w: Record<string, unknown> = JSON.parse(JSON.stringify(workflow));

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
        // Clear the audioUI preview path — ComfyUI regenerates it
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
          // Round to 2 decimal places; ComfyUI uses this to trim/pad the audio
          inputs.value = Math.round(audioDurationSeconds * 100) / 100;
          node.inputs = inputs;
        }
        break;

      case 'PrimitiveInt':
        if (title === 'Width') {
          inputs.value = 1080;
          node.inputs = inputs;
        } else if (title === 'Height') {
          inputs.value = 1920;
          node.inputs = inputs;
        } else if (title === 'Frame Rate') {
          inputs.value = 30;
          node.inputs = inputs;
        }
        break;

      case 'RandomNoise':
        // Randomize seeds on every run
        inputs.noise_seed = Math.floor(Math.random() * 2 ** 32);
        node.inputs = inputs;
        break;
    }
  }

  return w;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateLipsync(
  characterImageUrl: string,
  audioUrl: string,
  settings: ComfyUILipsyncSettings,
  scenePrompt = ''
): Promise<string> {
  const endpoint = settings.endpoint.replace(/\/$/, '');

  if (!settings.workflow) {
    throw new Error('No lip-sync workflow configured. Import a ComfyUI lip-sync workflow in Settings.');
  }

  // Wait for ComfyUI to be free — it processes one job at a time
  await waitUntilQueueFree(endpoint);

  // Upload image and audio, get the duration in parallel
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
    audioDuration
  );

  const clientId = crypto.randomUUID();
  const queueRes = await fetch(`${endpoint}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the lip-sync workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return waitForLipsyncResult(endpoint, prompt_id, clientId);
}

// ---------------------------------------------------------------------------
// Result polling — WebSocket with HTTP fallback
// ---------------------------------------------------------------------------

function waitForLipsyncResult(
  endpoint: string,
  promptId: string,
  clientId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const wsUrl = endpoint.replace(/^http/, 'ws') + `/ws?clientId=${clientId}`;
    let ws: WebSocket;
    let settled = false;

    const cleanup = () => {
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
    };

    // LTX 2.3 at 1080x1920 can take a while
    const overallTimeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Lip-sync generation timed out after 20 minutes'));
      }
    }, 20 * 60 * 1000);

    const fetchResult = async (): Promise<string | null> => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${endpoint}/history/${promptId}`, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const history: Record<string, HistoryEntry> = await res.json();
        const entry = history[promptId];
        if (!entry) return null;
        return findVideoOutput(entry, endpoint);
      } catch {
        return null;
      }
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      clearTimeout(overallTimeout);
      pollLipsyncFallback(endpoint, promptId).then(resolve).catch(reject);
      return;
    }

    ws.onmessage = async (event) => {
      if (settled) return;
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
        if (msg.type === 'executing' && msg.data?.prompt_id === promptId && msg.data?.node === null) {
          await new Promise((r) => setTimeout(r, 500));
          const url = await fetchResult();
          if (url && !settled) {
            cleanup();
            clearTimeout(overallTimeout);
            resolve(url);
          }
        }
        if (msg.type === 'execution_error' && msg.data?.prompt_id === promptId) {
          cleanup();
          clearTimeout(overallTimeout);
          reject(new Error(msg.data?.exception_message || 'ComfyUI lip-sync execution error'));
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (settled) return;
      cleanup();
      clearTimeout(overallTimeout);
      pollLipsyncFallback(endpoint, promptId).then(resolve).catch(reject);
    };

    ws.onclose = () => {
      if (settled) return;
      setTimeout(() => {
        if (!settled) {
          cleanup();
          clearTimeout(overallTimeout);
          pollLipsyncFallback(endpoint, promptId).then(resolve).catch(reject);
        }
      }, 2000);
    };
  });
}

async function pollLipsyncFallback(endpoint: string, promptId: string): Promise<string> {
  const maxAttempts = 400;
  const pollInterval = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${endpoint}/history/${promptId}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const history: Record<string, HistoryEntry> = await res.json();
      const entry = history[promptId];
      if (!entry) continue;
      const url = findVideoOutput(entry, endpoint);
      if (url) return url;
    } catch {
      continue;
    }
  }
  throw new Error('Lip-sync generation timed out after 20 minutes');
}
