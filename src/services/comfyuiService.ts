export function generateClientId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export type ImageOrientation = 'portrait' | 'landscape' | 'square';
export type ImageNoiseMode = 'random' | 'fixed';

export const IMAGE_DIMENSIONS: Record<ImageOrientation, { width: number; height: number }> = {
  portrait:  { width: 768, height: 1024 },
  landscape: { width: 1024, height: 768 },
  square:    { width: 1024, height: 1024 },
};

export interface ComfyUISettings {
  endpoint: string;
  workflow: Record<string, unknown> | null;
  // User-facing generation options
  orientation?: ImageOrientation;
  noiseMode?: ImageNoiseMode;
  noiseSeed?: number;
  // Internal overrides (used by Story Forge automated generation, not user-initiated)
  batchSize?: number;
  // Legacy fields kept for fallback workflow compatibility
  checkpoint?: string;
  negativePrompt?: string;
}

interface QueueResponse {
  prompt_id: string;
}

interface HistoryOutput {
  images?: Array<{ filename: string; subfolder: string; type: string }>;
}

interface HistoryEntry {
  outputs: Record<string, HistoryOutput>;
  status?: { completed?: boolean };
}

// ---------------------------------------------------------------------------
// Workflow preparation
// ---------------------------------------------------------------------------

// Prepares the NetaYume workflow for submission. Story Forge only controls:
//   1. The "Prompt" PrimitiveStringMultiline node — scene description from user fields
//   2. EmptySD3LatentImage / EmptyLatentImage — width, height (from orientation), batch_size
//   3. KSampler seed — random or fixed
// Everything else (system prompts, negative prompt, checkpoint, steps, cfg, sampler)
// stays exactly as authored in the workflow JSON.
function prepareWorkflow(
  workflow: Record<string, unknown>,
  prompt: string,
  settings: ComfyUISettings
): Record<string, unknown> {
  const w: Record<string, unknown> = JSON.parse(JSON.stringify(workflow));

  const { width, height } = IMAGE_DIMENSIONS[settings.orientation ?? 'portrait'];
  const batchSize = settings.batchSize ?? 1;
  const seed = settings.noiseMode === 'fixed' && settings.noiseSeed != null
    ? settings.noiseSeed
    : Math.floor(Math.random() * 2 ** 32);

  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId] as Record<string, unknown>;
    const classType = node.class_type as string;
    const inputs = (node.inputs || {}) as Record<string, unknown>;
    const title = ((node._meta as Record<string, unknown>)?.title as string) || '';

    switch (classType) {
      case 'PrimitiveStringMultiline':
        if (title === 'Prompt') {
          inputs.value = prompt;
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
        }
        break;

      case 'KSampler':
      case 'KSamplerAdvanced':
        inputs.seed = seed;
        node.inputs = inputs;
        break;

      case 'RandomNoise':
        inputs.noise_seed = seed;
        node.inputs = inputs;
        break;

      case 'EmptyLatentImage':
      case 'EmptySD3LatentImage':
      case 'EmptyFlux2LatentImage':
        inputs.width = width;
        inputs.height = height;
        inputs.batch_size = batchSize;
        node.inputs = inputs;
        break;
    }
  }

  return w;
}

// ---------------------------------------------------------------------------
// Queue / connection helpers
// ---------------------------------------------------------------------------

export interface QueueStatus {
  queueRunning: number;
  queuePending: number;
  isBusy: boolean;
}

import { comfyProxyGet, comfyProxyPost, comfyProxyMediaUrl } from '../lib/proxyFetch';

export async function getQueueStatus(endpoint: string): Promise<QueueStatus> {
  try {
    const res = await comfyProxyGet(endpoint.replace(/\/$/, ''), '/queue');
    if (!res.ok) return { queueRunning: 0, queuePending: 0, isBusy: false };
    const data = await res.json();
    const running: unknown[] = data?.queue_running ?? [];
    const pending: unknown[] = data?.queue_pending ?? [];
    return {
      queueRunning: running.length,
      queuePending: pending.length,
      isBusy: running.length > 0 || pending.length > 0,
    };
  } catch {
    return { queueRunning: 0, queuePending: 0, isBusy: false };
  }
}

// Polls until the ComfyUI queue is empty before continuing, so Story Forge
// never submits a new job while one is already running.
export async function waitUntilQueueFree(endpoint: string, timeoutMs = 10 * 60 * 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getQueueStatus(endpoint);
    if (!status.isBusy) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for ComfyUI queue to become free');
}

export async function checkComfyUIConnection(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalizedEndpoint = endpoint.replace(/\/$/, '');
    const res = await comfyProxyGet(normalizedEndpoint, '/system_stats');
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Network error: ${errorMsg}` };
  }
}

export async function getAvailableCheckpoints(endpoint: string): Promise<string[]> {
  try {
    const res = await comfyProxyGet(endpoint, '/object_info/CheckpointLoaderSimple');
    if (!res.ok) return [];
    const data = await res.json();
    const inputs = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name;
    if (Array.isArray(inputs) && Array.isArray(inputs[0])) return inputs[0] as string[];
    return [];
  } catch {
    return [];
  }
}

export async function getAvailableSamplers(endpoint: string): Promise<string[]> {
  try {
    const res = await comfyProxyGet(endpoint, '/object_info/KSampler');
    if (!res.ok) return [];
    const data = await res.json();
    const inputs = data?.KSampler?.input?.required?.sampler_name;
    if (Array.isArray(inputs) && Array.isArray(inputs[0])) return inputs[0] as string[];
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

export function buildImagePrompt(
  background: string,
  foreground: string,
  characters: string
): string {
  const parts: string[] = [];
  if (background.trim()) parts.push(`Background: ${background.trim()}`);
  if (foreground.trim()) parts.push(`Foreground: ${foreground.trim()}`);
  if (characters.trim()) parts.push(`Characters: ${characters.trim()}`);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export interface ImageResult {
  comfyUrl: string;
  filename: string;
  subfolder: string;
  type: string;
}

export async function generateImage(
  prompt: string,
  settings: ComfyUISettings
): Promise<ImageResult> {
  const endpoint = settings.endpoint.replace(/\/$/, '');

  await waitUntilQueueFree(endpoint);

  if (!settings.workflow) {
    throw new Error('No image workflow configured. The NetaYume workflow JSON must be present.');
  }
  const workflow = prepareWorkflow(settings.workflow, prompt, settings);

  const clientId = generateClientId();
  const queueRes = await comfyProxyPost(endpoint, '/prompt', { prompt: workflow, client_id: clientId });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return pollForImageResult(endpoint, prompt_id);
}

// ---------------------------------------------------------------------------
// Result polling via HTTP (works through edge function proxy)
// ---------------------------------------------------------------------------

async function pollForImageResult(endpoint: string, promptId: string): Promise<ImageResult> {
  const maxAttempts = 120;
  const pollInterval = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));
    try {
      const res = await comfyProxyGet(endpoint, `/history/${promptId}`);
      if (!res.ok) continue;
      const history: Record<string, HistoryEntry> = await res.json();
      const entry = history[promptId];
      if (!entry) continue;
      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          const img = nodeOutput.images[0];
          const viewPath = `/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          return {
            comfyUrl: comfyProxyMediaUrl(endpoint, viewPath),
            filename: img.filename,
            subfolder: img.subfolder,
            type: img.type,
          };
        }
      }
    } catch {
      continue;
    }
  }

  throw new Error('Image generation timed out after 6 minutes');
}
