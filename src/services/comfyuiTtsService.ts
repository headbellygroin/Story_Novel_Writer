export interface ComfyUITtsSettings {
  endpoint: string;
  workflow: Record<string, unknown> | null;
  speaker: string;
  speed?: number;
  sampleRate: number;
}

export interface TtsResult {
  audioUrl: string;
  filename: string;
  subfolder: string;
  type: string;
}

interface QueueResponse {
  prompt_id: string;
}

interface HistoryOutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

interface HistoryOutput {
  audio?: HistoryOutputFile[];
  gifs?: HistoryOutputFile[];
  images?: HistoryOutputFile[];
}

interface HistoryEntry {
  outputs: Record<string, HistoryOutput>;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];

function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
}

function findAudioOutput(entry: HistoryEntry, endpoint: string): TtsResult | null {
  for (const nodeOutput of Object.values(entry.outputs)) {
    const files = nodeOutput.audio || [];
    const audioFile = files.find((f) => isAudioFile(f.filename));
    if (audioFile) {
      return {
        audioUrl: `${endpoint}/view?filename=${encodeURIComponent(audioFile.filename)}&subfolder=${encodeURIComponent(audioFile.subfolder)}&type=${encodeURIComponent(audioFile.type)}`,
        filename: audioFile.filename,
        subfolder: audioFile.subfolder,
        type: audioFile.type,
      };
    }
  }
  // Fallback: check gifs/images for any audio extension files
  for (const nodeOutput of Object.values(entry.outputs)) {
    const allFiles = [
      ...(nodeOutput.gifs || []),
      ...(nodeOutput.images || []),
    ];
    const audioFile = allFiles.find((f) => isAudioFile(f.filename));
    if (audioFile) {
      return {
        audioUrl: `${endpoint}/view?filename=${encodeURIComponent(audioFile.filename)}&subfolder=${encodeURIComponent(audioFile.subfolder)}&type=${encodeURIComponent(audioFile.type)}`,
        filename: audioFile.filename,
        subfolder: audioFile.subfolder,
        type: audioFile.type,
      };
    }
  }
  return null;
}

/**
 * Inject text and speaker into the Kokoro workflow.
 * The Kokoro workflow has a linked node structure:
 *   KokoroSpeaker (node 3) -> speaker_name field
 *   KokoroGenerator (node 2) -> text field, speed field, speaker is a link [nodeId, outputIndex]
 * We update by class_type so node IDs don't matter.
 */
function injectKokoroWorkflow(
  workflow: Record<string, unknown>,
  text: string,
  speaker: string,
  speed: number
): Record<string, unknown> {
  const w = JSON.parse(JSON.stringify(workflow)) as Record<string, Record<string, unknown>>;

  for (const nodeId of Object.keys(w)) {
    const node = w[nodeId];
    const classType = node.class_type as string | undefined;
    const inputs = node.inputs as Record<string, unknown> | undefined;
    if (!inputs) continue;

    if (classType === 'KokoroSpeaker') {
      inputs.speaker_name = speaker;
    }

    if (classType === 'KokoroGenerator') {
      inputs.text = text;
      inputs.speed = speed;
    }

    // Generic fallback for non-Kokoro TTS nodes
    if (classType !== 'KokoroSpeaker' && classType !== 'KokoroGenerator') {
      if (typeof inputs.text === 'string') inputs.text = text;
      if (typeof inputs.speaker_name === 'string' && speaker) inputs.speaker_name = speaker;
      if (typeof inputs.speaker === 'string' && speaker) inputs.speaker = speaker;
      if (typeof inputs.voice === 'string' && speaker) inputs.voice = speaker;
    }
  }

  return w;
}

export async function generateTtsAudio(
  text: string,
  settings: ComfyUITtsSettings
): Promise<TtsResult> {
  const endpoint = settings.endpoint.replace(/\/$/, '');

  if (!settings.workflow) {
    throw new Error('No TTS workflow configured. Import a ComfyUI TTS workflow in Settings.');
  }

  const workflow = injectKokoroWorkflow(
    settings.workflow,
    text,
    settings.speaker || 'af_sarah',
    settings.speed ?? 1.0
  );

  const clientId = crypto.randomUUID();

  const queueRes = await fetch(`${endpoint}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the TTS workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return waitForTtsResult(endpoint, prompt_id, clientId);
}

function waitForTtsResult(
  endpoint: string,
  promptId: string,
  clientId: string
): Promise<TtsResult> {
  return new Promise((resolve, reject) => {
    const wsUrl = endpoint.replace(/^http/, 'ws') + `/ws?clientId=${clientId}`;
    let ws: WebSocket;
    let settled = false;

    const cleanup = () => {
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
    };

    const timeoutMs = 5 * 60 * 1000;
    const overallTimeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('TTS generation timed out after 5 minutes'));
      }
    }, timeoutMs);

    const fetchResult = async (): Promise<TtsResult | null> => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${endpoint}/history/${promptId}`, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const history: Record<string, HistoryEntry> = await res.json();
        const entry = history[promptId];
        if (!entry) return null;
        return findAudioOutput(entry, endpoint);
      } catch {
        return null;
      }
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      clearTimeout(overallTimeout);
      pollTtsFallback(endpoint, promptId).then(resolve).catch(reject);
      return;
    }

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
          reject(new Error(msg.data?.exception_message || 'ComfyUI TTS execution error'));
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (settled) return;
      cleanup();
      clearTimeout(overallTimeout);
      pollTtsFallback(endpoint, promptId).then(resolve).catch(reject);
    };

    ws.onclose = () => {
      if (settled) return;
      setTimeout(() => {
        if (!settled) {
          cleanup();
          clearTimeout(overallTimeout);
          pollTtsFallback(endpoint, promptId).then(resolve).catch(reject);
        }
      }, 2000);
    };
  });
}

async function pollTtsFallback(endpoint: string, promptId: string): Promise<TtsResult> {
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

      const result = findAudioOutput(entry, endpoint);
      if (result) return result;
    } catch {
      continue;
    }
  }

  throw new Error('TTS generation timed out after 6 minutes');
}
