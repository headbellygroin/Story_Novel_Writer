import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  getAvailableVoices,
  createRecognition,
  speak,
  stopSpeaking,
  sendChatMessage,
  ChatMessage,
  VoiceChatConfig,
} from '../services/voiceChatService';

type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];

export default function VoiceChat() {
  const { currentProjectId } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [autoListen, setAutoListen] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const speechSupported = isSpeechRecognitionSupported();
  const synthSupported = isSpeechSynthesisSupported();

  useEffect(() => {
    if (currentProjectId) loadSettings();
  }, [currentProjectId]);

  useEffect(() => {
    const loadVoices = () => {
      const v = getAvailableVoices();
      setVoices(v);
    };
    loadVoices();
    if (synthSupported) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [synthSupported]);

  useEffect(() => {
    if (settings?.voice_chat_voice) setSelectedVoice(settings.voice_chat_voice as string);
    if (settings?.voice_chat_rate) setSpeechRate(Number(settings.voice_chat_rate));
    if (settings?.voice_chat_pitch) setSpeechPitch(Number(settings.voice_chat_pitch));
  }, [settings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('generation_settings')
        .select('*')
        .eq('project_id', currentProjectId!)
        .maybeSingle();
      setSettings(data);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const getVoiceConfig = useCallback((): VoiceChatConfig => ({
    voiceName: selectedVoice,
    rate: speechRate,
    pitch: speechPitch,
  }), [selectedVoice, speechRate, speechPitch]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !settings?.api_endpoint) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);
    setError('');

    try {
      const systemPrompt = (settings.system_prompt as string) ||
        'You are a helpful creative writing assistant. Keep responses concise and conversational for voice chat.';

      const response = await sendChatMessage(
        text.trim(),
        messages,
        settings.api_endpoint as string,
        systemPrompt
      );

      const assistantMessage: ChatMessage = { role: 'assistant', content: response, timestamp: Date.now() };
      setMessages((prev) => [...prev, assistantMessage]);

      if (synthSupported) {
        setIsSpeaking(true);
        speak(response, getVoiceConfig(), () => {
          setIsSpeaking(false);
          if (autoListen && speechSupported) {
            startListening();
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setIsProcessing(false);
    }
  }, [settings, messages, synthSupported, speechSupported, autoListen, getVoiceConfig]);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    setError('');

    recognitionRef.current = createRecognition(
      (transcript) => {
        handleSendMessage(transcript);
      },
      () => {
        setIsListening(false);
      },
      (errMsg) => {
        setError(`Speech recognition error: ${errMsg}`);
        setIsListening(false);
      }
    );

    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [speechSupported, handleSendMessage]);

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function handleStopSpeaking() {
    stopSpeaking();
    setIsSpeaking(false);
  }

  function clearChat() {
    setMessages([]);
    stopSpeaking();
    setIsSpeaking(false);
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Voice Chat</h1>
        <ProjectSelector />
      </div>

      {(!speechSupported || !synthSupported) && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            {!speechSupported && 'Speech recognition is not supported in this browser. Use Chrome or Edge for voice input. '}
            {!synthSupported && 'Speech synthesis is not available in this browser.'}
          </p>
        </div>
      )}

      {!settings?.api_endpoint && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">No API endpoint configured. Set up your LM Studio endpoint in Settings first.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm">Voice Settings</h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Voice</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">System Default</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Speed: {speechRate.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Pitch: {speechPitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechPitch}
                onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoListen}
                onChange={(e) => setAutoListen(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs text-slate-700">Auto-listen after response</span>
            </label>

            <button
              onClick={clearChat}
              className="w-full px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Clear Conversation
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex-1 flex flex-col" style={{ minHeight: '500px' }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 mt-20">
                  <div className="text-4xl mb-4">
                    <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <p className="text-sm">Press the microphone button or type a message to start chatting with your AI writing assistant.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-2.5 text-sm text-slate-500">
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="border-t border-slate-200 p-4">
              <div className="flex items-center gap-3">
                {speechSupported && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessing || isSpeaking}
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                        : 'bg-sky-600 text-white hover:bg-sky-700 shadow-md'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}

                {isSpeaking && (
                  <button
                    onClick={handleStopSpeaking}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors"
                    title="Stop speaking"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  </button>
                )}

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(inputText);
                    }
                  }}
                  placeholder={isListening ? 'Listening...' : 'Type a message...'}
                  disabled={isListening || isProcessing}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm disabled:opacity-50"
                />

                <button
                  onClick={() => handleSendMessage(inputText)}
                  disabled={!inputText.trim() || isProcessing || isListening}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Send message"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>

              {isListening && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Listening... speak now
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
