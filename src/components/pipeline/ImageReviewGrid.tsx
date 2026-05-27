import { useState } from 'react';
import { Database } from '../../lib/database.types';
import ImageLightbox from '../ImageLightbox';

type PipelineImage = Database['public']['Tables']['pipeline_images']['Row'];

interface Props {
  images: PipelineImage[];
  showAnimated: boolean;
  onRegenerateImage?: (imageId: string, newPrompt: string) => Promise<void>;
  disabled?: boolean;
}

export default function ImageReviewGrid({ images, showAnimated, onRegenerateImage, disabled }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function handleStartEdit(img: PipelineImage) {
    setEditingId(img.id);
    setEditPrompt(img.image_prompt);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditPrompt('');
  }

  async function handleRegenerate(img: PipelineImage) {
    if (!onRegenerateImage || !editPrompt.trim()) return;
    setRegeneratingId(img.id);
    try {
      await onRegenerateImage(img.id, editPrompt.trim());
      setEditingId(null);
      setEditPrompt('');
    } catch (err) {
      console.error('Failed to regenerate image:', err);
      alert(`Failed to regenerate image #${img.order_index + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRegeneratingId(null);
    }
  }

  if (images.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm">
        No images generated yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map((img) => {
        const mediaUrl = showAnimated && img.animated_url ? img.animated_url : img.image_url;
        const isAnimated = showAnimated && !!img.animated_url;
        const isEditing = editingId === img.id;
        const isRegenerating = regeneratingId === img.id;

        return (
          <div
            key={img.id}
            className={`bg-white rounded-lg border overflow-hidden ${
              isRegenerating
                ? 'border-orange-300 ring-1 ring-orange-200'
                : isEditing
                ? 'border-sky-300 ring-1 ring-sky-200'
                : img.status === 'error'
                ? 'border-red-200'
                : img.status === 'generating' || img.status === 'animating'
                ? 'border-sky-300'
                : 'border-slate-200'
            }`}
          >
            <div className="aspect-video bg-slate-900 relative group">
              {isRegenerating ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2 text-orange-600">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs">Regenerating...</span>
                  </div>
                </div>
              ) : mediaUrl ? (
                isAnimated ? (
                  <video
                    src={mediaUrl}
                    className="w-full h-full object-cover cursor-zoom-in"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onClick={() => setLightboxSrc(mediaUrl)}
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt={`Scene ${img.order_index + 1}`}
                    className="w-full h-full object-cover cursor-zoom-in transition-transform group-hover:scale-[1.02]"
                    onClick={() => setLightboxSrc(mediaUrl)}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  {img.status === 'generating' || img.status === 'animating' ? (
                    <div className="flex items-center gap-2 text-sky-600">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-xs">{img.status === 'animating' ? 'Animating...' : 'Generating...'}</span>
                    </div>
                  ) : img.status === 'error' ? (
                    <span className="text-xs text-red-500">Error</span>
                  ) : (
                    <span className="text-xs text-slate-400">Pending</span>
                  )}
                </div>
              )}
              <div className="absolute top-2 left-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  img.status === 'animated'
                    ? 'bg-emerald-100 text-emerald-700'
                    : img.status === 'generated'
                    ? 'bg-sky-100 text-sky-700'
                    : img.status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  #{img.order_index + 1}
                </span>
              </div>
            </div>

            <div className="p-3">
              <p className="text-xs text-slate-600 line-clamp-2 mb-1" title={img.text_anchor}>
                {img.text_anchor}
              </p>

              {/* Prompt - editable or static */}
              {isEditing ? (
                <div className="mt-2">
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-2 py-1.5 border border-sky-300 rounded text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-y"
                    disabled={isRegenerating}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleRegenerate(img)}
                      disabled={isRegenerating || !editPrompt.trim() || disabled}
                      className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {isRegenerating ? (
                        <>
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                          </svg>
                          <span>Regenerating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          <span>Regenerate</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(img)}
                    disabled={disabled || isRegenerating || !onRegenerateImage}
                    className="text-left w-full text-xs text-slate-400 line-clamp-2 hover:text-slate-600 hover:bg-slate-50 rounded px-1 -mx-1 py-0.5 transition-colors disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-default"
                    title={onRegenerateImage ? 'Click to edit prompt and regenerate' : img.image_prompt}
                  >
                    {img.image_prompt}
                  </button>
                  {onRegenerateImage && !disabled && (
                    <span className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                      </svg>
                    </span>
                  )}
                </div>
              )}

              {img.animation_prompt && !isEditing && (
                <p className="text-xs text-teal-600 mt-1 line-clamp-1" title={img.animation_prompt}>
                  Motion: {img.animation_prompt}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
