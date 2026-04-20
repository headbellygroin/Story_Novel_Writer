export interface VoiceChatConfig {
  voiceName: string;
  rate: number;
  pitch: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

const w = window as unknown as Record<string, unknown>;
const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

export function isSpeechRecognitionSupported(): boolean {
  return !!SpeechRecognitionAPI;
}

export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function createRecognition(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onError: (error: string) => void
): { start: () => void; stop: () => void } | null {
  if (!SpeechRecognitionAPI) return null;

  const recognition = new (SpeechRecognitionAPI as unknown as new () => SpeechRecognitionLike)();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onend = () => onEnd();

  recognition.onerror = (event) => {
    if (event.error === 'no-speech') {
      onEnd();
      return;
    }
    onError(event.error);
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
  };
}

export function speak(
  text: string,
  config: VoiceChatConfig,
  onEnd?: () => void
): { cancel: () => void } {
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = config.rate;
  utterance.pitch = config.pitch;

  if (config.voiceName) {
    const voices = synth.getVoices();
    const match = voices.find((v) => v.name === config.voiceName);
    if (match) utterance.voice = match;
  }

  if (onEnd) utterance.onend = onEnd;

  synth.speak(utterance);

  return {
    cancel: () => synth.cancel(),
  };
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  apiEndpoint: string,
  systemPrompt: string
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const chatEndpoint = apiEndpoint.replace('/v1/completions', '/v1/chat/completions');

  const res = await fetch(chatEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API error: ${errText}`);
  }

  const data = await res.json();

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (data.choices?.[0]?.text) {
    return data.choices[0].text;
  }
  if (data.content) {
    return data.content;
  }

  throw new Error('Unexpected response format from chat API');
}
