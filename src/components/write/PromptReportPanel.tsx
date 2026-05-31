import { PromptAssemblyReport, ContextMode } from '../../services/aiService';

interface Props {
  report: PromptAssemblyReport | null;
  contextMode: ContextMode;
  onContextModeChange: (mode: ContextMode) => void;
  onRefresh: () => void;
}

export default function PromptReportPanel({ report, contextMode, onContextModeChange, onRefresh }: Props) {
  const modeDescriptions: Record<ContextMode, string> = {
    minimal: 'Only critical facts, tagged entities, no dossiers or sliders',
    relevant: 'Critical + high importance facts, trimmed dossiers, tagged entities',
    full: 'All data included (original behavior)',
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Prompt Assembly</span>
        <button
          onClick={onRefresh}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">Context Mode</label>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-md p-0.5">
          {(['minimal', 'relevant', 'full'] as ContextMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => onContextModeChange(mode)}
              className={`px-2 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                contextMode === mode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1">{modeDescriptions[contextMode]}</p>
      </div>

      {!report && (
        <p className="text-xs text-slate-400 italic">
          Click Refresh to see prompt token breakdown for the current scene.
        </p>
      )}

      {report && (
        <div className="space-y-2">
          <div className="bg-slate-50 rounded-md p-2 border border-slate-200">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">Frame (System + Style)</span>
              <span className="font-mono text-slate-700">{report.frameTokens.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-400 rounded-full"
                style={{ width: `${Math.min(100, (report.frameTokens / (report.maxBudget + report.frameTokens)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            {report.sections.map((section) => {
              const totalBudget = report.maxBudget + report.frameTokens;
              const pct = (section.tokens / totalBudget) * 100;
              const barColor = !section.included
                ? 'bg-red-300'
                : section.truncated
                  ? 'bg-amber-400'
                  : 'bg-teal-500';

              return (
                <div
                  key={section.key}
                  className={`rounded-md p-2 border ${
                    !section.included
                      ? 'bg-red-50/50 border-red-200'
                      : section.truncated
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex justify-between text-xs">
                    <span className={`font-medium ${!section.included ? 'text-red-600' : 'text-slate-700'}`}>
                      {section.label}
                      {!section.included && <span className="ml-1 text-red-400">(dropped)</span>}
                      {section.truncated && <span className="ml-1 text-amber-500">(truncated)</span>}
                    </span>
                    <span className="font-mono text-slate-600">{section.tokens.toLocaleString()}</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(100, pct * 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-800">Total Prompt Tokens</span>
              <span className="font-mono text-slate-900">{report.totalPromptTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Context Budget Used</span>
              <span className="font-mono text-slate-600">
                {(report.totalPromptTokens - report.frameTokens).toLocaleString()} / {report.maxBudget.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all ${
                  (report.totalPromptTokens - report.frameTokens) / report.maxBudget > 0.9
                    ? 'bg-amber-500'
                    : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(100, ((report.totalPromptTokens - report.frameTokens) / report.maxBudget) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
