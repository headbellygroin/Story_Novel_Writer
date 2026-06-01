import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore, ConnStatus } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import { BUILT_IN_STYLE_RULES } from '../lib/styleRules';
import { checkVisionConnection } from '../services/visionService';
import { checkComfyUIConnection, getQueueStatus, QueueStatus, IMAGE_DIMENSIONS, ImageOrientation, ImageNoiseMode } from '../services/comfyuiService';
import { aiProxyGet } from '../lib/proxyFetch';
import { clearEndpointCache } from '../lib/endpointResolver';
import { getAvailableVoices, isSpeechSynthesisSupported } from '../services/voiceChatService';
import { LIPSYNC_DIMENSIONS, LipsyncOrientation, LipsyncNoiseMode } from '../services/comfyuiLipsyncService';

type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ---------------------------------------------------------------------------
// Small helper: collapsible section wrapper
// ---------------------------------------------------------------------------
function Section({
  title,
  description,
  children,
  badge,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-slate-200 pt-6 mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between group mb-1"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 text-left">{title}</h3>
          {badge}
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors text-sm">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {description && (
        <p className="text-sm text-slate-500 mb-4">{description}</p>
      )}
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

function ConnDot({ status }: { status: ConnStatus }) {
  if (status === 'connected') return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />;
  if (status === 'disconnected') return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
  if (status === 'checking') return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />;
}

