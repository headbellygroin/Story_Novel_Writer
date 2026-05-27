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

async function buildProjectContext(projectId: string): Promise<string> {
  const [projectRes, charsRes, placesRes, thingsRes, techRes, outlinesRes, chaptersRes, bibleRes, dossierRes, styleAnchorsRes] = await Promise.all([
    supabase.from('projects').select('title, description, genre').eq('id', projectId).maybeSingle(),
    supabase.from('characters').select('name, role, description, personality, background, goals, relationships, notes, dialogue_style, dossier').eq('project_id', projectId),
    supabase.from('places').select('name, type, description, history, significance, notes').eq('project_id', projectId),
    supabase.from('things').select('name, type, description, properties, history, notes').eq('project_id', projectId),
    supabase.from('technologies').select('name, type, description, rules, applications, notes').eq('project_id', projectId),
    supabase.from('outlines').select('title, synopsis, act_structure, themes, notes').eq('project_id', projectId),
    supabase.from('chapters').select('title, summary, order_index, key_events, notes').eq('project_id', projectId).order('order_index', { ascending: true }),
    supabase.from('story_bible_entries').select('category, subject, fact, importance').eq('project_id', projectId).order('importance', { ascending: true }).limit(50),
    supabase.from('story_dossiers').select('content, genre_tropes, braindump').eq('project_id', projectId).maybeSingle(),
    supabase.from('style_anchors').select('label, passage, notes').eq('project_id', projectId).eq('active', true),
  ]);

  const parts: string[] = [];

  if (projectRes.data) {
    const p = projectRes.data;
    parts.push(`## Project: ${p.title}`);
    if (p.genre) parts.push(`Genre: ${p.genre}`);
    if (p.description) parts.push(`Description: ${p.description}`);
  }

  if (dossierRes.data) {
    const d = dossierRes.data;
    parts.push('\n## Story Dossier (Guide)');
    if (d.content) parts.push(d.content);
    if (d.genre_tropes) parts.push(`\nGenre/Tropes: ${d.genre_tropes}`);
    if (d.braindump) parts.push(`\nBraindump/Notes: ${d.braindump}`);
  }

  if (outlinesRes.data?.length) {
    parts.push('\n## Story Outlines');
    for (const o of outlinesRes.data) {
      parts.push(`- "${o.title}"${o.synopsis ? `: ${o.synopsis}` : ''}${o.themes ? ` | Themes: ${o.themes}` : ''}`);
      if (o.act_structure) parts.push(`  Act Structure: ${o.act_structure}`);
    }
  }

  if (chaptersRes.data?.length) {
    parts.push('\n## Chapters');
    for (const c of chaptersRes.data) {
      let line = `${c.order_index + 1}. "${c.title}"`;
      if (c.summary) line += ` - ${c.summary}`;
      if (c.key_events) line += ` | Key Events: ${c.key_events}`;
      parts.push(line);
    }
  }

  if (charsRes.data?.length) {
    parts.push('\n## Characters');
    for (const c of charsRes.data) {
      let line = `### ${c.name}`;
      if (c.role) line += ` (${c.role})`;
      parts.push(line);
      if (c.description) parts.push(`Description: ${c.description}`);
      if (c.personality) parts.push(`Personality: ${c.personality}`);
      if (c.background) parts.push(`Background: ${c.background}`);
      if (c.goals) parts.push(`Goals: ${c.goals}`);
      if (c.dialogue_style) parts.push(`Dialogue Style: ${c.dialogue_style}`);
      if (c.relationships && Array.isArray(c.relationships) && (c.relationships as unknown[]).length > 0) {
        parts.push(`Relationships: ${JSON.stringify(c.relationships)}`);
      }
      if (c.dossier) parts.push(`Dossier: ${c.dossier}`);
      if (c.notes) parts.push(`Notes: ${c.notes}`);
    }
  }

  if (placesRes.data?.length) {
    parts.push('\n## Places');
    for (const p of placesRes.data) {
      let line = `### ${p.name}`;
      if (p.type) line += ` (${p.type})`;
      parts.push(line);
      if (p.description) parts.push(`Description: ${p.description}`);
      if (p.history) parts.push(`History: ${p.history}`);
      if (p.significance) parts.push(`Significance: ${p.significance}`);
      if (p.notes) parts.push(`Notes: ${p.notes}`);
    }
  }

  if (thingsRes.data?.length) {
    parts.push('\n## Things/Items');
    for (const t of thingsRes.data) {
      let line = `### ${t.name}`;
      if (t.type) line += ` (${t.type})`;
      parts.push(line);
      if (t.description) parts.push(`Description: ${t.description}`);
      if (t.properties) parts.push(`Properties: ${t.properties}`);
      if (t.history) parts.push(`History: ${t.history}`);
      if (t.notes) parts.push(`Notes: ${t.notes}`);
    }
  }

  if (techRes.data?.length) {
    parts.push('\n## Technologies');
    for (const t of techRes.data) {
      let line = `### ${t.name}`;
      if (t.type) line += ` (${t.type})`;
      parts.push(line);
      if (t.description) parts.push(`Description: ${t.description}`);
      if (t.rules) parts.push(`Rules: ${t.rules}`);
      if (t.applications) parts.push(`Applications: ${t.applications}`);
      if (t.notes) parts.push(`Notes: ${t.notes}`);
    }
  }

  if (bibleRes.data?.length) {
    parts.push('\n## Story Bible (Key Facts)');
    for (const b of bibleRes.data) {
      parts.push(`- [${b.category}/${b.importance}] ${b.subject}: ${b.fact}`);
    }
  }

  if (styleAnchorsRes.data?.length) {
    parts.push('\n## Style Anchors (Reference Passages)');
    for (const s of styleAnchorsRes.data) {
      parts.push(`- ${s.label}: "${s.passage}"${s.notes ? ` (${s.notes})` : ''}`);
    }
  }

  return parts.join('\n');
}

