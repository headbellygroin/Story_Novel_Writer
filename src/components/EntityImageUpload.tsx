import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeImageWithVision } from '../services/visionService';

interface EntityImageUploadProps {
  entityType: string;
  entityName: string;
  imageUrl: string;
  imageDescription: string;
  projectId: string;
  onImageChange: (url: string, description: string) => void;
}

export default function EntityImageUpload({
  entityType,
  entityName,
  imageUrl,
  imageDescription,
  projectId,
  onImageChange,
}: EntityImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const settingsRes = await supabase
        .from('generation_settings')
        .select('vision_model_name')
        .eq('project_id', projectId)
        .maybeSingle();

      const description = await analyzeImageWithVision({
        imageBase64: base64,
        entityType,
        entityName,
        model: settingsRes.data?.vision_model_name || 'llava-1.6-mistral-7b',
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

      {imageUrl ? (
        <div className="space-y-3">
          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={imageUrl}
              alt={entityName || 'Entity reference'}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove
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
                  Analyzing with {analyzing ? 'AI' : ''}...
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
