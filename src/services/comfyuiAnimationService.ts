export interface ComfyUIAnimationSettings {
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

function injectAnimationParams(
  workflow: Record<string, unknown>,
  imageUrl: string,
  animationPrompt: string
): Record<string, unknown> {
  const w = JSON.parse(JSON.stringify(workflow));

  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId] as Record<string, unknown>;
    const inputs = node.inputs as Record<string, unknown>;
    if (!inputs) continue;

    if (typeof inputs.image === 'string' && (inputs.image === '' || inputs.image.includes('PLACEHOLDER'))) {
      inputs.image = imageUrl;
    }
    if (typeof inputs.url === 'string') {
      inputs.url = imageUrl;
    }
    if (typeof inputs.image_path === 'string') {
      inputs.image_path = imageUrl;
    }

    if (typeof inputs.text === 'string') {
      inputs.text = animationPrompt;
    }
    if (typeof inputs.prompt === 'string' && !inputs.prompt.includes('NEGATIVE')) {
      inputs.prompt = animationPrompt;
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

  const workflow = injectAnimationParams(settings.workflow, imageUrl, animationPrompt);
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
