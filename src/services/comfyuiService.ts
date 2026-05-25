export type ImageOrientation = 'portrait' | 'landscape' | 'square';
export type ImageNoiseMode = 'random' | 'fixed';

export const IMAGE_DIMENSIONS: Record<ImageOrientation, { width: number; height: number }> = {
  portrait:  { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square:    { width: 1080, height: 1080 },
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

export async function getQueueStatus(endpoint: string): Promise<QueueStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/queue`, { signal: controller.signal });
    clearTimeout(timeoutId);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${normalizedEndpoint}/system_stats`, {
      signal: controller.signal,
      mode: 'cors',
    });
    clearTimeout(timeoutId);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('AbortError') || errorMsg.includes('abort')) {
      return { ok: false, error: 'Connection timeout (5s)' };
    }
    return { ok: false, error: `Network error: ${errorMsg}` };
  }
}

export async function getAvailableCheckpoints(endpoint: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${endpoint}/object_info/CheckpointLoaderSimple`, { signal: controller.signal });
    clearTimeout(timeoutId);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${endpoint}/object_info/KSampler`, { signal: controller.signal });
    clearTimeout(timeoutId);
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

  // Wait for any in-progress job to finish before submitting
  await waitUntilQueueFree(endpoint);

  if (!settings.workflow) {
    throw new Error('No image workflow configured. The NetaYume workflow JSON must be present.');
  }
  const workflow = prepareWorkflow(settings.workflow, prompt, settings);

  const clientId = crypto.randomUUID();
  const queueRes = await fetch(`${endpoint}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return waitForResultViaWebSocket(endpoint, prompt_id, clientId);
}

// ---------------------------------------------------------------------------
// Result polling — WebSocket with HTTP fallback
// ---------------------------------------------------------------------------

function waitForResultViaWebSocket(
  endpoint: string,
  promptId: string,
  clientId: string
): Promise<ImageResult> {
  return new Promise((resolve, reject) => {
    const wsUrl = endpoint.replace(/^http/, 'ws') + `/ws?clientId=${clientId}`;
    let ws: WebSocket;
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try { ws.close(); } catch { /* ignore */ }
    };

    const overallTimeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Image generation timed out after 5 minutes'));
      }
    }, 5 * 60 * 1000);

    const fetchResult = async (): Promise<ImageResult | null> => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${endpoint}/history/${promptId}`, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const history: Record<string, HistoryEntry> = await res.json();
        const entry = history[promptId];
        if (!entry) return null;
        for (const nodeOutput of Object.values(entry.outputs)) {
          if (nodeOutput.images && nodeOutput.images.length > 0) {
            const img = nodeOutput.images[0];
            return {
              comfyUrl: `${endpoint}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`,
              filename: img.filename,
              subfolder: img.subfolder,
              type: img.type,
            };
          }
        }
      } catch { /* ignore */ }
      return null;
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      clearTimeout(overallTimeout);
      pollFallback(endpoint, promptId).then(resolve).catch(reject);
      return;
    }

    ws.onopen = () => {};

    ws.onmessage = async (event) => {
      if (settled) return;
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '{}');

        if (msg.type === 'executing' && msg.data?.prompt_id === promptId && msg.data?.node === null) {
          await new Promise((r) => setTimeout(r, 300));
          const result = await fetchResult();
          if (result && !settled) {
            cleanup();
            clearTimeout(overallTimeout);
            resolve(result);
          }
        }

        if (msg.type === 'execution_error' && msg.data?.prompt_id === promptId) {
          cleanup();
          clearTimeout(overallTimeout);
          reject(new Error(msg.data?.exception_message || 'ComfyUI execution error'));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      if (settled) return;
      cleanup();
      clearTimeout(overallTimeout);
      pollFallback(endpoint, promptId).then(resolve).catch(reject);
    };

    ws.onclose = () => {
      if (settled) return;
      fallbackTimer = setTimeout(() => {
        if (!settled) {
          cleanup();
          clearTimeout(overallTimeout);
          pollFallback(endpoint, promptId).then(resolve).catch(reject);
        }
      }, 2000);
    };
  });
}

async function pollFallback(endpoint: string, promptId: string): Promise<ImageResult> {
  const maxAttempts = 120;
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
      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          const img = nodeOutput.images[0];
          return {
            comfyUrl: `${endpoint}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`,
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