interface EditCommand {
  table: string;
  action: 'update' | 'create';
  name: string;
  fields: Record<string, string>;
}

const EDIT_INSTRUCTIONS = `
# Edit Capability
You can make edits to the project data. When the user asks you to change something, include an edit command in your response using this exact format:

[EDIT:table=characters|action=update|name=Captain Dax|field_description=She grew up on a mining colony|field_goals=Find her lost sister]
[EDIT:table=places|action=create|name=The Rusty Nail|field_type=Bar|field_description=A seedy dive bar on deck 7]
[EDIT:table=story_bible_entries|action=create|name=New Fact|field_category=world_rule|field_subject=Faster-than-light|field_fact=FTL travel requires quantum crystals]

Supported tables: characters, places, things, technologies, story_bible_entries
Supported actions: update (modifies existing by name), create (adds new)
Field names use the prefix "field_" followed by the column name.

For characters: description, personality, background, goals, role, notes, dialogue_style, dossier
For places: type, description, history, significance, notes
For things: type, description, properties, history, notes
For technologies: type, description, rules, applications, notes
For story_bible_entries: category, subject, fact, importance (critical/high/medium/low)

Place the [EDIT:...] command at the END of your response after your conversational reply. You can include multiple edit commands.
Always confirm what you changed in your spoken response.`;

function parseEditCommands(text: string): { cleanText: string; commands: EditCommand[] } {
  const commands: EditCommand[] = [];
  const editRegex = /\[EDIT:([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = editRegex.exec(text)) !== null) {
    const parts = match[1].split('|');
    const cmd: Partial<EditCommand> & { fields: Record<string, string> } = { fields: {} };

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();

      if (key === 'table') cmd.table = val;
      else if (key === 'action') cmd.action = val as 'update' | 'create';
      else if (key === 'name') cmd.name = val;
      else if (key.startsWith('field_')) cmd.fields[key.slice(6)] = val;
    }

    if (cmd.table && cmd.action && cmd.name) {
      commands.push(cmd as EditCommand);
    }
  }

  const cleanText = text.replace(/\[EDIT:[^\]]+\]\s*/g, '').trim();
  return { cleanText, commands };
}

