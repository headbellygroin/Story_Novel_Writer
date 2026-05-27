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
  if (!SpeechRecognitionAPI) return false;
  if (window.isSecureContext === false) return false;
  return true;
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

interface ContinuousRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
}

export function createContinuousRecognition(
  onTranscript: (finalText: string, interimText: string) => void,
  onEnd: () => void,
  onError: (error: string) => void
): { start: () => void; stop: () => void } | null {
  if (!SpeechRecognitionAPI) return null;

  const recognition = new (SpeechRecognitionAPI as unknown as new () => ContinuousRecognitionLike)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let stoppedByUser = false;

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }
    onTranscript(finalTranscript, interimTranscript);
  };

  recognition.onend = () => {
    if (!stoppedByUser) {
      // Browser killed recognition (timeout, etc.) -- restart
      try { recognition.start(); } catch { onEnd(); }
    } else {
      onEnd();
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech') return;
    if (event.error === 'aborted') return;
    onError(event.error);
  };

  return {
    start: () => { stoppedByUser = false; recognition.start(); },
    stop: () => { stoppedByUser = true; recognition.stop(); },
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

import { aiProxyFetch } from '../lib/proxyFetch';

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  apiEndpoint: string,
  systemPrompt: string,
  modelName?: string,
  maxTokens?: number
): Promise<string> {

  const historyMessages = history.map((m) => ({
    role: m.role,
    content: m.content.replace(/\n?\[Proposed \d+ edits? - see Plan panel\]$/g, '').trim(),
  }));

  // Always include system prompt as the first message so the AI has full context
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push(...historyMessages);
  messages.push({ role: 'user', content: message });

  const baseUrl = apiEndpoint.replace(/\/v1\/(chat\/)?completions.*/, '');
  const chatUrl = `${baseUrl}/v1/chat/completions`;

  const body: Record<string, unknown> = {
    messages,
    temperature: 0.7,
    max_tokens: maxTokens || 4000,
    stream: false,
  };
  if (modelName) body.model = modelName;

  let res = await aiProxyFetch(chatUrl, body);

  if (!res.ok) {
    const errText = await res.text();
    if (errText.includes('jinja template') || errText.includes('roles are supported')) {
      const completionsUrl = `${baseUrl}/v1/completions`;
      const prompt = buildTextPrompt(messages, systemPrompt);
      const textBody: Record<string, unknown> = {
        prompt,
        temperature: 0.7,
        max_tokens: maxTokens || 4000,
        stream: false,
        stop: ['\nUser:', '\nuser:', '\n\nUser:'],
      };
      if (modelName) textBody.model = modelName;

      res = await aiProxyFetch(completionsUrl, textBody);

      if (!res.ok) {
        const fallbackErr = await res.text();
        if (fallbackErr.includes('jinja template') || fallbackErr.includes('roles are supported')) {
          throw new Error(
            'Your LM Studio model template only supports user/assistant roles but LM Studio is injecting a system message. ' +
            'Fix: In LM Studio, go to My Models > select your model > Prompt Template, and either: ' +
            '(1) Switch to a model from lmstudio-community, or ' +
            '(2) Clear the "System Prompt" field in the server settings (left panel).'
          );
        }
        throw new Error(`Chat API error: ${fallbackErr}`);
      }
    } else {
      throw new Error(`Chat API error: ${errText}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API error: ${errText}`);
  }

  const data = await res.json();

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (data.choices?.[0]?.text) {
    return data.choices[0].text.trim();
  }
  if (data.content) {
    return data.content;
  }

  throw new Error('Unexpected response format from chat API');
}

function buildTextPrompt(messages: { role: string; content: string }[], systemPrompt: string): string {
  let prompt = '';
  if (systemPrompt) {
    prompt += `${systemPrompt}\n\n`;
  }
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n`;
    } else {
      prompt += `Assistant: ${msg.content}\n`;
    }
  }
  prompt += 'Assistant:';
  return prompt;
}
