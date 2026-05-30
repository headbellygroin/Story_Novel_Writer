import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  getAvailableVoices,
  createContinuousRecognition,
  speak,
  stopSpeaking,
  sendChatMessage,
  ChatMessage,
  VoiceChatConfig,
} from '../services/voiceChatService';
import type { PendingEdit } from '../store/useStore';

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

// --- Pending Edit Types & Logic ---

type EditCommand = PendingEdit;

const STORY_FORGE_AWARENESS = `
# Your Role in Story Forge
You are the creative director AI inside Story Forge, a self-hosted novel writing and production studio. Your job is to help the user plan, build, and refine their book — and that book then flows through additional production stages to become audiobook video content.

## What Story Forge Is
Story Forge covers the full authoring lifecycle: brainstorming, world-building, outlining, scene-by-scene writing, consistency checking, and a 5-stage production pipeline that turns finished chapters into narrated video. It runs locally using LM Studio (text AI) and ComfyUI (image/audio/video generation).

## The Tabs & How They Connect (your knowledge of the system)
1. **Projects** — Each story is a project. All data is scoped to the active project.
2. **Dossier** — Pre-writing planning. Brain dump + genre tropes -> structured story guide (premise, themes, tone, characters, plot beats). This feeds downstream as context.
3. **World Library** — Characters (with personality sliders, Hero's Journey stages, dossiers), Places, Things, Technologies. These are injected into every writing prompt.
4. **Outline** — Story structure: outlines with chapters, each having summary, key events, POV, setting.
5. **Story Bible** — Canonical facts the AI must respect (world rules, timelines, relationships). Injected into every prompt.
6. **Style Anchors** — Reference passages defining the desired writing voice. Active ones are injected into prompts.
7. **Prohibited Words** — Blocklist of AI-isms and clichés to avoid.
8. **Reveals** — Timeline tracking of information reveals across the story.
9. **Write** — Scene editor. AI generates prose using deep context (dossier, outline, world, bible, states, events, style, prohibited words, referenced scenes, scene brief, context tags). Right sidebar has Scene Brief, Context Tags, Summary, Scene Image, Editing Passes.
10. **Voice Chat (You Are Here)** — Discuss and plan with the user. When ready to commit changes, propose edits that appear in the **Edit Plan panel** on the right side of the chat. The user reviews and accepts/rejects each proposed edit from there.
11. **Consistency** — Story Events log, Character States per scene, Scene References for continuity.
12. **Logic Checks** — AI audit tool that finds contradictions, plot holes, timeline issues.
13. **Audio** — Standalone audiobook TTS using ComfyUI Kokoro workflow.
14. **Pipeline** — 5-stage production: (1) Analyse chapter & generate scene images, (2) Animate images into GIFs, (3) Generate TTS audio chunks, (4) Export assembly JSON, (5) Lip-sync video generation.
15. **Export** — HTML/Markdown/Text output of chapters.
16. **Save/Load** — JSON backup of entire project.
17. **Settings** — LLM parameters, system prompt, style guide, ComfyUI endpoint, image settings, art style presets, TTS voice, animation settings.

## Your Specific Job
- Help the user plan and develop their story (characters, plot, world, themes, structure)
- Propose concrete edits to the project data when the user is ready to commit changes
- Understand that everything you help build here will be used by the Write tab to generate actual prose
- The prose then feeds into the Pipeline to become visual/audio content
- Keep continuity and consistency in mind — what you add should not contradict existing Story Bible facts or established Character States
- Think like a creative partner and story consultant, not just a chatbot`;

const EDIT_INSTRUCTIONS = `
# Edit Proposals
When the user discusses changes, plans, or asks you to modify something about the project, propose edits using this format. These will NOT be applied immediately -- they go into a pending queue for the user to review and approve.

Format:
[PROPOSE:table=characters|action=update|name=Captain Dax|summary=Update background to mention mining colony|field_description=She grew up on a mining colony|field_goals=Find her lost sister]
[PROPOSE:table=places|action=create|name=The Rusty Nail|summary=Add new bar location|field_type=Bar|field_description=A seedy dive bar on deck 7]
[PROPOSE:table=story_bible_entries|action=create|name=FTL Rule|summary=Add world rule about FTL travel|field_category=world_rule|field_subject=Faster-than-light|field_fact=FTL travel requires quantum crystals]

Supported tables: characters, places, things, technologies, story_bible_entries
Supported actions: update (modifies existing by name), create (adds new)
Field names use the prefix "field_" followed by the column name.

For characters: description, personality, background, goals, role, notes, dialogue_style, dossier
For places: type, description, history, significance, notes
For things: type, description, properties, history, notes
For technologies: type, description, rules, applications, notes
For story_bible_entries: category, subject, fact, importance (critical/high/medium/low)

IMPORTANT RULES:
- Only propose edits when the user is clearly asking for changes or when you've discussed and agreed on modifications
- During open discussion/brainstorming, just talk naturally without proposing edits
- When the user says something like "let's do it", "make those changes", "go ahead", or "add that" -- THEN propose the edits
- Place [PROPOSE:...] commands at the END of your response
- Always explain what you're proposing in your spoken reply
- You can include multiple proposals in one response
- NEVER write "[Proposed N edits - see Plan panel]" yourself -- that text is auto-generated by the system when your [PROPOSE:...] blocks are parsed
- If proposing edits, you MUST use the exact [PROPOSE:table=...|action=...|name=...|...] syntax. Do NOT just describe changes in English -- use the bracket format or they won't appear in the panel`;