async function executeEditCommands(commands: EditCommand[], projectId: string): Promise<string[]> {
  const results: string[] = [];

  for (const cmd of commands) {
    try {
      if (cmd.action === 'update') {
        const { data: existing } = await supabase
          .from(cmd.table as 'characters')
          .select('id')
          .eq('project_id', projectId)
          .ilike('name', cmd.name)
          .maybeSingle();

        if (!existing) {
          results.push(`Could not find "${cmd.name}" in ${cmd.table} to update`);
          continue;
        }

        const updatePayload: Record<string, string> = { ...cmd.fields, updated_at: new Date().toISOString() };
        const { error } = await supabase
          .from(cmd.table as 'characters')
          .update(updatePayload)
          .eq('id', existing.id);

        if (error) results.push(`Error updating ${cmd.name}: ${error.message}`);
        else results.push(`Updated ${cmd.name} in ${cmd.table}`);
      } else if (cmd.action === 'create') {
        const insertPayload: Record<string, string> = {
          project_id: projectId,
          name: cmd.name,
          ...cmd.fields,
        };

        if (cmd.table === 'story_bible_entries') {
          if (!insertPayload.subject) insertPayload.subject = cmd.name;
          delete insertPayload.name;
        }

        const { error } = await supabase
          .from(cmd.table as 'characters')
          .insert(insertPayload);

        if (error) results.push(`Error creating ${cmd.name}: ${error.message}`);
        else results.push(`Created ${cmd.name} in ${cmd.table}`);
      }
    } catch (err) {
      results.push(`Failed to execute edit for ${cmd.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return results;
}

export default function VoiceChat() {
  const { currentProjectId, voiceChatMessages, addVoiceChatMessage, clearVoiceChatMessages } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings> | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [projectContext, setProjectContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const messages = voiceChatMessages as ChatMessage[];

  const speechSupported = isSpeechRecognitionSupported();
  const synthSupported = isSpeechSynthesisSupported();

  useEffect(() => {
    if (currentProjectId) {
      loadSettings();
      buildProjectContext(currentProjectId).then(setProjectContext);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (settings?.api_endpoint) {
      checkConnection(settings.api_endpoint as string);
    } else if (!loading) {
      setConnectionStatus('disconnected');
    }
  }, [settings, loading]);

  async function checkConnection(endpoint: string) {
    setConnectionStatus('checking');
    try {
      const baseUrl = endpoint.replace(/\/v1\/(chat\/)?completions.*/, '');
      const res = await fetch(`${baseUrl}/v1/models`, { method: 'GET' });
      setConnectionStatus(res.ok ? 'connected' : 'disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }
  }

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
    addVoiceChatMessage(userMessage);
    setInputText('');
    setIsProcessing(true);
    setError('');

    try {
      const basePrompt = (settings.system_prompt as string) ||
        'You are a helpful creative writing assistant. Keep responses concise and conversational for voice chat.';
      const systemPrompt = projectContext
        ? `${basePrompt}\n\n# Project Knowledge\nBelow is the current state of the creative project you are assisting with. Use this to answer questions accurately.\n\n${projectContext}\n${EDIT_INSTRUCTIONS}`
        : `${basePrompt}\n${EDIT_INSTRUCTIONS}`;

      const response = await sendChatMessage(
        text.trim(),
        messages,
        settings.api_endpoint as string,
        systemPrompt,
        (settings.model_name as string) || undefined
      );

      const { cleanText, commands } = parseEditCommands(response);

      let editFeedback = '';
      if (commands.length > 0 && currentProjectId) {
        const results = await executeEditCommands(commands, currentProjectId);
        editFeedback = '\n[' + results.join('; ') + ']';
        buildProjectContext(currentProjectId).then(setProjectContext);
      }

      const displayText = cleanText;
      const storedText = editFeedback ? `${cleanText}${editFeedback}` : cleanText;

      const assistantMessage: ChatMessage = { role: 'assistant', content: storedText, timestamp: Date.now() };
      addVoiceChatMessage(assistantMessage);

      if (synthSupported) {
        setIsSpeaking(true);
        speak(displayText, getVoiceConfig(), () => {
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
  }, [settings, messages, synthSupported, speechSupported, autoListen, getVoiceConfig, currentProjectId, projectContext]);

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
    clearVoiceChatMessages();
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
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">Voice Chat</h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            connectionStatus === 'connected' ? 'bg-emerald-50 text-emerald-700' :
            connectionStatus === 'checking' ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500' :
              connectionStatus === 'checking' ? 'bg-amber-500 animate-pulse' :
              'bg-red-500'
            }`} />
            {connectionStatus === 'connected' ? 'Connected' :
             connectionStatus === 'checking' ? 'Checking...' :
             'Disconnected'}
          </span>
        </div>
        <ProjectSelector />
      </div>

      {(!speechSupported || !synthSupported) && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            {!speechSupported && 'Voice input requires a secure context (HTTPS or localhost). You can still type messages below. '}
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

              {messages.map((msg, i) => {
                const hasEditResult = msg.role === 'assistant' && msg.content.includes('\n[');
                const contentParts = hasEditResult ? msg.content.split(/\n(\[.+\])$/) : [msg.content];
                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%] space-y-1">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-900'
                        }`}
                      >
                        {contentParts[0]}
                      </div>
                      {contentParts[1] && (
                        <div className="rounded-lg px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {contentParts[1]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

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