function PresetEditor({
  mode,
  preset,
  onSave,
  onCancel,
  saving,
}: {
  mode: { key: string; label: string; description: string };
  preset: { id?: string; task_mode: string; label: string; model_name: string; api_endpoint: string; context_length: number; max_tokens: number; temperature: number; top_p?: number | null; top_k?: number | null; repetition_penalty?: number | null; presence_penalty?: number | null; frequency_penalty?: number | null; notes: string; is_active: boolean };
  onSave: (p: typeof preset) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...preset });

  return (
    <div className="border border-teal-300 bg-teal-50/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-teal-800">{mode.label}</span>
          <span className="text-xs text-slate-500 ml-2">{mode.description}</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Active
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Model Name / ID</label>
          <input
            type="text"
            value={form.model_name}
            onChange={(e) => setForm({ ...form, model_name: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="model-name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Display Label</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="Friendly name"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Context Length</label>
          <input
            type="number"
            value={form.context_length}
            onChange={(e) => setForm({ ...form, context_length: parseInt(e.target.value) || 4096 })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Max Tokens (output)</label>
          <input
            type="number"
            value={form.max_tokens}
            onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 1200 })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Temperature</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="2"
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.6 })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Top P</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={form.top_p ?? ''}
            onChange={(e) => setForm({ ...form, top_p: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="0.9"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Top K</label>
          <input
            type="number"
            min="0"
            value={form.top_k ?? ''}
            onChange={(e) => setForm({ ...form, top_k: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Rep. Pen.</label>
          <input
            type="number"
            step="0.05"
            min="1"
            max="2"
            value={form.repetition_penalty ?? ''}
            onChange={(e) => setForm({ ...form, repetition_penalty: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="1.05"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pres. Pen.</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="2"
            value={form.presence_penalty ?? ''}
            onChange={(e) => setForm({ ...form, presence_penalty: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Freq. Pen.</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="2"
            value={form.frequency_penalty ?? ''}
            onChange={(e) => setForm({ ...form, frequency_penalty: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">API Endpoint (leave blank to use default)</label>
          <input
            type="text"
            value={form.api_endpoint}
            onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="http://localhost:1234/v1/chat/completions"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes / Reminder</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Why this model for this task..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.model_name}
          className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Preset'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded hover:bg-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Settings() {
  const { currentProjectId } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings>>({
    model_name: 'midnight-miqu-70b-v1.5',
    api_endpoint: 'http://localhost:1234/v1/chat/completions',
    remote_api_endpoint: '',
    remote_comfyui_endpoint: '',
    temperature: 0.85,
    max_tokens: 4000,
    top_p: 0.92,
    top_k: 0,
    repetition_penalty: 1.15,
    presence_penalty: 0.1,
    frequency_penalty: 0.05,
    context_length: 32768,
    system_prompt: 'You are a creative fiction writer helping to write a novel. Write engaging, vivid prose that matches the style and tone of the project.',
    style_guide: '',
    style_rules: {},
    vision_model_name: 'llava-v1.6-mistral-7b',
    vision_api_endpoint: '',
    comfyui_endpoint: 'http://desktop-fbpj753:8188',
    comfyui_checkpoint: '',
    comfyui_workflow: null,
    image_width: 768,
    image_height: 512,
    image_steps: 25,
    image_cfg_scale: 7.0,
    image_sampler: 'euler_ancestral',
    image_negative_prompt: 'text, watermark, signature, blurry, low quality, deformed, ugly, bad anatomy, extra limbs',
    comfyui_tts_workflow: null,
    comfyui_tts_speaker: '',
    comfyui_tts_sample_rate: 24000,
    voice_chat_enabled: false,
    voice_chat_voice: '',
    voice_chat_rate: 1.0,
    voice_chat_pitch: 1.0,
    art_style_presets: [],
  });

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [existingId, setExistingId] = useState<string | null>(null);

  // Model presets state
  interface ModelPreset {
    id?: string;
    task_mode: string;
    label: string;
    model_name: string;
    api_endpoint: string;
    context_length: number;
    max_tokens: number;
    temperature: number;
    top_p?: number | null;
    top_k?: number | null;
    repetition_penalty?: number | null;
    presence_penalty?: number | null;
    frequency_penalty?: number | null;
    notes: string;
    is_active: boolean;
  }

  const TASK_MODES = [
    { key: 'design_brief', label: 'Design Brief', description: 'Chapter/scene design briefs, planning documents' },
    { key: 'tag_recommendation', label: 'Tag Recommendation', description: 'Automatic context tag recommendation after briefs' },
    { key: 'outline', label: 'Outline', description: 'Book, chapter, and scene outlines, franchise planning' },
    { key: 'scene', label: 'Scene Writing', description: 'Scene generation, dialogue, character interactions' },
    { key: 'rewrite', label: 'Rewrite / Polish', description: 'Editing, rewrite passes, improvement plans, implement edits' },
    { key: 'brainstorm', label: 'Brainstorm', description: 'Idea generation, what-if analysis, story exploration' },
    { key: 'utility', label: 'Fast Utility', description: 'Summaries, metadata, formatting, tag cleanup, token analysis' },
    { key: 'vision', label: 'Vision / Image Analysis', description: 'Image review, character art, cover review, visual consistency' },
    { key: 'vision_quick', label: 'Quick Image Captioning', description: 'Fast image captions, basic visual checks' },
  ] as const;

  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [presetSaveStatus, setPresetSaveStatus] = useState<SaveStatus>('idle');

  // Connection states - persisted in store so they survive navigation
  const { aiConnStatus: aiStatus, visionConnStatus: visionStatus, comfyConnStatus: comfyStatus, setAiConnStatus: setAiStatus, setVisionConnStatus: setVisionStatus, setComfyConnStatus: setComfyStatus } = useStore();
  const [aiError, setAiError] = useState('');
  const [comfyError, setComfyError] = useState('');
  const [comfyQueue, setComfyQueue] = useState<QueueStatus | null>(null);


  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (currentProjectId) loadSettings();
  }, [currentProjectId]);

  useEffect(() => {
    if (isSpeechSynthesisSupported()) {
      const load = () => setVoices(getAvailableVoices());
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  async function loadSettings() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [settingsRes, presetsRes] = await Promise.all([
        supabase.from('generation_settings').select('*').eq('project_id', currentProjectId).maybeSingle(),
        supabase.from('model_presets').select('*').eq('project_id', currentProjectId).order('task_mode'),
      ]);
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
      if (settingsRes.data) {
        setSettings(settingsRes.data);
        setExistingId(settingsRes.data.id);
      }
      setPresets(presetsRes.data || []);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!currentProjectId) return;
    setSaveStatus('saving');
    try {
      const payload = { ...settings, project_id: currentProjectId, updated_at: new Date().toISOString() };
      if (existingId) {
        const { error } = await supabase.from('generation_settings').update(payload).eq('id', existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('generation_settings').insert([payload]).select().single();
        if (error) throw error;
        setExistingId(data.id);
      }
      setSaveStatus('saved');
      clearEndpointCache();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  }

  // ---------------------------------------------------------------------------
  // Model Presets
  // ---------------------------------------------------------------------------

  async function savePreset(preset: ModelPreset) {
    if (!currentProjectId) return;
    setPresetSaveStatus('saving');
    try {
      const payload = {
        project_id: currentProjectId,
        task_mode: preset.task_mode,
        label: preset.label,
        model_name: preset.model_name,
        api_endpoint: preset.api_endpoint || settings.api_endpoint || '',
        context_length: preset.context_length,
        max_tokens: preset.max_tokens,
        temperature: preset.temperature,
        top_p: preset.top_p ?? null,
        top_k: preset.top_k ?? null,
        repetition_penalty: preset.repetition_penalty ?? null,
        presence_penalty: preset.presence_penalty ?? null,
        frequency_penalty: preset.frequency_penalty ?? null,
        notes: preset.notes || '',
        is_active: preset.is_active,
        updated_at: new Date().toISOString(),
      };

      if (preset.id) {
        const { error } = await supabase.from('model_presets').update(payload).eq('id', preset.id);
        if (error) throw error;
        setPresets(presets.map(p => p.id === preset.id ? { ...preset } : p));
      } else {
        const { data, error } = await supabase.from('model_presets').insert([payload]).select().single();
        if (error) throw error;
        setPresets([...presets, { ...preset, id: data.id }]);
      }
      setEditingPreset(null);
      setPresetSaveStatus('saved');
      setTimeout(() => setPresetSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error saving preset:', err);
      setPresetSaveStatus('error');
      setTimeout(() => setPresetSaveStatus('idle'), 3000);
    }
  }

  async function deletePreset(presetId: string) {
    if (!confirm('Remove this model preset?')) return;
    try {
      const { error } = await supabase.from('model_presets').delete().eq('id', presetId);
      if (error) throw error;
      setPresets(presets.filter(p => p.id !== presetId));
    } catch (err) {
      console.error('Error deleting preset:', err);
    }
  }

  async function initializeDefaultPresets() {
    if (!currentProjectId) return;
    const endpoint = (settings.api_endpoint as string) || 'http://localhost:1234/v1/chat/completions';
    const defaults: ModelPreset[] = [
      { task_mode: 'design_brief', label: 'Midnight Miqu Planner', model_name: 'midnight-miqu-70b-v1.5', api_endpoint: endpoint, context_length: 32768, max_tokens: 1500, temperature: 0.65, top_p: 0.90, top_k: 0, repetition_penalty: 1.05, presence_penalty: 0, frequency_penalty: 0, notes: 'Planning, chapter briefs, scene briefs, story structure.', is_active: true },
      { task_mode: 'tag_recommendation', label: 'Mistral 7B Tags', model_name: 'mistral-7b-instruct-v0.2.gguf', api_endpoint: endpoint, context_length: 32768, max_tokens: 1000, temperature: 0.10, top_p: 0.85, top_k: 0, repetition_penalty: 1.0, presence_penalty: 0, frequency_penalty: 0, notes: 'Entity analysis only.', is_active: true },
      { task_mode: 'outline', label: 'Midnight Miqu Outline', model_name: 'midnight-miqu-70b-v1.5', api_endpoint: endpoint, context_length: 32768, max_tokens: 1500, temperature: 0.65, top_p: 0.90, top_k: 0, repetition_penalty: 1.05, presence_penalty: 0, frequency_penalty: 0, notes: 'Chapter outlines, book structure, planning.', is_active: true },
      { task_mode: 'scene', label: 'Midnight Miqu Writer', model_name: 'midnight-miqu-70b-v1.5', api_endpoint: endpoint, context_length: 32768, max_tokens: 3000, temperature: 0.85, top_p: 0.92, top_k: 0, repetition_penalty: 1.05, presence_penalty: 0, frequency_penalty: 0, notes: 'Actual story generation.', is_active: true },
      { task_mode: 'rewrite', label: 'Midnight Miqu Editor', model_name: 'midnight-miqu-70b-v1.5', api_endpoint: endpoint, context_length: 32768, max_tokens: 3000, temperature: 0.60, top_p: 0.90, top_k: 0, repetition_penalty: 1.05, presence_penalty: 0, frequency_penalty: 0, notes: 'Editing, cleanup, prose improvement.', is_active: true },
      { task_mode: 'deep_analysis', label: 'Meta Llama Deep Analysis', model_name: 'meta-llama', api_endpoint: endpoint, context_length: 128000, max_tokens: 1500, temperature: 0.40, top_p: 0.9, top_k: 0, repetition_penalty: 1.05, presence_penalty: 0, frequency_penalty: 0, notes: 'Whole manuscript analysis, continuity audits, story bible audits, lore consistency checks, multi-chapter reviews. Slow but thorough.', is_active: true },
      { task_mode: 'brainstorm', label: 'Mistral Brainstorm', model_name: 'mistral-7b-instruct-v0.2.gguf', api_endpoint: endpoint, context_length: 32768, max_tokens: 2000, temperature: 0.90, top_p: 0.9, top_k: 0, repetition_penalty: 1.0, presence_penalty: 0, frequency_penalty: 0, notes: 'Fast idea generation.', is_active: true },
      { task_mode: 'utility', label: 'Mistral Utility', model_name: 'mistral-7b-instruct-v0.2.gguf', api_endpoint: endpoint, context_length: 32768, max_tokens: 1000, temperature: 0.20, top_p: 0.85, top_k: 0, repetition_penalty: 1.0, presence_penalty: 0, frequency_penalty: 0, notes: 'Classification, sorting, metadata work.', is_active: true },
      { task_mode: 'vision', label: 'LLaVA Vision', model_name: 'llava-v1.6-34b', api_endpoint: endpoint, context_length: 4096, max_tokens: 1200, temperature: 0.30, top_p: 0.9, top_k: 0, repetition_penalty: 1.0, presence_penalty: 0, frequency_penalty: 0, notes: 'Detailed image review.', is_active: true },
      { task_mode: 'vision_quick', label: 'LLaVA 7B Quick', model_name: 'llava-v1.6-mistral-7b', api_endpoint: endpoint, context_length: 4096, max_tokens: 500, temperature: 0.30, top_p: 0.9, top_k: 0, repetition_penalty: 1.05, presence_penalty: 0, frequency_penalty: 0, notes: 'Fast captions and image descriptions.', is_active: true },
    ];

    // Clear existing presets for this project, then insert fresh
    await supabase.from('model_presets').delete().eq('project_id', currentProjectId);
    setPresets([]);
    await Promise.all(defaults.map(d => savePreset(d)));
  }

  // ---------------------------------------------------------------------------
  // Connection tests
  // ---------------------------------------------------------------------------

  async function handleCheckAI() {
    setAiStatus('checking');
    setAiError('');
    const localEndpoint = (settings.api_endpoint as string) || 'http://localhost:1234/v1/chat/completions';
    const remoteEndpoint = (settings.remote_api_endpoint as string) || '';

    // Try local first
    try {
      const base = localEndpoint.replace(/\/v1\/.*$/, '');
      const res = await aiProxyGet(`${base}/v1/models`);
      if (res.ok) {
        setAiStatus('connected');
        setAiError('');
        return;
      }
    } catch {
      // local failed, try remote
    }

    // Try remote endpoint
    if (remoteEndpoint) {
      try {
        const base = remoteEndpoint.replace(/\/v1\/.*$/, '');
        const res = await aiProxyGet(`${base}/v1/models`);
        if (res.ok) {
          setAiStatus('connected');
          setAiError('Connected via Tailscale (remote)');
          return;
        } else {
          setAiStatus('disconnected');
          setAiError(`Remote server responded with ${res.status}`);
          return;
        }
      } catch {
        setAiStatus('disconnected');
        setAiError('Could not reach AI server on local or remote endpoint. Check LM Studio is running and Tailscale is connected.');
        return;
      }
    }

    setAiStatus('disconnected');
    setAiError('Could not reach the AI server. Make sure LM Studio is running. If accessing remotely, set the Remote/Tailscale endpoint.');
  }

  async function handleCheckVision() {
    setVisionStatus('checking');
    // Try vision-specific endpoint first, then main endpoints (local then remote)
    const visionEndpoint = (settings.vision_api_endpoint as string) || '';
    const localEndpoint = (settings.api_endpoint as string) || 'http://localhost:1234/v1/chat/completions';
    const remoteEndpoint = (settings.remote_api_endpoint as string) || '';

    const endpointsToTry = [
      visionEndpoint,
      localEndpoint,
      remoteEndpoint,
    ].filter(Boolean);

    for (const ep of endpointsToTry) {
      const connected = await checkVisionConnection(ep);
      if (connected) {
        setVisionStatus('connected');
        return;
      }
    }
    setVisionStatus('disconnected');
  }

  async function handleCheckComfyUI() {
    setComfyStatus('checking');
    setComfyError('');
    setComfyQueue(null);
    const localEndpoint = (settings.comfyui_endpoint as string) || 'http://127.0.0.1:8188';
    const remoteEndpoint = (settings.remote_comfyui_endpoint as string) || '';

    // Try local first
    const localResult = await checkComfyUIConnection(localEndpoint);
    if (localResult.ok) {
      setComfyStatus('connected');
      const queue = await getQueueStatus(localEndpoint);
      setComfyQueue(queue);
      return;
    }

    // Try remote
    if (remoteEndpoint) {
      const remoteResult = await checkComfyUIConnection(remoteEndpoint);
      if (remoteResult.ok) {
        setComfyStatus('connected');
        setComfyError('Connected via Tailscale (remote)');
        const queue = await getQueueStatus(remoteEndpoint);
        setComfyQueue(queue);
        return;
      }
    }

    setComfyStatus('disconnected');
    setComfyError(localResult.error || 'Cannot reach ComfyUI on local or remote endpoint');
  }

  // ---------------------------------------------------------------------------
  // Workflow imports
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------

  if (!currentProjectId) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Loading settings...</div>
      </div>
    );
  }

  const aiEndpoint = settings.api_endpoint || 'http://localhost:1234/v1/chat/completions';
  const comfyEndpoint = (settings.comfyui_endpoint as string) || 'http://desktop-fbpj753:8188';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <ProjectSelector />
      </div>

      {/* Connection overview */}
      <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex gap-3 items-start">
        <span className="text-slate-400 mt-0.5 text-lg leading-none">i</span>
        <div className="text-sm text-slate-700 space-y-1">
          <p><strong>LM Studio</strong> — runs on your AI machine and handles all text generation. Story Forge connects directly to its local API server.</p>
          <p><strong>ComfyUI</strong> — runs on the same AI machine and handles all image, animation, TTS, and lip-sync generation. Story Forge sends workflows, waits for completion, and retrieves all output files automatically.</p>
          <p className="text-slate-500">Enter the hostname or IP of your AI machine below. All generated files are stored in <code className="bg-slate-100 px-1 rounded">ComfyUI/output/</code> and referenced by URL — do not clear that folder between pipeline runs.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">

        {/* ------------------------------------------------------------------ */}
        {/* Fallback AI Configuration                                           */}
        {/* ------------------------------------------------------------------ */}
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Fallback AI Configuration</h2>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Used only when a task does not have an Auto-Routing preset configured. The active workflow should use Model Presets exclusively.
          </p>
          <p className="text-sm text-slate-500 mb-4">
            LM Studio endpoint and model settings. Both <code className="bg-slate-100 px-1 rounded">/v1/chat/completions</code> (recommended) and <code className="bg-slate-100 px-1 rounded">/v1/completions</code> (legacy) are supported.
          </p>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Model Name / ID</label>
                <input
                  type="text"
                  value={settings.model_name || ''}
                  onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="Midnight-Miqu-70B-v1.5.Q4_K_M"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Copy the Model ID from LM Studio's Local Server tab (e.g. <code>Midnight-Miqu-70B-v1.5.Q4_K_M</code>).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Context Length</label>
                <input
                  type="number"
                  step="512"
                  min="2048"
                  max="131072"
                  value={settings.context_length || 4096}
                  onChange={(e) => setSettings({ ...settings, context_length: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Match the context window of your loaded model.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Endpoint (Local)</label>
              <input
                type="text"
                value={aiEndpoint}
                onChange={(e) => setSettings({ ...settings, api_endpoint: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm font-mono"
                placeholder="http://localhost:1234/v1/chat/completions"
              />
              <p className="text-xs text-slate-400 mt-1">
                Used when on the AI machine. LM Studio default: <code className="bg-slate-100 px-1 rounded">http://localhost:1234/v1/chat/completions</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Endpoint (Remote / Tailscale)</label>
              <input
                type="text"
                value={(settings.remote_api_endpoint as string) || ''}
                onChange={(e) => setSettings({ ...settings, remote_api_endpoint: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm font-mono"
                placeholder="http://100.81.168.74:1234/v1/chat/completions"
              />
              <p className="text-xs text-slate-400 mt-1">
                Used when accessing from another machine via Tailscale. Enter your AI machine's Tailscale IP (e.g. <code className="bg-slate-100 px-1 rounded">http://100.81.168.74:1234/v1/chat/completions</code>).
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleCheckAI}
                disabled={aiStatus === 'checking'}
                className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {aiStatus === 'checking' ? 'Checking...' : 'Test AI Connection'}
              </button>
              <div className="flex items-center gap-1.5 text-xs">
                <ConnDot status={aiStatus} />
                {aiStatus === 'unchecked' && <span className="text-slate-400">Not tested yet</span>}
                {aiStatus === 'checking' && <span className="text-amber-600">Connecting…</span>}
                {aiStatus === 'connected' && <span className="text-emerald-600">Connected to LM Studio</span>}
                {aiStatus === 'disconnected' && (
                  <span className="text-red-600">{aiError || 'Cannot reach LM Studio — check the endpoint and that the server is running'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Generation Parameters                                               */}
        {/* ------------------------------------------------------------------ */}
        <Section title="Generation Parameters" description="Tune how the model generates text. These values are sent with every writing request.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Temperature</label>
              <input type="number" step="any" min="0" max="2"
                value={settings.temperature ?? 0.85}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">0–2.0 — higher = more creative / random</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Tokens</label>
              <input type="number" step="1" min="1" max="32000"
                value={settings.max_tokens ?? 4000}
                onChange={(e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Max tokens per generation (output only)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Top P</label>
              <input type="number" step="any" min="0" max="1"
                value={settings.top_p ?? 0.92}
                onChange={(e) => setSettings({ ...settings, top_p: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Nucleus sampling — 0.92 recommended</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Top K</label>
              <input type="number" step="1" min="0" max="200"
                value={settings.top_k ?? 0}
                onChange={(e) => setSettings({ ...settings, top_k: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">0 = disabled; lets Top P handle sampling alone</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Repetition Penalty</label>
              <input type="number" step="any" min="1" max="2"
                value={settings.repetition_penalty ?? 1.15}
                onChange={(e) => setSettings({ ...settings, repetition_penalty: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">1.0–2.0 — prevents repeated phrases</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Presence Penalty</label>
              <input type="number" step="any" min="-2" max="2"
                value={settings.presence_penalty ?? 0.1}
                onChange={(e) => setSettings({ ...settings, presence_penalty: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Encourages new topics (OpenAI-style)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Frequency Penalty</label>
              <input type="number" step="any" min="-2" max="2"
                value={settings.frequency_penalty ?? 0.05}
                onChange={(e) => setSettings({ ...settings, frequency_penalty: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Reduces word frequency (OpenAI-style)</p>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Model Presets (Auto-Routing)                                        */}
        {/* ------------------------------------------------------------------ */}
        <Section
          title="Model Presets (Auto-Routing)"
          description="Configure which model, context length, and temperature to use for each task type. The system automatically selects the right model based on what you're generating."
        >
          {presets.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-600 mb-3">No model presets configured yet. Set up presets so Story Forge automatically picks the best model for each task.</p>
              <button
                onClick={initializeDefaultPresets}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
              >
                Load Default Presets
              </button>
              <p className="text-xs text-slate-400 mt-2">Pre-fills with recommended defaults: Midnight Miqu 70B (writing/planning), Meta Llama (deep analysis), Mistral 7B (utility), LLaVA (vision)</p>
            </div>
          )}

          {presets.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <button
                  onClick={initializeDefaultPresets}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 border border-slate-300 transition-colors"
                >
                  Reset All to Defaults
                </button>
              </div>
              {TASK_MODES.map(mode => {
                const preset = presets.find(p => p.task_mode === mode.key);
                const isEditing = editingPreset === mode.key;

                if (!preset && !isEditing) {
                  return (
                    <div key={mode.key} className="border border-dashed border-slate-300 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-500">{mode.label}</span>
                        <span className="text-xs text-slate-400 ml-2">Not configured (uses default settings)</span>
                      </div>
                      <button
                        onClick={() => setEditingPreset(mode.key)}
                        className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                      >
                        Configure
                      </button>
                    </div>
                  );
                }

                if (isEditing) {
                  const editData: ModelPreset = preset || {
                    task_mode: mode.key,
                    label: mode.label,
                    model_name: '',
                    api_endpoint: (settings.api_endpoint as string) || '',
                    context_length: 4096,
                    max_tokens: 1200,
                    temperature: 0.6,
                    notes: '',
                    is_active: true,
                  };

                  return (
                    <PresetEditor
                      key={mode.key}
                      mode={mode}
                      preset={editData}
                      onSave={savePreset}
                      onCancel={() => setEditingPreset(null)}
                      saving={presetSaveStatus === 'saving'}
                    />
                  );
                }

                return (
                  <div key={mode.key} className={`border rounded-lg p-3 transition-colors ${preset!.is_active ? 'border-teal-200 bg-teal-50/30' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${preset!.is_active ? 'bg-teal-500' : 'bg-slate-300'}`} />
                        <span className="text-sm font-medium text-slate-800">{mode.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPreset(mode.key)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => preset!.id && deletePreset(preset!.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">Model:</span>
                        <span className="ml-1 font-mono">{preset!.model_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Context:</span>
                        <span className="ml-1 font-mono">{preset!.context_length.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Max Out:</span>
                        <span className="ml-1 font-mono">{preset!.max_tokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Temp:</span>
                        <span className="ml-1 font-mono">{preset!.temperature}</span>
                      </div>
                    </div>
                    {preset!.notes && (
                      <p className="mt-1 text-xs text-slate-400 italic">{preset!.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {presets.length > 0 && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Recommended Workflow</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>1. Design Brief</span><span className="font-mono text-slate-500">Meta Llama (128K ctx)</span>
                <span>2. Tag Recommendation</span><span className="font-mono text-slate-500">Mistral 7B (32K ctx)</span>
                <span>3. Outline</span><span className="font-mono text-slate-500">Meta Llama (128K ctx)</span>
                <span>4. Scene Writing</span><span className="font-mono text-slate-500">Midnight Miqu 70B (32K ctx)</span>
                <span>5. Rewrite / Polish</span><span className="font-mono text-slate-500">Midnight Miqu 70B (32K ctx)</span>
                <span>6. Brainstorm</span><span className="font-mono text-slate-500">Mistral 7B (32K ctx)</span>
                <span>7. Utility</span><span className="font-mono text-slate-500">Mistral 7B (32K ctx)</span>
                <span>8. Vision</span><span className="font-mono text-slate-500">LLaVA 34B (4K ctx)</span>
              </div>
            </div>
          )}
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* System Prompt & Style                                               */}
        {/* ------------------------------------------------------------------ */}
        <Section title="System Prompt & Style">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">System Prompt</label>
            <textarea
              value={settings.system_prompt || ''}
              onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              placeholder="You are a creative fiction writer..."
            />
            <p className="text-xs text-slate-400 mt-1">Base instructions for the AI about its role and behavior</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Style Guide</label>
            <textarea
              value={settings.style_guide || ''}
              onChange={(e) => setSettings({ ...settings, style_guide: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              placeholder="Write in third person limited POV. Use vivid sensory details. Keep dialogue natural and character-specific..."
            />
            <p className="text-xs text-slate-400 mt-1">Project-specific writing style guidelines (POV, tense, tone, etc.)</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Style Rules</p>
            <p className="text-xs text-slate-400 mb-3">Active rules are injected into every AI writing prompt.</p>
            <div className="space-y-2">
              {BUILT_IN_STYLE_RULES.map((rule) => {
                const styleRules = (settings.style_rules || {}) as Record<string, boolean>;
                const isActive = !!styleRules[rule.id];
                return (
                  <label
                    key={rule.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isActive ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => setSettings({ ...settings, style_rules: { ...styleRules, [rule.id]: !isActive } })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{rule.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{rule.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Vision / Image Analysis                                             */}
        {/* ------------------------------------------------------------------ */}
        <Section
          title="Vision / Image Analysis (LM Studio)"
          description="Analyzes reference images using a vision-capable model loaded in LM Studio on your AI machine. Load a vision model (LLaVA, BakLLaVA, etc.) alongside or instead of your writing model."
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vision API Endpoint</label>
              <input
                type="text"
                value={(settings.vision_api_endpoint as string) || ''}
                onChange={(e) => setSettings({ ...settings, vision_api_endpoint: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                placeholder="http://100.81.168.74:1234/v1/chat/completions"
              />
              <p className="text-xs text-slate-400 mt-1">
                Full endpoint URL for the vision model. Leave blank to use the same server as your Writing AI above. If running a separate LM Studio instance for vision, enter its URL here (e.g. <code>http://100.81.168.74:1234/v1/chat/completions</code>).
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Vision Model Name</label>
                <input
                  type="text"
                  value={settings.vision_model_name || 'llava-v1.6-mistral-7b'}
                  onChange={(e) => setSettings({ ...settings, vision_model_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                  placeholder="llava-v1.6-mistral-7b"
                />
                <p className="text-xs text-slate-400 mt-1">
                  The Model ID shown in LM Studio's Local Server tab (e.g. <code>llava-v1.6-mistral-7b</code>). This is just the model name, not a URL.
                </p>
              </div>
              <div className="flex flex-col justify-end">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCheckVision}
                    disabled={visionStatus === 'checking'}
                    className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {visionStatus === 'checking' ? 'Checking...' : 'Test Vision Connection'}
                  </button>
                  <div className="flex items-center gap-1.5 text-xs">
                    <ConnDot status={visionStatus} />
                    {visionStatus === 'unchecked' && <span className="text-slate-400">Not tested</span>}
                    {visionStatus === 'checking' && <span className="text-amber-600">Connecting…</span>}
                    {visionStatus === 'connected' && <span className="text-emerald-600">Connected</span>}
                    {visionStatus === 'disconnected' && <span className="text-red-600">Cannot reach LM Studio vision model — check model is loaded</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* ComfyUI — Scene Images                                              */}
        {/* ------------------------------------------------------------------ */}
        <Section
          title="ComfyUI Connection"
          description="ComfyUI is assumed to be running on your AI machine. This single endpoint is used for all generation — scene images, animation, TTS audio, and lip-sync. Story Forge sends each workflow, waits for completion, and retrieves the output file automatically."
        >
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ComfyUI Endpoint (Local)</label>
                <input
                  type="text"
                  value={comfyEndpoint}
                  onChange={(e) => setSettings({ ...settings, comfyui_endpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm font-mono"
                  placeholder="http://127.0.0.1:8188"
                />
                <p className="text-xs text-slate-400 mt-1">Used when on the AI machine directly.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ComfyUI Endpoint (Remote / Tailscale)</label>
                <input
                  type="text"
                  value={(settings.remote_comfyui_endpoint as string) || ''}
                  onChange={(e) => setSettings({ ...settings, remote_comfyui_endpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm font-mono"
                  placeholder="http://100.81.168.74:8188"
                />
                <p className="text-xs text-slate-400 mt-1">Used when accessing from another machine via Tailscale.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleCheckComfyUI}
                disabled={comfyStatus === 'checking'}
                className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {comfyStatus === 'checking' ? 'Checking...' : 'Test ComfyUI'}
              </button>
              <div className="flex items-center gap-1.5 text-xs">
                <ConnDot status={comfyStatus} />
                {comfyStatus === 'unchecked' && <span className="text-slate-400">Not tested</span>}
                {comfyStatus === 'checking' && <span className="text-amber-600">Connecting…</span>}
                {comfyStatus === 'connected' && (
                  <span className="text-emerald-600">
                    Connected
                    {comfyQueue && ` — ${comfyQueue.isBusy ? `${comfyQueue.queueRunning} running` : 'idle'}`}
                  </span>
                )}
                {comfyStatus === 'disconnected' && (
                  <span className="text-red-600">{comfyError || 'Cannot reach ComfyUI — check the endpoint and that ComfyUI is running'}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Text2Image ─────────────────────────────────────────────────── */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-base font-semibold text-slate-800 mb-0.5">Text2Image</h3>
            <p className="text-xs text-slate-400 mb-4">Configure the Flux workflow for scene image generation.</p>
          </div>

          {/* --- Workflow JSON --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Workflow JSON</p>
            <p className="text-xs text-slate-400 mb-3">
              Upload the ComfyUI workflow JSON (API format) for text-to-image generation.
              Export from ComfyUI using "Save (API Format)" or use the JSON from the API queue.
            </p>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors cursor-pointer">
                {settings.comfyui_workflow ? 'Replace Workflow' : 'Upload Workflow JSON'}
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const json = JSON.parse(text);
                      // Detect graph format (has nodes/links) vs API format (flat node IDs)
                      if (json.nodes && json.links && !json.class_type) {
                        alert('This appears to be a ComfyUI graph-format file (exported via Save). Please export using "Save (API Format)" instead, or use the workflow JSON from the /prompt API endpoint.');
                        return;
                      }
                      setSettings({ ...settings, comfyui_workflow: json } as any);
                    } catch {
                      alert('Invalid JSON file');
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              {settings.comfyui_workflow && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Workflow loaded
                </span>
              )}
              {!settings.comfyui_workflow && (
                <span className="text-sm text-amber-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  No workflow — image generation disabled
                </span>
              )}
            </div>
          </div>

          {/* --- Orientation --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Output Orientation</p>
            <p className="text-xs text-slate-400 mb-3">Sets the image resolution. One image is generated at a time.</p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(IMAGE_DIMENSIONS) as [ImageOrientation, { width: number; height: number }][]).map(
                ([key, dims]) => {
                  const active = ((settings as Record<string, unknown>).image_orientation ?? 'portrait') === key;
                  const labels: Record<ImageOrientation, string> = {
                    portrait: 'Portrait',
                    landscape: 'Landscape',
                    square: 'Square',
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSettings({ ...settings, image_orientation: key } as Partial<GenerationSettings>)}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        active
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className={`border-2 rounded-sm ${active ? 'border-sky-500' : 'border-slate-400'} ${
                        key === 'portrait'  ? 'w-6 h-9' :
                        key === 'landscape' ? 'w-9 h-6' :
                                              'w-7 h-7'
                      }`} />
                      <span className="text-xs font-medium">{labels[key]}</span>
                      <span className="text-xs text-slate-400">{dims.width}×{dims.height}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* --- Noise Seed --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Noise Seed</p>
            <div className="flex gap-3 mb-3">
              {(['random', 'fixed'] as ImageNoiseMode[]).map((mode) => {
                const active = ((settings as Record<string, unknown>).image_noise_mode ?? 'random') === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings({ ...settings, image_noise_mode: mode } as Partial<GenerationSettings>)}
                    className={`px-4 py-1.5 rounded-lg border text-sm transition-all ${
                      active
                        ? 'border-sky-500 bg-sky-50 text-sky-700 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {mode === 'random' ? 'Random (new each time)' : 'Fixed (reproducible)'}
                  </button>
                );
              })}
            </div>
            {((settings as Record<string, unknown>).image_noise_mode ?? 'random') === 'fixed' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Seed Value</label>
                <input
                  type="number"
                  min="0"
                  value={((settings as Record<string, unknown>).image_noise_seed as number) ?? 42}
                  onChange={(e) => setSettings({ ...settings, image_noise_seed: parseInt(e.target.value) } as Partial<GenerationSettings>)}
                  className="w-48 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="42"
                />
                <p className="text-xs text-slate-400 mt-1">Same seed + same prompt = same image output.</p>
              </div>
            )}
          </div>

          {/* --- Conditioning / Prompt --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Positive Conditioning</p>
            <p className="text-xs text-slate-400 mb-3">
              These three fields are assembled into the prompt sent to the Flux workflow.
              Describe what should appear in the image. Model, steps, cfg, sampler, and negative prompt are fixed in the workflow.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Background</label>
                <textarea
                  rows={2}
                  value={((settings as Record<string, unknown>).image_background_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, image_background_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="Desert plain of North Africa, sand dunes everywhere. In the far off distance, a small Oasis."
                />
                <p className="text-xs text-slate-400 mt-1">The environment, setting, and atmosphere of the scene.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Foreground</label>
                <textarea
                  rows={2}
                  value={((settings as Record<string, unknown>).image_foreground_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, image_foreground_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="Ancient carved stone arch, scattered pottery shards, golden sand rippled by wind."
                />
                <p className="text-xs text-slate-400 mt-1">Objects, details, and elements in the foreground.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Characters</label>
                <textarea
                  rows={2}
                  value={((settings as Record<string, unknown>).image_characters_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, image_characters_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="A young woman in a white linen robe, dark hair braided, shielding her eyes from the sun."
                />
                <p className="text-xs text-slate-400 mt-1">Characters present, their appearance and positioning.</p>
              </div>
            </div>
          </div>

          {/* --- Technical note --- */}
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="font-medium text-slate-600 mb-1">What Story Forge injects automatically</p>
            <ul className="space-y-0.5 text-slate-500">
              <li>· Width &amp; Height — from orientation above</li>
              <li>· Batch Size — always 1</li>
              <li>· Seed — random or fixed value above</li>
              <li>· Model, steps, cfg, sampler, negative prompt — fixed in the workflow</li>
            </ul>
          </div>
        </Section>



        {/* ------------------------------------------------------------------ */}
        {/* TTS                                                                 */}
        {/* ------------------------------------------------------------------ */}
        <Section
          title="Text-to-Speech (ComfyUI TTS)"
          description="Converts chapter text to narration audio via ComfyUI on your AI machine. The built-in TTS workflow is sent automatically — configure your voice and sample rate below."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">TTS Speaker / Voice</label>
              <input
                type="text"
                value={(settings.comfyui_tts_speaker as string) || ''}
                onChange={(e) => setSettings({ ...settings, comfyui_tts_speaker: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                placeholder="e.g. narrator, en_speaker_0"
              />
              <p className="text-xs text-slate-400 mt-1">Speaker name passed to your TTS model.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sample Rate</label>
              <input
                type="number"
                value={(settings.comfyui_tts_sample_rate as number) || 24000}
                onChange={(e) => setSettings({ ...settings, comfyui_tts_sample_rate: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
              />
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Animation                                                           */}
        {/* ------------------------------------------------------------------ */}
        <Section
          title="Image Animation (ComfyUI)"
          description="Animates story images via ComfyUI on your AI machine using the built-in LTX 2.3 Text2Video workflow. Generates at 30 fps / 5 seconds. Output is retrieved automatically and converted to .gif for use in audiobooks and video exports."
        >
          {/* --- Prompt Fields --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Animation Prompt</p>
            <p className="text-xs text-slate-400 mb-3">
              These two fields are assembled into the prompt sent to the workflow. Each is prefixed with its label automatically.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Describe the image <span className="text-slate-400 font-normal">→ sent as "Describe the image: …"</span>
                </label>
                <textarea
                  rows={2}
                  value={((settings as Record<string, unknown>).animation_describe_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, animation_describe_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="A small sailing ship on the sea during a light storm, waves gently rocking the boat."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  What needs to be animated <span className="text-slate-400 font-normal">→ sent as "What needs to be animated: …"</span>
                </label>
                <textarea
                  rows={2}
                  value={((settings as Record<string, unknown>).animation_action_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, animation_action_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="Waves moving, ship rocking, sails billowing in the wind."
                />
              </div>
            </div>
          </div>

          {/* --- Orientation --- */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Output Orientation</label>
            <div className="flex gap-2">
              {(['portrait', 'landscape', 'square'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setSettings({ ...settings, animation_orientation: o } as Partial<GenerationSettings>)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    (((settings as Record<string, unknown>).animation_orientation as string) ?? 'portrait') === o
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'border-slate-300 text-slate-600 hover:border-sky-400'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* --- Seed --- */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Seed Mode</label>
            <div className="flex gap-2 mb-3">
              {(['random', 'fixed'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSettings({ ...settings, animation_noise_mode: m } as Partial<GenerationSettings>)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    (((settings as Record<string, unknown>).animation_noise_mode as string) ?? 'random') === m
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'border-slate-300 text-slate-600 hover:border-sky-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {(((settings as Record<string, unknown>).animation_noise_mode as string) ?? 'random') === 'fixed' && (
              <input
                type="number"
                value={((settings as Record<string, unknown>).animation_noise_seed as number) ?? 42}
                onChange={(e) => setSettings({ ...settings, animation_noise_seed: parseInt(e.target.value) || 42 } as Partial<GenerationSettings>)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                placeholder="42"
              />
            )}
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Lip-sync                                                            */}
        {/* ------------------------------------------------------------------ */}
        <Section
          title="Lip-sync (ComfyUI LTX 2.3)"
          description="Generates animated lip-sync video from a character image and TTS audio via ComfyUI on your AI machine. Story Forge uploads both files, sends the built-in LTX 2.3 workflow, and retrieves the output video automatically."
        >
          {/* --- Orientation --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Output Orientation</p>
            <p className="text-xs text-slate-400 mb-3">Sets the video resolution sent to ComfyUI.</p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(LIPSYNC_DIMENSIONS) as [LipsyncOrientation, { width: number; height: number }][]).map(
                ([key, dims]) => {
                  const active = ((settings as Record<string, unknown>).lipsync_orientation ?? 'portrait') === key;
                  const labels: Record<LipsyncOrientation, string> = {
                    portrait: 'Portrait',
                    landscape: 'Landscape',
                    square: 'Square',
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSettings({ ...settings, lipsync_orientation: key } as Partial<GenerationSettings>)}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        active
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {/* Orientation icon */}
                      <div className={`border-2 rounded-sm ${active ? 'border-sky-500' : 'border-slate-400'} ${
                        key === 'portrait'  ? 'w-6 h-9' :
                        key === 'landscape' ? 'w-9 h-6' :
                                              'w-7 h-7'
                      }`} />
                      <span className="text-xs font-medium">{labels[key]}</span>
                      <span className="text-xs text-slate-400">{dims.width}×{dims.height}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* --- Noise Seed --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Noise Seed</p>
            <div className="flex gap-3 mb-3">
              {(['random', 'fixed'] as LipsyncNoiseMode[]).map((mode) => {
                const active = ((settings as Record<string, unknown>).lipsync_noise_mode ?? 'random') === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings({ ...settings, lipsync_noise_mode: mode } as Partial<GenerationSettings>)}
                    className={`px-4 py-1.5 rounded-lg border text-sm transition-all ${
                      active
                        ? 'border-sky-500 bg-sky-50 text-sky-700 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {mode === 'random' ? 'Random (new each time)' : 'Fixed (reproducible)'}
                  </button>
                );
              })}
            </div>
            {((settings as Record<string, unknown>).lipsync_noise_mode ?? 'random') === 'fixed' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Seed Value</label>
                <input
                  type="number"
                  min="0"
                  value={((settings as Record<string, unknown>).lipsync_noise_seed as number) ?? 42}
                  onChange={(e) => setSettings({ ...settings, lipsync_noise_seed: parseInt(e.target.value) } as Partial<GenerationSettings>)}
                  className="w-48 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="42"
                />
                <p className="text-xs text-slate-400 mt-1">Same seed + same inputs = same video output.</p>
              </div>
            )}
          </div>

          {/* --- Prompt fields --- */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Scene Prompt</p>
            <p className="text-xs text-slate-400 mb-3">
              These two fields are combined into the prompt sent to the LTX 2.3 Video Generation node.
              Describe what should appear in the video — match what is in the source image.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Background Setting</label>
                <textarea
                  rows={3}
                  value={((settings as Record<string, unknown>).lipsync_background_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, lipsync_background_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="A dimly lit tavern with stone walls, wooden tables, and warm firelight flickering in the background."
                />
                <p className="text-xs text-slate-400 mt-1">Describe the environment, lighting, and atmosphere.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Character Description</label>
                <textarea
                  rows={3}
                  value={((settings as Record<string, unknown>).lipsync_character_prompt as string) ?? ''}
                  onChange={(e) => setSettings({ ...settings, lipsync_character_prompt: e.target.value } as Partial<GenerationSettings>)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                  placeholder="A woman in her 30s with auburn hair, wearing a dark leather jacket, speaking directly to camera."
                />
                <p className="text-xs text-slate-400 mt-1">Describe the character's appearance and what they should match from the source image.</p>
              </div>
            </div>
          </div>

          {/* --- Technical note --- */}
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="font-medium text-slate-600 mb-1">What Story Forge injects automatically</p>
            <ul className="space-y-0.5 text-slate-500">
              <li>· Width &amp; Height — from orientation above</li>
              <li>· Frame Rate — 30 fps (fixed)</li>
              <li>· Duration — matched to your audio clip length</li>
              <li>· Noise Seed — random or fixed value above</li>
              <li>· Image — uploaded from your selected character image</li>
              <li>· Audio — uploaded from TTS or your audio file</li>
            </ul>
          </div>

        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Voice Chat                                                          */}
        {/* ------------------------------------------------------------------ */}
        <Section title="Voice Chat Settings" description="Browser-based speech recognition and synthesis for voice chat with the AI.">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Response Voice</label>
            <select
              value={(settings.voice_chat_voice as string) || ''}
              onChange={(e) => setSettings({ ...settings, voice_chat_voice: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
            >
              <option value="">System Default</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Speech Rate ({Number(settings.voice_chat_rate || 1).toFixed(1)}x)
              </label>
              <input type="range" min="0.5" max="2" step="0.1"
                value={Number(settings.voice_chat_rate) || 1}
                onChange={(e) => setSettings({ ...settings, voice_chat_rate: parseFloat(e.target.value) })}
                className="w-full accent-sky-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Speech Pitch ({Number(settings.voice_chat_pitch || 1).toFixed(1)})
              </label>
              <input type="range" min="0.5" max="2" step="0.1"
                value={Number(settings.voice_chat_pitch) || 1}
                onChange={(e) => setSettings({ ...settings, voice_chat_pitch: parseFloat(e.target.value) })}
                className="w-full accent-sky-600" />
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------------ */}
        {/* Save                                                                */}
        {/* ------------------------------------------------------------------ */}
        <div className="pt-6 mt-6 border-t border-slate-200">
          <div className="flex items-center gap-4">
            <button
              onClick={saveSettings}
              disabled={saveStatus === 'saving'}
              className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 font-medium transition-colors text-sm"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save Settings'}
            </button>
            {saveStatus === 'saved' && (
              <span className="text-sm text-emerald-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Saved to database
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600">Save failed — check console</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick reference */}
      <div className="mt-6 bg-slate-50 rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Reference — What Goes Where</h2>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
            <span className="font-semibold text-slate-800 col-span-2 border-b border-slate-200 pb-1 mb-1">Fallback AI Configuration</span>
            <span className="font-medium text-slate-700">API Endpoint (Local):</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">http://localhost:1234/v1/chat/completions</code>
            <span className="font-medium text-slate-700">Remote / Tailscale:</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">http://100.81.168.74:1234/v1/chat/completions</code>

            <span className="font-semibold text-slate-800 col-span-2 border-b border-slate-200 pb-1 mt-3 mb-1">ComfyUI (Images / TTS / Video)</span>
            <span className="font-medium text-slate-700">ComfyUI (Local):</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">http://127.0.0.1:8188</code>
            <span className="font-medium text-slate-700">Remote / Tailscale:</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">http://100.81.168.74:8188</code>

            <span className="font-semibold text-slate-800 col-span-2 border-b border-slate-200 pb-1 mt-3 mb-1">Vision (Image Analysis)</span>
            <span className="font-medium text-slate-700">Vision Endpoint:</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">http://100.81.168.74:1234/v1/chat/completions</code>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200">
            Local endpoints work on the AI machine. From the school laptop, the app auto-falls back to the Tailscale IP (100.81.168.74).
          </p>
        </div>
      </div>
    </div>
  );
}

