export type AnimationOrientation = 'portrait' | 'landscape' | 'square';
export type AnimationNoiseMode = 'random' | 'fixed';

export const ANIMATION_DIMENSIONS: Record<AnimationOrientation, { width: number; height: number }> = {
  portrait:  { width: 768,  height: 1344 },
  landscape: { width: 1344, height: 768  },
  square:    { width: 1024, height: 1024 },
};

export interface ComfyUIAnimationSettings {
  endpoint: string;
  workflow: Record<string, unknown> | null;
  orientation?: AnimationOrientation;
  noiseMode?: AnimationNoiseMode;
  noiseSeed?: number;
}

export function buildAnimationPrompt(describeImage: string, whatToAnimate: string): string {
  const parts: string[] = [];
  if (describeImage.trim()) parts.push(`Describe the image: ${describeImage.trim()}`);
  if (whatToAnimate.trim()) parts.push(`What needs to be animated: ${whatToAnimate.trim()}`);
  return parts.join('\n\n');
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

function findVideoOutput(entry: HistoryEntry, endpoint: string): string | null {
  for (const nodeOutput of Object.values(entry.outputs)) {
    const files = nodeOutput.gifs || nodeOutput.videos || nodeOutput.images;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.filename.endsWith('.gif') ||
        file.filename.endsWith('.mp4') ||
        file.filename.endsWith('.webm') ||
        file.filename.endsWith('.webp')
      ) {
        return `${endpoint}/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}`;
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
      return `${endpoint}/view?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}`;
    }
  }
  return null;
}

// Injects user-controlled parameters into the LTX 2.3 Text2Video workflow.
// Story Forge controls:
//   - LoadImage.image          — source image filename/url
//   - PrimitiveStringMultiline titled "Prompt" — assembled description + animation text
//   - PrimitiveInt titled "Width" / "Height" — from orientation
//   - RandomNoise node with the higher seed value — main generation seed
// Everything else (sigmas, loras, sampler, cfg, fps, length) is fixed in the workflow.
function injectAnimationParams(
  workflow: Record<string, unknown>,
  imageUrl: string,
  prompt: string,
  settings: ComfyUIAnimationSettings
): Record<string, unknown> {
  const w: Record<string, unknown> = JSON.parse(JSON.stringify(workflow));

  const { width, height } = ANIMATION_DIMENSIONS[settings.orientation ?? 'portrait'];
  const seed = settings.noiseMode === 'fixed' && settings.noiseSeed != null
    ? settings.noiseSeed
    : Math.floor(Math.random() * 2 ** 32);

  // Find the two RandomNoise nodes — inject seed into the one that drives the main
  // SamplerCustomAdvanced (the distilled-lora pass, node 267:237 in reference workflow).
  // We identify it as the RandomNoise node with the larger default seed value, since
  // the secondary one (node 267:216) uses seed 42 for the audio pass.
  let maxSeedNodeId: string | null = null;
  let maxSeedVal = -1;
  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId] as Record<string, unknown>;
    if (node.class_type !== 'RandomNoise') continue;
    const inputs = (node.inputs || {}) as Record<string, unknown>;
    const s = typeof inputs.noise_seed === 'number' ? inputs.noise_seed : 0;
    if (s > maxSeedVal) { maxSeedVal = s; maxSeedNodeId = nodeId; }
  }

  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId] as Record<string, unknown>;
    const classType = node.class_type as string;
    const inputs = (node.inputs || {}) as Record<string, unknown>;
    const title = ((node._meta as Record<string, unknown>)?.title as string) || '';

    switch (classType) {
      case 'LoadImage':
        inputs.image = imageUrl;
        node.inputs = inputs;
        break;

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

      case 'RandomNoise':
        if (nodeId === maxSeedNodeId) {
          inputs.noise_seed = seed;
          node.inputs = inputs;
        }
        break;
    }
  }

  return w;
}

export async function animateImage(
  imageUrl: string,
  animationPrompt: string,
  settings: ComfyUIAnimationSettings
): Promise<string> {
  const endpoint = settings.endpoint.replace(/\/$/, '');

  if (!settings.workflow) {
    throw new Error('No animation workflow configured. Import a ComfyUI animation workflow in Settings.');
  }

  const workflow = injectAnimationParams(settings.workflow, imageUrl, animationPrompt, settings);
  const clientId = crypto.randomUUID();

  const queueRes = await fetch(`${endpoint}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the animation workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return waitForAnimationResult(endpoint, prompt_id, clientId);
}

function waitForAnimationResult(
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

    const timeoutMs = 10 * 60 * 1000;
    const overallTimeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Animation generation timed out after 10 minutes'));
      }
    }, timeoutMs);

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
      pollAnimationFallback(endpoint, promptId).then(resolve).catch(reject);
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
          reject(new Error(msg.data?.exception_message || 'ComfyUI animation execution error'));
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (settled) return;
      cleanup();
      clearTimeout(overallTimeout);
      pollAnimationFallback(endpoint, promptId).then(resolve).catch(reject);
    };

    ws.onclose = () => {
      if (settled) return;
      setTimeout(() => {
        if (!settled) {
          cleanup();
          clearTimeout(overallTimeout);
          pollAnimationFallback(endpoint, promptId).then(resolve).catch(reject);
        }
      }, 2000);
    };
  });
}

async function pollAnimationFallback(endpoint: string, promptId: string): Promise<string> {
  const maxAttempts = 200;
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
  throw new Error('Animation generation timed out after 10 minutes');
}
