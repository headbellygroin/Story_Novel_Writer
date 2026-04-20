import { PipelineStage } from '../../services/pipelineService';

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'idle', label: 'Ready' },
  { key: 'analyzing', label: 'Analyze' },
  { key: 'generating_images', label: 'Images' },
  { key: 'images_review', label: 'Review' },
  { key: 'animating', label: 'Animate' },
  { key: 'animation_review', label: 'Review' },
  { key: 'generating_tts', label: 'TTS' },
  { key: 'tts_review', label: 'Review' },
  { key: 'assembling_video', label: 'Assemble' },
  { key: 'video_review', label: 'Review' },
  { key: 'generating_lipsync', label: 'Lip-sync' },
  { key: 'lipsync_complete', label: 'Done' },
];

function getStageIndex(stage: PipelineStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

interface Props {
  currentStage: PipelineStage;
  status: string;
}

export default function StageIndicator({ currentStage, status }: Props) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max gap-1">
        {STAGES.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isPaused = isCurrent && status === 'paused';
          const isRunning = isCurrent && status === 'running';
          const isError = isCurrent && status === 'error';

          return (
            <div key={stage.key} className="flex items-center">
              {i > 0 && (
                <div
                  className={`w-4 h-0.5 ${
                    isComplete ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isComplete
                    ? 'bg-emerald-100 text-emerald-700'
                    : isError
                    ? 'bg-red-100 text-red-700 ring-2 ring-red-300'
                    : isPaused
                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                    : isRunning
                    ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-300 animate-pulse'
                    : isCurrent
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
