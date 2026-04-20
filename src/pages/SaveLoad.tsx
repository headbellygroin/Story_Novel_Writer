import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import {
  exportProject,
  downloadBackup,
  parseBackupFile,
  importProject,
  ProjectBackup,
  ImportProgress,
} from '../services/backupService';

export default function SaveLoad() {
  const { currentProjectId, setCurrentProjectId } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const [previewData, setPreviewData] = useState<ProjectBackup | null>(null);
  const [previewError, setPreviewError] = useState('');

  async function handleExport() {
    if (!currentProjectId) return;
    setExporting(true);
    setExportDone(false);
    try {
      const backup = await exportProject(currentProjectId);
      downloadBackup(backup);
      setExportDone(true);
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewData(null);
    setPreviewError('');
    setImportResult(null);

    try {
      const data = await parseBackupFile(file);
      setPreviewData(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not read file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleImport() {
    if (!previewData) return;

    setImporting(true);
    setImportResult(null);
    setImportProgress(null);

    try {
      const newProjectId = await importProject(previewData, setImportProgress);
      setCurrentProjectId(newProjectId);
      setImportResult({
        success: true,
        message: `"${previewData.project.title}" has been loaded as a new project. It is now your active project.`,
      });
      setPreviewData(null);
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  function getTableLabel(table: string): string {
    const labels: Record<string, string> = {
      outlines: 'Outlines',
      chapters: 'Chapters',
      scenes: 'Scenes',
      characters: 'Characters',
      places: 'Places',
      things: 'Things',
      technologies: 'Technologies',
      story_events: 'Story Events',
      character_states: 'Character States',
      scene_references: 'Scene References',
      scene_summaries: 'Scene Summaries',
      story_bible_entries: 'Story Bible Entries',
      style_anchors: 'Style Anchors',
      scene_context_tags: 'Context Tags',
      story_dossiers: 'Story Dossiers',
      scene_briefs: 'Scene Briefs',
      editing_passes: 'Editing Passes',
      logic_checks: 'Logic Checks',
      prohibited_words: 'Prohibited Words',
      generation_settings: 'AI Settings',
    };
    return labels[table] || table;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Save / Load</h1>
          <p className="text-sm text-slate-500 mt-1">
            Export your project as a JSON file or load one from disk
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Save Project</h2>
          <p className="text-sm text-slate-500 mb-4">
            Downloads a JSON file containing all text data for the current project.
            Images, audio, and generated media are not included -- save those separately.
          </p>

          {!currentProjectId ? (
            <p className="text-sm text-amber-600">Select a project first to save it.</p>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
              >
                {exporting ? 'Exporting...' : 'Download Backup'}
              </button>
              {exportDone && (
                <span className="text-sm text-green-600 font-medium">
                  Backup downloaded.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Load Project</h2>
          <p className="text-sm text-slate-500 mb-4">
            Import a previously saved JSON backup. This creates a new project -- it will not
            overwrite any existing data.
          </p>

          <div className="flex items-center gap-4 mb-4">
            <label className="px-5 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium cursor-pointer">
              Choose File
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {previewError && (
              <span className="text-sm text-red-600">{previewError}</span>
            )}
          </div>

          {previewData && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">{previewData.project.title}</h3>
                <div className="flex gap-4 mt-1">
                  {previewData.project.genre && (
                    <span className="text-xs text-slate-500">
                      Genre: {previewData.project.genre}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    Saved: {new Date(previewData.exported_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                  Contents
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(previewData.tables)
                    .filter(([, rows]) => rows.length > 0)
                    .map(([table, rows]) => (
                      <div
                        key={table}
                        className="flex justify-between items-center text-sm px-3 py-1.5 bg-slate-50 rounded"
                      >
                        <span className="text-slate-700">{getTableLabel(table)}</span>
                        <span className="text-slate-400 font-mono text-xs">{rows.length}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-4">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {importing ? 'Importing...' : 'Load This Project'}
                </button>
                <button
                  onClick={() => setPreviewData(null)}
                  disabled={importing}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-800 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {importing && importProgress && (
            <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-sm text-teal-800">
                Importing {getTableLabel(importProgress.table)}...{' '}
                <span className="font-mono">
                  {importProgress.done}/{importProgress.total}
                </span>
              </p>
            </div>
          )}

          {importResult && (
            <div
              className={`mt-4 p-3 rounded-lg border ${
                importResult.success
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <p className="text-sm">{importResult.message}</p>
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 text-sm mb-1">What gets saved</h3>
          <ul className="text-sm text-amber-800 space-y-0.5">
            <li>All text content: scenes, chapters, outlines, characters, places, items, tech/magic</li>
            <li>Story bible, style anchors, prohibited words, dossier, scene briefs</li>
            <li>Consistency data: events, character states, references, summaries</li>
            <li>AI generation settings (model, parameters, style rules)</li>
          </ul>
          <h3 className="font-semibold text-amber-900 text-sm mt-3 mb-1">What is NOT saved</h3>
          <ul className="text-sm text-amber-800 space-y-0.5">
            <li>Generated images and image prompts</li>
            <li>Audio files</li>
            <li>Vision/ComfyUI endpoint configurations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
