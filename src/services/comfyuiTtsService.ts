import { generateClientId } from './comfyuiService';
import { comfyProxyGet, comfyProxyPost, comfyProxyMediaUrl } from '../lib/proxyFetch';

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
      const viewPath = `/view?filename=${encodeURIComponent(audioFile.filename)}&subfolder=${encodeURIComponent(audioFile.subfolder)}&type=${encodeURIComponent(audioFile.type)}`;
      return {
        audioUrl: comfyProxyMediaUrl(endpoint, viewPath),
        filename: audioFile.filename,
        subfolder: audioFile.subfolder,
        type: audioFile.type,
      };
    }
  }
  for (const nodeOutput of Object.values(entry.outputs)) {
    const allFiles = [
      ...(nodeOutput.gifs || []),
      ...(nodeOutput.images || []),
    ];
    const audioFile = allFiles.find((f) => isAudioFile(f.filename));
    if (audioFile) {
      const viewPath = `/view?filename=${encodeURIComponent(audioFile.filename)}&subfolder=${encodeURIComponent(audioFile.subfolder)}&type=${encodeURIComponent(audioFile.type)}`;
      return {
        audioUrl: comfyProxyMediaUrl(endpoint, viewPath),
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

  const clientId = generateClientId();

  const queueRes = await comfyProxyPost(endpoint, '/prompt', { prompt: workflow, client_id: clientId });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI rejected the TTS workflow: ${errText}`);
  }

  const { prompt_id }: QueueResponse = await queueRes.json();
  return pollForTtsResult(endpoint, prompt_id);
}

async function pollForTtsResult(endpoint: string, promptId: string): Promise<TtsResult> {
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

      const result = findAudioOutput(entry, endpoint);
      if (result) return result;
    } catch {
      continue;
    }
  }

  throw new Error('TTS generation timed out after 6 minutes');
}
