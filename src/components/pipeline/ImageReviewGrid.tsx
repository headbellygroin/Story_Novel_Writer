import { Database } from '../../lib/database.types';

type PipelineImage = Database['public']['Tables']['pipeline_images']['Row'];

interface Props {
  images: PipelineImage[];
  showAnimated: boolean;
}

export default function ImageReviewGrid({ images, showAnimated }: Props) {
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

        return (
          <div
            key={img.id}
            className={`bg-white rounded-lg border overflow-hidden ${
              img.status === 'error'
                ? 'border-red-200'
                : img.status === 'generating' || img.status === 'animating'
                ? 'border-sky-300'
                : 'border-slate-200'
            }`}
          >
            <div className="aspect-video bg-slate-100 relative">
              {mediaUrl ? (
                isAnimated ? (
                  <video
                    src={mediaUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt={`Scene ${img.order_index + 1}`}
                    className="w-full h-full object-cover"
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
              <p className="text-xs text-slate-400 line-clamp-1" title={img.image_prompt}>
                {img.image_prompt}
              </p>
              {img.animation_prompt && (
                <p className="text-xs text-teal-600 mt-1 line-clamp-1" title={img.animation_prompt}>
                  Motion: {img.animation_prompt}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
