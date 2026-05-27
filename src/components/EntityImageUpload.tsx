import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeImageWithVision } from '../services/visionService';
import { generateImage, ComfyUISettings, ImageOrientation } from '../services/comfyuiService';
import { proxyImageUrl, comfyProxyGet } from '../lib/proxyFetch';
import { getEndpointConfig } from '../lib/endpointResolver';

interface EntityImageUploadProps {
  entityType: string;
  entityName: string;
  imageUrl: string;
  imageDescription: string;
  projectId: string;
  entityDescription?: string;
  onImageChange: (url: string, description: string) => void;
}

function buildEntityPrompt(entityType: string, entityName: string, description: string): string {
  const typeLabel = entityType.replace(/s$/, '');
  const parts: string[] = [];

  if (typeLabel === 'character') {
    parts.push(`character portrait of ${entityName}`);
  } else if (typeLabel === 'place') {
    parts.push(`environment concept art of ${entityName}`);
  } else if (typeLabel === 'thing' || typeLabel === 'technologie') {
    parts.push(`detailed illustration of ${entityName}`);
  } else {
    parts.push(`illustration of ${entityName}`);
  }

  if (description.trim()) {
    const trimmed = description.length > 400 ? description.slice(0, 397) + '...' : description;
    parts.push(trimmed);
  }

  parts.push('cinematic lighting, detailed, high quality');
  return parts.join(', ');
}

export default function EntityImageUpload({
  entityType,
  entityName,
  imageUrl,
  imageDescription,
  projectId,
  entityDescription,
  onImageChange,
}: EntityImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [orientation, setOrientation] = useState<ImageOrientation>('portrait');
  const [comfyEndpoint, setComfyEndpoint] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getEndpointConfig().then((config) => {
      if (config.isRemote && config.remoteComfy) {
        setComfyEndpoint(config.remoteComfy);
      } else {
        setComfyEndpoint(config.localComfy || 'http://127.0.0.1:8188');
      }
    });
  }, [projectId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be under 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const path = `${projectId}/${entityType}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('entity-images')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('entity-images')
        .getPublicUrl(path);

      onImageChange(urlData.publicUrl, imageDescription);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!imageUrl) return;

    setAnalyzing(true);
    setError('');

    try {
      // Fetch image using the proxied URL (handles Tailscale/remote access)
      const resolvedUrl = proxyImageUrl(imageUrl, comfyEndpoint);
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const settingsRes = await supabase
        .from('generation_settings')
        .select('vision_model_name, vision_api_endpoint, api_endpoint')
        .eq('project_id', projectId)
        .maybeSingle();

      const description = await analyzeImageWithVision({
        imageBase64: base64,
        entityType,
        entityName,
        model: settingsRes.data?.vision_model_name || 'llava-1.6-mistral-7b',
        apiEndpoint: settingsRes.data?.vision_api_endpoint || settingsRes.data?.api_endpoint || undefined,
      });

      onImageChange(imageUrl, description);
      setShowDescription(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(`Vision analysis failed: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    setError('');
    setGenerating(true);

    try {
      const settingsRes = await supabase
        .from('generation_settings')
        .select('comfyui_endpoint, comfyui_workflow, image_orientation, image_noise_mode, image_noise_seed')
        .eq('project_id', projectId)
        .maybeSingle();

      const settings = settingsRes.data;
      if (!settings?.comfyui_endpoint) {
        throw new Error('ComfyUI endpoint not configured. Go to Settings to set it up.');
      }
      if (!settings?.comfyui_workflow) {
        throw new Error('No text2image workflow configured. Go to Settings to upload a workflow JSON.');
      }

      const comfySettings: ComfyUISettings = {
        endpoint: settings.comfyui_endpoint,
        workflow: settings.comfyui_workflow as Record<string, unknown>,
        orientation: orientation || (settings.image_orientation as ImageOrientation) || 'portrait',
        noiseMode: (settings.image_noise_mode as 'random' | 'fixed') || 'random',
        noiseSeed: settings.image_noise_seed ?? undefined,
        batchSize: 1,
      };

      const descForPrompt = imageDescription || entityDescription || '';
      const prompt = customPrompt.trim() || buildEntityPrompt(entityType, entityName, descForPrompt);
      const result = await generateImage(prompt, comfySettings);

      // Persist image to Supabase storage so it's always accessible
      const persistedUrl = await persistComfyImage(result.comfyUrl, settings.comfyui_endpoint);
      onImageChange(persistedUrl, imageDescription || prompt);
      setShowPromptEditor(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function persistComfyImage(comfyUrl: string, endpoint: string): Promise<string> {
    try {
      const viewMatch = comfyUrl.match(/\/view\?.+$/);
      if (!viewMatch) return comfyUrl;

      const path = viewMatch[0];
      const res = await comfyProxyGet(endpoint, path);
      if (!res.ok) return comfyUrl;

      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const storagePath = `${projectId}/${entityType}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('entity-images')
        .upload(storagePath, blob, { upsert: true, contentType: blob.type });

      if (uploadError) return comfyUrl;

      const { data: urlData } = supabase.storage
        .from('entity-images')
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    } catch {
      return comfyUrl;
    }
  }

  function openPromptEditor() {
    const descForPrompt = imageDescription || entityDescription || '';
    const autoPrompt = buildEntityPrompt(entityType, entityName, descForPrompt);
    setCustomPrompt(autoPrompt);
    setShowPromptEditor(true);
  }

  function handleRemove() {
    onImageChange('', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Reference Image
      </label>

      {imageUrl && !comfyEndpoint ? (
        <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
      ) : imageUrl && comfyEndpoint ? (
        <div className="space-y-3">
          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={proxyImageUrl(imageUrl, comfyEndpoint)}
              alt={entityName || 'Entity reference'}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={openPromptEditor}
                className="px-3 py-1.5 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex-1 px-3 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  AI Analyze Image
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowDescription(!showDescription)}
              className="px-3 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
            >
              {showDescription ? 'Hide' : 'Show'} Description
            </button>
          </div>

          {(showDescription || imageDescription) && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Visual Description (used by AI during writing)
              </label>
              <textarea
                value={imageDescription}
                onChange={(e) => onImageChange(imageUrl, e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Describe this image in detail for the AI to reference during writing..."
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
          >
            <svg className="mx-auto w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-slate-600">
              {uploading ? 'Uploading...' : 'Click to upload a reference image'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP up to 5MB</p>
          </div>

          <button
            type="button"
            onClick={openPromptEditor}
            disabled={generating}
            className="w-full px-4 py-3 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Generate Image with AI
          </button>
          <p className="text-xs text-slate-500 text-center">
            Creates a text-to-image from this {entityType.replace(/s$/, '')}'s description via ComfyUI
          </p>
        </div>
      )}

      {showPromptEditor && (
        <div className="border border-sky-200 bg-sky-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-sky-900">Generate Image</h4>
            <button
              type="button"
              onClick={() => setShowPromptEditor(false)}
              className="text-sky-600 hover:text-sky-800 text-sm"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-sky-700">
            Edit the prompt below to control what the text-to-image generator creates. The prompt is auto-built from this {entityType.replace(/s$/, '')}'s description.
          </p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-white"
            placeholder="Describe what you want the image to look like..."
          />
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-sky-800">Orientation:</label>
            <div className="flex gap-2">
              {(['portrait', 'landscape', 'square'] as ImageOrientation[]).map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrientation(o)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    orientation === o
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-sky-700 border-sky-300 hover:border-sky-500'
                  }`}
                >
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !customPrompt.trim()}
            className="w-full px-4 py-2.5 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating (this may take a minute)...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
