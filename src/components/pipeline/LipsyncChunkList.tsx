import { Database } from '../../lib/database.types';

type LipsyncChunk = Database['public']['Tables']['pipeline_lipsync_chunks']['Row'];

interface Props {
  chunks: LipsyncChunk[];
}

export default function LipsyncChunkList({ chunks }: Props) {
  if (chunks.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm">
        No lip-sync chunks generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            chunk.status === 'completed'
              ? 'border-emerald-200 bg-emerald-50'
              : chunk.status === 'generating'
              ? 'border-sky-200 bg-sky-50'
              : chunk.status === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono text-slate-500 flex-shrink-0">
              {String(chunk.chunk_index + 1).padStart(3, '0')}
            </span>
            <span className="text-sm text-slate-700 font-mono truncate">
              {chunk.filename}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
              chunk.status === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : chunk.status === 'generating'
                ? 'bg-sky-100 text-sky-700'
                : chunk.status === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {chunk.status}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {chunk.video_url && (
              <a
                href={chunk.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-600 hover:text-sky-700"
              >
                View
              </a>
            )}
          </div>
        </div>
      ))}

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs text-slate-600">
          <span className="font-medium">{chunks.filter((c) => c.status === 'completed').length}</span> of{' '}
          <span className="font-medium">{chunks.length}</span> chunks completed.
          Assemble these files in filename order using your external stitching tool.
        </p>
      </div>
    </div>
  );
}
