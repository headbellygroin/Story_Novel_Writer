import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import { BUILT_IN_STYLE_RULES } from '../lib/styleRules';
import { checkVisionConnection } from '../services/visionService';
import { checkComfyUIConnection, getAvailableCheckpoints, getAvailableSamplers } from '../services/comfyuiService';
import { DEFAULT_ART_STYLE_PRESETS, ArtStylePreset } from '../lib/artStylePresets';
import { getAvailableVoices, isSpeechSynthesisSupported } from '../services/voiceChatService';

type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];

export default function Settings() {
  const { currentProjectId } = useStore();
  const [settings, setSettings] = useState<Partial<GenerationSettings>>({
    model_name: 'local-model',
    api_endpoint: 'http://localhost:5000/v1/completions',
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 0.9,
    top_k: 40,
    repetition_penalty: 1.1,
    presence_penalty: 0,
    frequency_penalty: 0,
    context_length: 4096,
    system_prompt: 'You are a creative fiction writer helping to write a novel. Write engaging, vivid prose that matches the style and tone of the project.',
    style_guide: '',
    style_rules: {},
    vision_model_name: 'llava-1.6-mistral-7b',
    comfyui_endpoint: 'http://127.0.0.1:8188',
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
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [visionStatus, setVisionStatus] = useState<'unchecked' | 'connected' | 'disconnected'>('unchecked');
  const [checkingVision, setCheckingVision] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<'unchecked' | 'connected' | 'disconnected'>('unchecked');
  const [checkingComfy, setCheckingComfy] = useState(false);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [samplers, setSamplers] = useState<string[]>([]);
  const [workflowText, setWorkflowText] = useState('');
  const [ttsWorkflowText, setTtsWorkflowText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      loadSettings();
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (isSpeechSynthesisSupported()) {
      const loadVoices = () => setVoices(getAvailableVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  async function loadSettings() {
    if (!currentProjectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('generation_settings')
        .select('*')
        .eq('project_id', currentProjectId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        setExistingId(data.id);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!currentProjectId) return;

    setSaving(true);
    try {
      const payload = {
        ...settings,
        project_id: currentProjectId,
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await supabase
          .from('generation_settings')
          .update(payload)
          .eq('id', existingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('generation_settings')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        setExistingId(data.id);
      }

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckVision() {
    setCheckingVision(true);
    const connected = await checkVisionConnection();
    setVisionStatus(connected ? 'connected' : 'disconnected');
    setCheckingVision(false);
  }

  async function handleCheckComfyUI() {
    setCheckingComfy(true);
    const endpoint = (settings.comfyui_endpoint as string) || 'http://127.0.0.1:8188';
    const connected = await checkComfyUIConnection(endpoint);
    setComfyStatus(connected ? 'connected' : 'disconnected');

    if (connected) {
      const [ckpts, smpls] = await Promise.all([
        getAvailableCheckpoints(endpoint),
        getAvailableSamplers(endpoint),
      ]);
      setCheckpoints(ckpts);
      setSamplers(smpls);
    }
    setCheckingComfy(false);
  }

  function handleTtsWorkflowImport() {
    try {
      const parsed = JSON.parse(ttsWorkflowText);
      setSettings({ ...settings, comfyui_tts_workflow: parsed });
      alert('TTS Workflow imported successfully');
    } catch {
      alert('Invalid JSON. Please paste a valid ComfyUI API-format workflow.');
    }
  }

  function getArtPresets(): ArtStylePreset[] {
    const presets = settings.art_style_presets;
    if (Array.isArray(presets)) return presets as unknown as ArtStylePreset[];
    return [];
  }

  function setArtPresets(presets: ArtStylePreset[]) {
    setSettings({ ...settings, art_style_presets: JSON.parse(JSON.stringify(presets)) });
  }

  function updateArtPreset(presetId: string, field: keyof ArtStylePreset, value: string | number | null) {
    const presets = getArtPresets();
    const updated = presets.map((p) => p.id === presetId ? { ...p, [field]: value } : p);
    setArtPresets(updated);
  }

  function addDefaultPresets() {
    const existing = getArtPresets();
    const existingIds = new Set(existing.map((p) => p.id));
    const newPresets = DEFAULT_ART_STYLE_PRESETS.filter((p) => !existingIds.has(p.id));
    setArtPresets([...existing, ...newPresets]);
  }

  function removePreset(presetId: string) {
    const presets = getArtPresets().filter((p) => p.id !== presetId);
    setArtPresets(presets);
    if (editingPresetId === presetId) setEditingPresetId(null);
  }

  function addCustomPreset() {
    const presets = getArtPresets();
    const newPreset: ArtStylePreset = {
      id: `custom-${Date.now()}`,
      name: 'New Style',
      checkpoint: '',
      promptPrefix: '',
      promptSuffix: '',
      negativePrompt: '',
      samplerOverride: '',
      stepsOverride: null,
      cfgOverride: null,
    };
    setArtPresets([...presets, newPreset]);
    setEditingPresetId(newPreset.id);
  }

  function handleWorkflowImport() {
    try {
      const parsed = JSON.parse(workflowText);
      setSettings({ ...settings, comfyui_workflow: parsed });
      alert('Workflow imported successfully');
    } catch {
      alert('Invalid JSON. Please paste a valid ComfyUI API-format workflow.');
    }
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
        <div className="text-center text-slate-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">AI Generation Settings</h1>
        <ProjectSelector />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">Uncensored Local Models</h3>
          <p className="text-sm text-amber-800 mb-3">
            This application works with uncensored local AI models, giving you complete creative freedom without content restrictions or ethical guardrails.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-amber-900 mb-1">Recommended Models:</p>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• MythoMax 13B (creative, uncensored)</li>
                <li>• Nous Hermes 2 Yi 34B (coherent)</li>
                <li>• Goliath 120B (top tier, high VRAM)</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900 mb-1">Backend Options:</p>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• text-generation-webui (best)</li>
                <li>• LM Studio (user-friendly)</li>
                <li>• KoboldAI</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Model Name
            </label>
            <input
              type="text"
              value={settings.model_name || ''}
              onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="local-model"
            />
            <p className="text-xs text-slate-500 mt-1">Identifier for your local model</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              API Endpoint
            </label>
            <input
              type="text"
              value={settings.api_endpoint || ''}
              onChange={(e) => setSettings({ ...settings, api_endpoint: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="http://localhost:5000/v1/completions"
            />
            <p className="text-xs text-slate-500 mt-1">
              URL of your local model's API endpoint (OpenAI-compatible format)
            </p>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Vision / Image Analysis</h3>
            <p className="text-sm text-slate-500 mb-4">
              Analyzes uploaded reference images using LM Studio with a vision model (e.g. LLaVA).
              Make sure LM Studio's local server is running on port 1234 with a vision-capable model loaded.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCheckVision}
                  disabled={checkingVision}
                  className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {checkingVision ? 'Checking...' : 'Test LM Studio Connection'}
                </button>
                {visionStatus === 'connected' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Connected to LM Studio
                  </p>
                )}
                {visionStatus === 'disconnected' && (
                  <p className="text-xs text-red-600">
                    Cannot reach LM Studio at port 1234. Make sure the local server is running.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vision Model Name
                </label>
                <input
                  type="text"
                  value={settings.vision_model_name || 'llava-1.6-mistral-7b'}
                  onChange={(e) => setSettings({ ...settings, vision_model_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="llava-1.6-mistral-7b"
                />
                <p className="text-xs text-slate-500 mt-1">
                  The API Model Identifier shown in LM Studio's Local Server tab when a model is loaded.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Scene-to-Image (ComfyUI)</h3>
            <p className="text-sm text-slate-500 mb-4">
              Generate images from your scenes using ComfyUI running locally.
              Make sure ComfyUI is running before testing the connection.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCheckComfyUI}
                  disabled={checkingComfy}
                  className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {checkingComfy ? 'Checking...' : 'Test ComfyUI Connection'}
                </button>
                {comfyStatus === 'connected' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Connected to ComfyUI
                  </p>
                )}
                {comfyStatus === 'disconnected' && (
                  <p className="text-xs text-red-600">
                    Cannot reach ComfyUI. Make sure it is running at the configured endpoint.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ComfyUI Endpoint
                </label>
                <input
                  type="text"
                  value={(settings.comfyui_endpoint as string) || 'http://127.0.0.1:8188'}
                  onChange={(e) => setSettings({ ...settings, comfyui_endpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="http://127.0.0.1:8188"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Checkpoint Model
                </label>
                {checkpoints.length > 0 ? (
                  <select
                    value={(settings.comfyui_checkpoint as string) || ''}
                    onChange={(e) => setSettings({ ...settings, comfyui_checkpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Select a checkpoint...</option>
                    {checkpoints.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={(settings.comfyui_checkpoint as string) || ''}
                    onChange={(e) => setSettings({ ...settings, comfyui_checkpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="e.g. v1-5-pruned-emaonly.safetensors"
                  />
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Connect to ComfyUI to auto-detect available models, or type the filename manually.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Image Width
                  </label>
                  <input
                    type="number"
                    step="64"
                    min="256"
                    max="2048"
                    value={settings.image_width || 768}
                    onChange={(e) => setSettings({ ...settings, image_width: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Image Height
                  </label>
                  <input
                    type="number"
                    step="64"
                    min="256"
                    max="2048"
                    value={settings.image_height || 512}
                    onChange={(e) => setSettings({ ...settings, image_height: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Steps
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="150"
                    value={settings.image_steps || 25}
                    onChange={(e) => setSettings({ ...settings, image_steps: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">More steps = higher quality, slower</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    CFG Scale
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="30"
                    value={settings.image_cfg_scale || 7}
                    onChange={(e) => setSettings({ ...settings, image_cfg_scale: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">How closely to follow the prompt (7-8 typical)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sampler
                </label>
                {samplers.length > 0 ? (
                  <select
                    value={(settings.image_sampler as string) || 'euler_ancestral'}
                    onChange={(e) => setSettings({ ...settings, image_sampler: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {samplers.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={(settings.image_sampler as string) || 'euler_ancestral'}
                    onChange={(e) => setSettings({ ...settings, image_sampler: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="euler_ancestral"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Negative Prompt
                </label>
                <textarea
                  value={(settings.image_negative_prompt as string) || ''}
                  onChange={(e) => setSettings({ ...settings, image_negative_prompt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="text, watermark, blurry, low quality..."
                />
                <p className="text-xs text-slate-500 mt-1">Things to avoid in generated images</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Workflow (Optional)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Paste a ComfyUI API-format workflow JSON. Export it from ComfyUI using "Save (API Format)".
                  Leave empty to use the built-in default workflow.
                </p>
                <textarea
                  value={workflowText}
                  onChange={(e) => setWorkflowText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                  placeholder='{"3": {"class_type": "KSampler", ...}}'
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleWorkflowImport}
                    disabled={!workflowText.trim()}
                    className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    Import Workflow
                  </button>
                  {settings.comfyui_workflow && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettings({ ...settings, comfyui_workflow: null });
                        setWorkflowText('');
                      }}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Clear Custom Workflow
                    </button>
                  )}
                </div>
                {settings.comfyui_workflow && (
                  <p className="text-xs text-green-600 mt-2">Custom workflow loaded. Prompt and settings will be injected automatically.</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Art Style Presets</h3>
            <p className="text-sm text-slate-500 mb-4">
              Map art styles to specific checkpoint models and prompt modifiers. When generating scene images,
              you can pick a style preset to automatically switch the model and adjust prompts.
            </p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addDefaultPresets}
                  className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Add Default Presets
                </button>
                <button
                  type="button"
                  onClick={addCustomPreset}
                  className="px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 transition-colors"
                >
                  Add Custom Preset
                </button>
              </div>

              {getArtPresets().length === 0 && (
                <p className="text-xs text-slate-400 italic">No presets configured. Add default presets or create custom ones.</p>
              )}

              {getArtPresets().map((preset) => (
                <div key={preset.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">{preset.name}</span>
                      {preset.checkpoint && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{preset.checkpoint}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingPresetId(editingPresetId === preset.id ? null : preset.id)}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 transition-colors"
                      >
                        {editingPresetId === preset.id ? 'Collapse' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePreset(preset.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-800 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {editingPresetId === preset.id && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Style Name</label>
                        <input
                          type="text"
                          value={preset.name}
                          onChange={(e) => updateArtPreset(preset.id, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Checkpoint Model</label>
                        {checkpoints.length > 0 ? (
                          <select
                            value={preset.checkpoint}
                            onChange={(e) => updateArtPreset(preset.id, 'checkpoint', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="">Use default checkpoint</option>
                            {checkpoints.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={preset.checkpoint}
                            onChange={(e) => updateArtPreset(preset.id, 'checkpoint', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Leave empty to use default, or enter checkpoint filename"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Prompt Prefix</label>
                        <input
                          type="text"
                          value={preset.promptPrefix}
                          onChange={(e) => updateArtPreset(preset.id, 'promptPrefix', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="e.g. epic fantasy illustration, detailed digital painting,"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Prompt Suffix</label>
                        <input
                          type="text"
                          value={preset.promptSuffix}
                          onChange={(e) => updateArtPreset(preset.id, 'promptSuffix', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="e.g. cinematic lighting, 8k, highly detailed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Negative Prompt Override</label>
                        <input
                          type="text"
                          value={preset.negativePrompt}
                          onChange={(e) => updateArtPreset(preset.id, 'negativePrompt', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="Leave empty to use default negative prompt"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Steps Override</label>
                          <input
                            type="number"
                            value={preset.stepsOverride ?? ''}
                            onChange={(e) => updateArtPreset(preset.id, 'stepsOverride', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Default"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">CFG Override</label>
                          <input
                            type="number"
                            step="0.5"
                            value={preset.cfgOverride ?? ''}
                            onChange={(e) => updateArtPreset(preset.id, 'cfgOverride', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Default"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Sampler Override</label>
                          <input
                            type="text"
                            value={preset.samplerOverride}
                            onChange={(e) => updateArtPreset(preset.id, 'samplerOverride', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Default"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Text-to-Speech (ComfyUI TTS)</h3>
            <p className="text-sm text-slate-500 mb-4">
              Use a ComfyUI TTS workflow to generate narration audio from your story text.
              Import a workflow that has a text input node and produces audio output.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  TTS Speaker / Voice
                </label>
                <input
                  type="text"
                  value={(settings.comfyui_tts_speaker as string) || ''}
                  onChange={(e) => setSettings({ ...settings, comfyui_tts_speaker: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. narrator, en_speaker_0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Speaker name passed to the TTS workflow. Depends on your TTS model.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sample Rate
                </label>
                <input
                  type="number"
                  value={(settings.comfyui_tts_sample_rate as number) || 24000}
                  onChange={(e) => setSettings({ ...settings, comfyui_tts_sample_rate: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  TTS Workflow (ComfyUI API Format)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Paste a ComfyUI API-format workflow that takes text input and produces audio.
                </p>
                <textarea
                  value={ttsWorkflowText}
                  onChange={(e) => setTtsWorkflowText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                  placeholder='{"1": {"class_type": "TextInput", ...}}'
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleTtsWorkflowImport}
                    disabled={!ttsWorkflowText.trim()}
                    className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    Import TTS Workflow
                  </button>
                  {settings.comfyui_tts_workflow && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettings({ ...settings, comfyui_tts_workflow: null });
                        setTtsWorkflowText('');
                      }}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Clear TTS Workflow
                    </button>
                  )}
                </div>
                {settings.comfyui_tts_workflow && (
                  <p className="text-xs text-green-600 mt-2">TTS workflow loaded. Text and speaker will be injected automatically.</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Voice Chat Settings</h3>
            <p className="text-sm text-slate-500 mb-4">
              Configure browser-based speech recognition and synthesis for voice chat with your AI assistant.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Response Voice
                </label>
                <select
                  value={(settings.voice_chat_voice as string) || ''}
                  onChange={(e) => setSettings({ ...settings, voice_chat_voice: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">System Default</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Speech Rate ({Number(settings.voice_chat_rate || 1).toFixed(1)}x)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={Number(settings.voice_chat_rate) || 1}
                    onChange={(e) => setSettings({ ...settings, voice_chat_rate: parseFloat(e.target.value) })}
                    className="w-full accent-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Speech Pitch ({Number(settings.voice_chat_pitch || 1).toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={Number(settings.voice_chat_pitch) || 1}
                    onChange={(e) => setSettings({ ...settings, voice_chat_pitch: parseFloat(e.target.value) })}
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Generation Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Temperature
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="2"
                  value={settings.temperature || 0.7}
                  onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">0-2.0 (higher = more creative/random)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  max="4000"
                  value={settings.max_tokens || 1000}
                  onChange={(e) => setSettings({ ...settings, max_tokens: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">Maximum tokens per generation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Top P (Nucleus Sampling)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.top_p || 0.9}
                  onChange={(e) => setSettings({ ...settings, top_p: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">0-1.0 (0.9 recommended)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Top K
                </label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={settings.top_k || 40}
                  onChange={(e) => setSettings({ ...settings, top_k: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">0-100 (40 recommended)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Repetition Penalty
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1"
                  max="1.5"
                  value={settings.repetition_penalty || 1.1}
                  onChange={(e) => setSettings({ ...settings, repetition_penalty: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">1.0-1.5 (prevents word repetition)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Context Length
                </label>
                <input
                  type="number"
                  step="512"
                  min="2048"
                  max="32768"
                  value={settings.context_length || 4096}
                  onChange={(e) => setSettings({ ...settings, context_length: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">Model's max context window</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Presence Penalty
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={settings.presence_penalty || 0}
                  onChange={(e) => setSettings({ ...settings, presence_penalty: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">-2 to 2 (encourages new topics)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Frequency Penalty
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={settings.frequency_penalty || 0}
                  onChange={(e) => setSettings({ ...settings, frequency_penalty: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">-2 to 2 (reduces word frequency)</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              System Prompt
            </label>
            <textarea
              value={settings.system_prompt || ''}
              onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="You are a creative fiction writer..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Base instructions for the AI about its role and behavior
            </p>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Style Rules</h3>
            <p className="text-sm text-slate-500 mb-4">
              Toggle rules to enforce in generated prose. Active rules are injected into every AI prompt.
            </p>
            <div className="space-y-3">
              {BUILT_IN_STYLE_RULES.map((rule) => {
                const styleRules = (settings.style_rules || {}) as Record<string, boolean>;
                const isActive = !!styleRules[rule.id];
                return (
                  <label
                    key={rule.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => {
                        const updated = { ...styleRules, [rule.id]: !isActive };
                        setSettings({ ...settings, style_rules: updated });
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{rule.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{rule.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Style Guide
            </label>
            <textarea
              value={settings.style_guide || ''}
              onChange={(e) => setSettings({ ...settings, style_guide: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Write in third person limited POV. Use vivid sensory details. Keep dialogue natural and character-specific..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Custom writing style guidelines for this project (POV, tense, tone, etc.)
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-50 rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Example Endpoints</h2>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium text-slate-700">text-generation-webui:</div>
            <code className="text-slate-600">http://localhost:5000/v1/completions</code>
          </div>
          <div>
            <div className="font-medium text-slate-700">KoboldAI:</div>
            <code className="text-slate-600">http://localhost:5001/api/v1/generate</code>
          </div>
          <div>
            <div className="font-medium text-slate-700">LM Studio:</div>
            <code className="text-slate-600">http://localhost:1234/v1/completions</code>
          </div>
          <div>
            <div className="font-medium text-slate-700">LocalAI:</div>
            <code className="text-slate-600">http://localhost:8080/v1/completions</code>
          </div>
        </div>
      </div>
    </div>
  );
}
