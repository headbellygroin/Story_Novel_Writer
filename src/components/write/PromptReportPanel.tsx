import { PromptAssemblyReport, ContextMode, WorldRichness } from '../../services/aiService';

interface Props {
  report: PromptAssemblyReport | null;
  contextMode: ContextMode;
  worldRichness: WorldRichness;
  onContextModeChange: (mode: ContextMode) => void;
  onWorldRichnessChange: (richness: WorldRichness) => void;
  onRefresh: () => void;
}

export default function PromptReportPanel({ report, contextMode, worldRichness, onContextModeChange, onWorldRichnessChange, onRefresh }: Props) {
  const modeDescriptions: Record<ContextMode, string> = {
    minimal: 'Only critical facts, tagged entities, no dossiers or sliders',
    relevant: 'Critical + high importance facts, compressed summaries',
    full: 'All data included (original behavior)',
  };

  const richnessDescriptions: Record<WorldRichness, string> = {
    minimal: 'Reduced locations/objects for tight context windows',
    balanced: 'Default balance of world detail vs token budget',
    rich: 'Extra location and environmental context for atmosphere',
    full: 'Maximum world detail (use with large context windows)',
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

      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">World Richness</label>
        <div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-md p-0.5">
          {(['minimal', 'balanced', 'rich', 'full'] as WorldRichness[]).map(level => (
            <button
              key={level}
              onClick={() => onWorldRichnessChange(level)}
              className={`px-2 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                worldRichness === level
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1">{richnessDescriptions[worldRichness]}</p>
      </div>

      {!report && (
        <p className="text-xs text-slate-400 italic">
          Click Refresh to see prompt token breakdown for the current scene.
        </p>
      )}

      {report && (
        <div className="space-y-2">
          {report.generationMode && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1 border border-slate-200">
              Mode: <span className="font-medium text-slate-700">{report.generationMode.replace('_', ' ')}</span>
            </div>
          )}

          {report.contextMetrics && (
            <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-md p-2 border border-slate-200">
              <div className="text-xs">
                <span className="text-slate-500">Characters:</span>
                <span className="ml-1 font-medium text-slate-700">{report.contextMetrics.charactersUsed}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-500">Locations:</span>
                <span className="ml-1 font-medium text-slate-700">{report.contextMetrics.locationsUsed}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-500">Bible Facts:</span>
                <span className="ml-1 font-medium text-slate-700">{report.contextMetrics.bibleFactsUsed}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-500">Compression:</span>
                <span className="ml-1 font-medium text-slate-700">{Math.round(report.contextMetrics.compressionRatio * 100)}%</span>
              </div>
            </div>
          )}

          {/* Character Visibility Audit */}
          {report.visibilityAudit && (report.visibilityAudit.visible.length > 0 || report.visibilityAudit.hidden.length > 0) && (
            <div className="bg-slate-50 rounded-md p-2 border border-slate-200">
              <div className="text-xs font-medium text-slate-700 mb-1.5">Character Visibility</div>
              {report.visibilityAudit.visible.length > 0 && (
                <div className="mb-1">
                  <span className="text-xs text-teal-600 font-medium">Included: </span>
                  <span className="text-xs text-slate-600">{report.visibilityAudit.visible.join(', ')}</span>
                </div>
              )}
              {report.visibilityAudit.hidden.length > 0 && (
                <div>
                  <span className="text-xs text-red-500 font-medium">Hidden: </span>
                  <span className="text-xs text-slate-400">{report.visibilityAudit.hidden.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Frame Breakdown - Hidden Context */}
          {report.frameBreakdown && (
            <div className="bg-amber-50/50 rounded-md p-2 border border-amber-200">
              <div className="text-xs font-medium text-amber-800 mb-1.5">Frame (Hidden Context)</div>
              <div className="space-y-0.5">
                {[
                  { label: 'System Prompt', tokens: report.frameBreakdown.systemPrompt },
                  { label: 'Style Guide', tokens: report.frameBreakdown.styleGuide },
                  { label: 'Style Rules', tokens: report.frameBreakdown.styleRules },
                  { label: 'Prohibited Words', tokens: report.frameBreakdown.prohibitedWords },
                  { label: 'Scene Brief', tokens: report.frameBreakdown.sceneDescription },
                  { label: 'Mode Instructions', tokens: report.frameBreakdown.modeInstructions },
                ].filter(item => item.tokens > 0).map(item => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-amber-700">{item.label}</span>
                    <span className="font-mono text-amber-800">{item.tokens.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-medium pt-1 border-t border-amber-200 mt-1">
                  <span className="text-amber-800">Frame Total</span>
                  <span className="font-mono text-amber-900">{report.frameTokens.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Visible Context Sections */}
          <div className="text-xs font-medium text-slate-600 mt-2">Visible Context</div>
          <div className="space-y-1">
            {report.sections.map((section) => {
              const totalBudget = report.maxBudget + report.frameTokens;
              const pct = (section.tokens / totalBudget) * 100;
              const budgetPct = section.budget ? (section.tokens / section.budget) * 100 : 0;
              const overBudget = section.budget && section.tokens >= section.budget;
              const barColor = !section.included
                ? 'bg-red-300'
                : overBudget
                  ? 'bg-amber-500'
                  : section.truncated
                    ? 'bg-amber-400'
                    : 'bg-teal-500';

              return (
                <div
                  key={section.key}
                  className={`rounded-md p-2 border ${
                    !section.included
                      ? 'bg-red-50/50 border-red-200'
                      : overBudget
                        ? 'bg-amber-50/50 border-amber-200'
                        : section.truncated
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex justify-between text-xs">
                    <span className={`font-medium ${!section.included ? 'text-red-600' : 'text-slate-700'}`}>
                      {section.label}
                      {!section.included && <span className="ml-1 text-red-400">(dropped)</span>}
                      {section.included && overBudget && <span className="ml-1 text-amber-500">(capped)</span>}
                      {section.included && section.truncated && !overBudget && <span className="ml-1 text-amber-500">(truncated)</span>}
                    </span>
                    <span className="font-mono text-slate-600">
                      {section.tokens.toLocaleString()}
                      {section.budget > 0 && (
                        <span className="text-slate-400"> / {section.budget.toLocaleString()}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(100, budgetPct || pct * 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final Total */}
          <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Visible Context</span>
              <span className="font-mono text-slate-600">
                {(report.totalPromptTokens - report.frameTokens).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Hidden Frame</span>
              <span className="font-mono text-slate-600">{report.frameTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold pt-1.5 border-t border-slate-300">
              <span className="text-slate-900">Final Prompt Sent</span>
              <span className="font-mono text-slate-900">{report.totalPromptTokens.toLocaleString()} tokens</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all ${
                  report.totalPromptTokens / (report.maxBudget + report.frameTokens) > 0.9
                    ? 'bg-red-500'
                    : report.totalPromptTokens / (report.maxBudget + report.frameTokens) > 0.7
                      ? 'bg-amber-500'
                      : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(100, (report.totalPromptTokens / (report.maxBudget + report.frameTokens)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Context Budget</span>
              <span className="font-mono">{(report.maxBudget + report.frameTokens).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