function parseProposals(text: string): { cleanText: string; proposals: EditCommand[] } {
  const proposals: EditCommand[] = [];
  // Strip markdown code fences that wrap PROPOSE blocks
  let normalized = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, inner) => {
    if (inner.includes('[PROPOSE:')) return inner;
    return '```' + inner + '```';
  });
  // Collapse any line breaks inside [PROPOSE:...] blocks
  normalized = normalized.replace(/\[PROPOSE:([\s\S]*?)\]/g, (_, inner) => {
    return '[PROPOSE:' + inner.replace(/\n\s*/g, '') + ']';
  });

  const propRegex = /\[PROPOSE:([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(normalized)) !== null) {
    const parts = match[1].split('|');
    const cmd: Partial<EditCommand> & { fields: Record<string, string> } = { fields: {}, id: crypto.randomUUID() };

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();

      if (key === 'table') cmd.table = val;
      else if (key === 'action') cmd.action = val as 'update' | 'create';
      else if (key === 'name') cmd.name = val;
      else if (key === 'summary') cmd.summary = val;
      else if (key.startsWith('field_')) cmd.fields[key.slice(6)] = val;
    }

    if (cmd.table && cmd.action && cmd.name) {
      if (!cmd.summary) cmd.summary = `${cmd.action} ${cmd.name} in ${cmd.table}`;
      proposals.push(cmd as EditCommand);
    }
  }

  const cleanText = text.replace(/```[^\n]*\n?[\s\S]*?```/g, (block) => {
    if (block.includes('[PROPOSE:')) return '';
    return block;
  }).replace(/\[PROPOSE:[\s\S]*?\]\s*/g, '').trim();
  return { cleanText, proposals };
}

