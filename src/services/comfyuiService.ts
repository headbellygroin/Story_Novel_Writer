export interface ComfyUISettings {
  endpoint: string;
  workflow: Record<string, unknown> | null;
  checkpoint: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: string;
  negativePrompt: string;
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

function buildDefaultWorkflow(
  prompt: string,
  negative: string,
  settings: ComfyUISettings
): Record<string, unknown> {
  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: settings.steps,
        cfg: settings.cfgScale,
        sampler_name: settings.sampler,
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: settings.checkpoint,
      },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: settings.width,
        height: settings.height,
        batch_size: 1,
      },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: prompt,
        clip: ['4', 1],
      },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negative,
        clip: ['4', 1],
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'novelist_scene',
        images: ['8', 0],
      },
    },
  };
}

function getNodeTitle(node: Record<string, unknown>): string {
  const meta = node._meta as Record<string, unknown> | undefined;
  return ((meta?.title as string) || '').toLowerCase();
}

function looksLikeNegativeContent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('bad quality') ||
    t.includes('worst quality') ||
    t.includes('blurry') ||
    t.includes('low quality') ||
    t.includes('deformed') ||
    t.includes('watermark')
  );
}

function injectPromptIntoWorkflow(
  workflow: Record<string, unknown>,
  prompt: string,
  negative: string,
  settings: ComfyUISettings
): Record<string, unknown> {
  const w = JSON.parse(JSON.stringify(workflow));

  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId] as Record<string, unknown>;
    const classType = node.class_type as string;
    const inputs = (node.inputs || {}) as Record<string, unknown>;
    const title = getNodeTitle(node);

    if (classType === 'PrimitiveStringMultiline') {
      const currentVal = (inputs.value as string) || (node.widgets_values as string[])?.[0] || '';
      const isNeg = title.includes('negative') || looksLikeNegativeContent(currentVal);
      const isSystemPrompt = title.includes('system') || currentVal.toLowerCase().includes('you are an assistant');
      const isPrompt = title === 'prompt' || title.includes('positive') || (!isNeg && !isSystemPrompt && currentVal.length > 0);

      if (isNeg) {
        if (inputs.value !== undefined) inputs.value = negative;
        if (Array.isArray(node.widgets_values)) (node.widgets_values as unknown[])[0] = negative;
      } else if (isPrompt) {
        if (inputs.value !== undefined) inputs.value = prompt;
        if (Array.isArray(node.widgets_values)) (node.widgets_values as unknown[])[0] = prompt;
      }
    }

    if (classType === 'CLIPTextEncode') {
      const currentText = typeof inputs.text === 'string' ? inputs.text : '';
      const isNeg = title.includes('negative') || looksLikeNegativeContent(currentText);
      const isSystemPrompt = title.includes('system') || currentText.toLowerCase().includes('you are an assistant');

      if (isNeg) {
        inputs.text = negative;
        if (Array.isArray(node.widgets_values)) (node.widgets_values as unknown[])[0] = negative;
      } else if (!isSystemPrompt) {
        inputs.text = prompt;
        if (Array.isArray(node.widgets_values)) (node.widgets_values as unknown[])[0] = prompt;
      }
    }

    if (classType === 'KSampler' || classType === 'KSamplerAdvanced') {
      inputs.seed = Math.floor(Math.random() * 2 ** 32);
      if (settings.steps) inputs.steps = settings.steps;
      if (settings.cfgScale) inputs.cfg = settings.cfgScale;
      if (settings.sampler) inputs.sampler_name = settings.sampler;
    }

    if (classType === 'EmptyLatentImage' || classType === 'EmptySD3LatentImage') {
      inputs.width = settings.width;
      inputs.height = settings.height;
    }

    if (classType === 'CheckpointLoaderSimple' && settings.checkpoint) {
      inputs.ckpt_name = settings.checkpoint;
    }
  }

  return w;
}

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

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('AbortError')) {
      return { ok: false, error: 'Connection timeout (5s)' };
    }
    if (errorMsg.includes('fetch')) {
      return { ok: false, error: `Network error: ${errorMsg}` };
    }
    return { ok: false, error: errorMsg };
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
    if (Array.isArray(inputs) && Array.isArray(inputs[0])) {
      return inputs[0] as string[];
    }
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
    if (Array.isArray(inputs) && Array.isArray(inputs[0])) {
      return inputs[0] as string[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function generateImage(
  prompt: string,
  settings: ComfyUISettings
): Promise<string> {
  const endpoint = settings.endpoint.replace(/\/$/, '');
  const negative = settings.negativePrompt;

  let workflow: Record<string, unknown>;
  if (settings.workflow) {
    workflow = injectPromptIntoWorkflow(settings.workflow, prompt, negative, settings);
  } else {
    if (!settings.checkpoint) {
      throw new Error('No checkpoint model configured. Please set a checkpoint in Settings.');
    }
    workflow = buildDefaultWorkflow(prompt, negative, settings);
  }

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

  const imageUrl = await waitForResultViaWebSocket(endpoint, prompt_id, clientId);
  return imageUrl;
}

function waitForResultViaWebSocket(
  endpoint: string,
  promptId: string,
  clientId: string
): Promise<string> {
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

    const timeoutMs = 5 * 60 * 1000;
    const overallTimeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Image generation timed out after 5 minutes'));
      }
    }, timeoutMs);

    const fetchResult = async () => {
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
            return `${endpoint}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          }
        }
      } catch { /* ignore fetch errors */ }
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

async function pollFallback(endpoint: string, promptId: string): Promise<string> {
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
          return `${endpoint}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
        }
      }
    } catch {
      continue;
    }
  }

  throw new Error('Image generation timed out after 6 minutes');
}
