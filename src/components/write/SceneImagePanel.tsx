import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { generateImage, ComfyUISettings } from '../../services/comfyuiService';
import { buildImagePrompt } from '../../services/imagePromptService';
import { Database } from '../../lib/database.types';

type Scene = Database['public']['Tables']['scenes']['Row'];
type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];

interface SceneImagePanelProps {
  scene: Scene;
  settings: GenerationSettings;
  projectId: string;
  onSceneUpdate: (scene: Scene) => void;
}

export default function SceneImagePanel({ scene, settings, projectId, onSceneUpdate }: SceneImagePanelProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');

  async function handleGenerate(customPrompt?: string) {
    setGenerating(true);
    setError(null);

    try {
      let prompt = customPrompt || scene.image_prompt;

      if (!prompt) {
        const [charsRes, placesRes, thingsRes, projectRes] = await Promise.all([
          supabase.from('characters').select('name, role, personality, image_description').eq('project_id', projectId),
          supabase.from('places').select('name, type, description, image_description').eq('project_id', projectId),
          supabase.from('things').select('name, type, description, image_description').eq('project_id', projectId),
          supabase.from('projects').select('genre').eq('id', projectId).maybeSingle(),
        ]);

        prompt = buildImagePrompt({
          sceneDescription: scene.description,
          sceneContent: scene.content || undefined,
          characters: charsRes.data || undefined,
          places: placesRes.data || undefined,
          things: thingsRes.data || undefined,
          genre: projectRes.data?.genre || undefined,
        });
      }

      const comfySettings: ComfyUISettings = {
        endpoint: settings.comfyui_endpoint || 'http://127.0.0.1:8188',
        workflow: settings.comfyui_workflow as Record<string, unknown> | null,
        checkpoint: settings.comfyui_checkpoint || '',
        width: settings.image_width || 768,
        height: settings.image_height || 512,
        steps: settings.image_steps || 25,
        cfgScale: Number(settings.image_cfg_scale) || 7,
        sampler: settings.image_sampler || 'euler_ancestral',
        negativePrompt: settings.image_negative_prompt || '',
      };

      const imageUrl = await generateImage(prompt, comfySettings);

      const { error: updateError } = await supabase
        .from('scenes')
        .update({
          generated_image_url: imageUrl,
          image_prompt: prompt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scene.id);

      if (updateError) throw updateError;

      onSceneUpdate({
        ...scene,
        generated_image_url: imageUrl,
        image_prompt: prompt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate image';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleEditPrompt() {
    setPromptDraft(scene.image_prompt || '');
    setEditingPrompt(true);
  }

  async function handleSavePrompt() {
    setEditingPrompt(false);
    const { error: updateError } = await supabase
      .from('scenes')
      .update({ image_prompt: promptDraft, updated_at: new Date().toISOString() })
      .eq('id', scene.id);

    if (!updateError) {
      onSceneUpdate({ ...scene, image_prompt: promptDraft });
    }
  }

  async function handleAutoPrompt() {
    const [charsRes, placesRes, thingsRes, projectRes] = await Promise.all([
      supabase.from('characters').select('name, role, personality, image_description').eq('project_id', projectId),
      supabase.from('places').select('name, type, description, image_description').eq('project_id', projectId),
      supabase.from('things').select('name, type, description, image_description').eq('project_id', projectId),
      supabase.from('projects').select('genre').eq('id', projectId).maybeSingle(),
    ]);

    const prompt = buildImagePrompt({
      sceneDescription: scene.description,
      sceneContent: scene.content || undefined,
      characters: charsRes.data || undefined,
      places: placesRes.data || undefined,
      things: thingsRes.data || undefined,
      genre: projectRes.data?.genre || undefined,
    });

    setPromptDraft(prompt);
    setEditingPrompt(true);
  }

  const hasImage = !!scene.generated_image_url;
  const hasCheckpoint = !!settings.comfyui_checkpoint;

  return (
    <div className="border-t border-slate-200 bg-slate-50">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Scene Image</h3>
          <div className="flex gap-2">
            {!editingPrompt && (
              <button
                onClick={handleEditPrompt}
                className="px-2 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              >
                Edit Prompt
              </button>
            )}
            <button
              onClick={handleAutoPrompt}
              className="px-2 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Auto-Prompt
            </button>
          </div>
        </div>

        {editingPrompt && (
          <div className="mb-3">
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              placeholder="Describe the scene you want to generate..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSavePrompt}
                className="px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 transition-colors"
              >
                Save Prompt
              </button>
              <button
                onClick={() => handleGenerate(promptDraft)}
                disabled={generating || !hasCheckpoint || !promptDraft.trim()}
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {generating ? 'Generating...' : 'Generate from This'}
              </button>
              <button
                onClick={() => setEditingPrompt(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!editingPrompt && scene.image_prompt && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-3 italic">
            {scene.image_prompt}
          </p>
        )}

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {!hasCheckpoint && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              No checkpoint model configured. Go to Settings to set up ComfyUI.
            </p>
          </div>
        )}

        {hasImage && (
          <div className="mb-3 relative group">
            <img
              src={scene.generated_image_url}
              alt={`Scene: ${scene.title}`}
              className="w-full rounded-lg border border-slate-200 shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors" />
          </div>
        )}

        {!editingPrompt && (
          <button
            onClick={() => handleGenerate()}
            disabled={generating || !hasCheckpoint}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              generating
                ? 'bg-sky-100 text-sky-700 cursor-wait'
                : hasCheckpoint
                  ? 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Image...
              </span>
            ) : hasImage ? (
              'Regenerate Image'
            ) : (
              'Generate Scene Image'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