async function executeEdit(cmd: EditCommand, projectId: string): Promise<string> {
  try {
    if (cmd.action === 'update') {
      const { data: existing } = await supabase
        .from(cmd.table as 'characters')
        .select('id')
        .eq('project_id', projectId)
        .ilike('name', cmd.name)
        .maybeSingle();

      if (!existing) return `Could not find "${cmd.name}" in ${cmd.table}`;

      const updatePayload: Record<string, string> = { ...cmd.fields, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from(cmd.table as 'characters')
        .update(updatePayload)
        .eq('id', existing.id);

      return error ? `Error: ${error.message}` : `Updated ${cmd.name}`;
    } else {
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

      return error ? `Error: ${error.message}` : `Created ${cmd.name}`;
    }
  } catch (err) {
    return `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

// --- Component ---

export default function VoiceChat() {
  const { currentProjectId, voiceChatMessages, addVoiceChatMessage, clearVoiceChatMessages, voiceChatState, setVoiceChatState, pendingEdits, addPendingEdits, removePendingEdit, clearPendingEdits } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [projectContext, setProjectContext] = useState('');
  const [planPanelOpen, setPlanPanelOpen] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executingAll, setExecutingAll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = voiceChatMessages as ChatMessage[];
  const speechSupported = isSpeechRecognitionSupported();
  const synthSupported = isSpeechSynthesisSupported();

  const selectedVoice = voiceChatState.voice;
  const speechRate = voiceChatState.rate;
  const speechPitch = voiceChatState.pitch;
  const autoListen = voiceChatState.autoListen;
  const isProcessing = voiceChatState.isProcessing;

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && abortRef.current) {
        abortRef.current.abort();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    const loadVoices = () => setVoices(getAvailableVoices());
    loadVoices();
    if (synthSupported) window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [synthSupported]);

  useEffect(() => {
    if (settings && !voiceChatState.voice && settings.voice_chat_voice) {
      setVoiceChatState({
        voice: settings.voice_chat_voice as string,
        rate: Number(settings.voice_chat_rate) || 1.0,
        pitch: Number(settings.voice_chat_pitch) || 1.0,
      });
    }
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
  }), [voiceChatState]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !settings?.api_endpoint) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() };
    addVoiceChatMessage(userMessage);
    setInputText('');
    setVoiceChatState({ isProcessing: true });
    setError('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const basePrompt = (settings.system_prompt as string) ||
        'You are a helpful creative writing assistant. Keep responses concise and conversational for voice chat.';
      const systemPrompt = projectContext
        ? `${basePrompt}\n\n${STORY_FORGE_AWARENESS}\n\n# Project Knowledge\nBelow is the current state of the creative project you are assisting with. Use this to answer questions accurately.\n\n${projectContext}\n${EDIT_INSTRUCTIONS}`
        : `${basePrompt}\n\n${STORY_FORGE_AWARENESS}\n${EDIT_INSTRUCTIONS}`;

      const response = await sendChatMessage(
        text.trim(),
        messages,
        settings.api_endpoint as string,
        systemPrompt,
        (settings.model_name as string) || undefined,
        (settings.max_tokens as number) || undefined,
        controller.signal
      );

      const { cleanText, proposals } = parseProposals(response);
      if (response.includes('PROPOSE') || response.includes('propose')) {
        console.log('[Edit Plan] Raw AI response:', response);
        console.log('[Edit Plan] Parsed proposals:', proposals);
      }

      if (proposals.length > 0) {
        addPendingEdits(proposals);
        setPlanPanelOpen(true);
      } else if (response.includes('[Proposed') || /proposed?\s+\d+\s+edit/i.test(response)) {
        console.warn('[Edit Plan] AI claimed to propose edits but none were parsed. Raw:', response);
      }

      // Strip any AI-generated fake proposal annotations
      const finalText = cleanText.replace(/\[Proposed \d+ edits? -[^\]]*\]/gi, '').trim();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: proposals.length > 0
          ? `${finalText}\n[Proposed ${proposals.length} edit${proposals.length > 1 ? 's' : ''} - see Plan panel]`
          : finalText,
        timestamp: Date.now(),
      };
      addVoiceChatMessage(assistantMessage);

      if (synthSupported) {
        setIsSpeaking(true);
        speak(cleanText, getVoiceConfig(), () => {
          setIsSpeaking(false);
          if (autoListen && speechSupported) startListening();
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        addVoiceChatMessage({ role: 'assistant', content: '[Request cancelled]', timestamp: Date.now() });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to get response');
      }
    } finally {
      abortRef.current = null;
      setVoiceChatState({ isProcessing: false });
    }
  }, [settings, messages, synthSupported, speechSupported, voiceChatState, getVoiceConfig, currentProjectId, projectContext]);

  const handleCancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    setError('');
    setVoiceTranscript('');
    setInterimText('');
    recognitionRef.current = createContinuousRecognition(
      (finalText, interim) => {
        setVoiceTranscript(finalText);
        setInterimText(interim);
      },
      () => setIsListening(false),
      (errMsg) => { setError(`Speech recognition error: ${errMsg}`); setIsListening(false); }
    );
    if (recognitionRef.current) { recognitionRef.current.start(); setIsListening(true); }
  }, [speechSupported]);

  function stopListeningAndSend() {
    recognitionRef.current?.stop();
    setIsListening(false);
    const text = voiceTranscript.trim() || interimText.trim();
    if (text) {
      handleSendMessage(text);
    }
    setVoiceTranscript('');
    setInterimText('');
  }

  function stopListeningCancel() {
    recognitionRef.current?.stop();
    setIsListening(false);
    setVoiceTranscript('');
    setInterimText('');
  }
  function handleStopSpeaking() { stopSpeaking(); setIsSpeaking(false); }
  function clearChat() { clearVoiceChatMessages(); stopSpeaking(); setIsSpeaking(false); }

  async function acceptEdit(edit: EditCommand) {
    if (!currentProjectId) return;
    setExecutingId(edit.id);
    await executeEdit(edit, currentProjectId);
    removePendingEdit(edit.id);
    setExecutingId(null);
    buildProjectContext(currentProjectId).then(setProjectContext);
  }

  function rejectEdit(editId: string) {
    removePendingEdit(editId);
  }

  async function acceptAllEdits() {
    if (!currentProjectId) return;
    setExecutingAll(true);
    for (const edit of pendingEdits) {
      await executeEdit(edit, currentProjectId);
    }
    clearPendingEdits();
    setExecutingAll(false);
    buildProjectContext(currentProjectId).then(setProjectContext);
  }

  function clearAllEdits() {
    clearPendingEdits();
  }

  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-600">Loading...</div>
      </div>
    );
  }

  const TABLE_COLORS: Record<string, string> = {
    characters: 'bg-sky-100 text-sky-800',
    places: 'bg-emerald-100 text-emerald-800',
    things: 'bg-amber-100 text-amber-800',
    technologies: 'bg-rose-100 text-rose-800',
    story_bible_entries: 'bg-slate-200 text-slate-800',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header area */}
      <div className="flex-shrink-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
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
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              {!speechSupported && 'Voice input requires a secure context (HTTPS or localhost). You can still type messages below. '}
              {!synthSupported && 'Speech synthesis is not available in this browser.'}
            </p>
          </div>
        )}

        {!settings?.api_endpoint && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">No API endpoint configured. Set up your LM Studio endpoint in Settings first.</p>
          </div>
        )}
      </div>

      {/* Main content area - fills remaining height */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex gap-6 h-full">
          {/* Voice Settings - Left */}
          <div className="w-48 flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">Voice Settings</h3>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Voice</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setVoiceChatState({ voice: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">System Default</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Speed: {speechRate.toFixed(1)}x</label>
                <input type="range" min="0.5" max="2" step="0.1" value={speechRate}
                  onChange={(e) => setVoiceChatState({ rate: parseFloat(e.target.value) })} className="w-full accent-sky-600" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pitch: {speechPitch.toFixed(1)}</label>
                <input type="range" min="0.5" max="2" step="0.1" value={speechPitch}
                  onChange={(e) => setVoiceChatState({ pitch: parseFloat(e.target.value) })} className="w-full accent-sky-600" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoListen} onChange={(e) => setVoiceChatState({ autoListen: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                <span className="text-xs text-slate-700">Auto-listen after response</span>
              </label>

              <button onClick={clearChat}
                className="w-full px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                Clear Conversation
              </button>
            </div>
          </div>

          {/* Chat - Center */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-slate-400 mt-20">
                  <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  <p className="text-sm">Discuss your project, brainstorm ideas, then commit changes when ready.</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const hasProposal = msg.role === 'assistant' && msg.content.includes('[Proposed');
                const mainContent = hasProposal ? msg.content.replace(/\n\[Proposed .+\]$/, '') : msg.content;
                const proposalNote = hasProposal ? msg.content.match(/\[Proposed .+\]$/)?.[0] : null;
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] space-y-1">
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-900'
                      }`}>
                        {mainContent}
                      </div>
                      {proposalNote && (
                        <div className="rounded-lg px-3 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {proposalNote.replace(/[\[\]]/g, '')}
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
              {/* Voice recording area -- shown when actively recording */}
              {isListening && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium text-red-700">Recording — take your time, click Stop when done</span>
                  </div>
                  <div className="min-h-[2.5rem] text-sm text-slate-800 bg-white rounded p-2 border border-red-100">
                    {voiceTranscript || interimText ? (
                      <>
                        {voiceTranscript && <span>{voiceTranscript}</span>}
                        {interimText && <span className="text-slate-400">{interimText}</span>}
                      </>
                    ) : (
                      <span className="text-slate-400">Speak now...</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={stopListeningAndSend}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
                    >
                      Stop & Send
                    </button>
                    <button
                      onClick={stopListeningCancel}
                      className="px-3 py-2 text-sm font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                {speechSupported && !isListening && (
                  <button
                    onClick={startListening}
                    disabled={isProcessing || isSpeaking}
                    className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-sky-600 text-white hover:bg-sky-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title="Start recording"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}

                {isSpeaking && (
                  <button onClick={handleStopSpeaking}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors"
                    title="Stop speaking">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  </button>
                )}

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(inputText); } }}
                  placeholder={isListening ? 'Recording...' : 'Type a message...'}
                  disabled={isListening || isProcessing}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm disabled:opacity-50"
                />

                {isProcessing ? (
                  <button
                    onClick={handleCancelRequest}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors animate-pulse"
                    title="Stop generation (Esc)">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendMessage(inputText)}
                    disabled={!inputText.trim() || isListening}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Send message">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Propose Syntax Reference */}
              <details className="px-4 pb-3">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                  Propose syntax reference
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-teal-50 border border-teal-200 rounded-md p-2">
                    <p className="font-semibold text-teal-800 mb-1">Outlines</p>
                    <p className="text-teal-700 leading-relaxed mb-1">table=outlines | fields: synopsis, act_structure, themes, notes</p>
                    <code className="block text-[10px] bg-teal-100 rounded px-1.5 py-1 text-teal-900 break-all leading-snug">
                      [PROPOSE:table=outlines|action=create|name=Book 1: The Arrival|field_synopsis=A stranger arrives in a coastal town|field_act_structure=Part 1: Discovery. Part 2: Conflict. Part 3: Resolution|field_themes=identity, belonging|field_notes=Opens with a storm]
                    </code>
                  </div>
                  <div className="bg-sky-50 border border-sky-200 rounded-md p-2">
                    <p className="font-semibold text-sky-800 mb-1">Characters</p>
                    <p className="text-sky-700 leading-relaxed mb-1">table=characters | fields: role, description, personality, background, goals</p>
                    <code className="block text-[10px] bg-sky-100 rounded px-1.5 py-1 text-sky-900 break-all leading-snug">
                      [PROPOSE:table=characters|action=create|name=Mara Voss|field_role=protagonist|field_description=A tall woman with calloused hands|field_personality=Stubborn, loyal, quick-tempered|field_background=Grew up on fishing boats|field_goals=Find her missing brother]
                    </code>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2">
                    <p className="font-semibold text-emerald-800 mb-1">Places</p>
                    <p className="text-emerald-700 leading-relaxed mb-1">table=places | fields: type, description, history, significance</p>
                    <code className="block text-[10px] bg-emerald-100 rounded px-1.5 py-1 text-emerald-900 break-all leading-snug">
                      [PROPOSE:table=places|action=create|name=The Salt Quarter|field_type=District|field_description=A crumbling waterfront neighbourhood|field_history=Once the merchant hub before the flood|field_significance=Where the rebels meet in secret]
                    </code>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
                    <p className="font-semibold text-amber-800 mb-1">Story Bible</p>
                    <p className="text-amber-700 leading-relaxed mb-1">table=story_bible_entries | fields: category, subject, fact, importance</p>
                    <code className="block text-[10px] bg-amber-100 rounded px-1.5 py-1 text-amber-900 break-all leading-snug">
                      [PROPOSE:table=story_bible_entries|action=create|name=Tide Rule|field_category=world_rule|field_subject=Tidal Magic|field_fact=Magic only works during high tide|field_importance=high]
                    </code>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  Copy an example above and swap the values. Tell the AI which table to target: "Propose outlines for each book using the outlines table."
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* Pending Edits Plan Panel - Right */}
        <div className={`flex-shrink-0 transition-all duration-300 ${planPanelOpen ? 'w-96' : 'w-10'}`}>
          {!planPanelOpen ? (
            <button
              onClick={() => setPlanPanelOpen(true)}
              className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors relative"
              title="Open plan panel"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              {pendingEdits.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {pendingEdits.length}
                </span>
              )}
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col max-h-full overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Edit Plan</h3>
                  {pendingEdits.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                      {pendingEdits.length}
                    </span>
                  )}
                </div>
                <button onClick={() => setPlanPanelOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {pendingEdits.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-xs">Discuss changes with the AI.<br/>Proposed edits appear here.</p>
                    {messages.some(m => m.content.includes('[Proposed')) && (
                      <p className="text-[10px] mt-2 text-amber-600">Previous edits were already processed or cleared. Ask the AI to re-propose them if needed.</p>
                    )}
                  </div>
                ) : (
                  pendingEdits.map((edit) => (
                    <div key={edit.id} className="border border-slate-200 rounded-lg p-3 space-y-2.5 hover:border-slate-300 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${TABLE_COLORS[edit.table] || 'bg-slate-100 text-slate-600'}`}>
                            {edit.table.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-500 uppercase">{edit.action}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{edit.name}</p>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{edit.summary}</p>
                      </div>

                      {Object.keys(edit.fields).length > 0 && (
                        <div className="bg-slate-50 rounded-md p-2.5 space-y-1">
                          {Object.entries(edit.fields).map(([key, val]) => (
                            <div key={key} className="text-xs text-slate-700 leading-relaxed">
                              <span className="font-semibold text-slate-900">{key}:</span> {val}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptEdit(edit)}
                          disabled={executingId === edit.id || executingAll}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {executingId === edit.id ? 'Applying...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => rejectEdit(edit.id)}
                          disabled={executingAll}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {pendingEdits.length > 0 && (
                <div className="border-t border-slate-200 p-3 space-y-2">
                  <button
                    onClick={acceptAllEdits}
                    disabled={executingAll}
                    className="w-full px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {executingAll ? 'Applying All...' : `Accept All (${pendingEdits.length})`}
                  </button>
                  <button
                    onClick={clearAllEdits}
                    disabled={executingAll}
                    className="w-full px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Discard All
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
