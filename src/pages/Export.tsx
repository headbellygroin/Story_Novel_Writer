import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import {
  ExportFormat,
  ExportOptions,
  buildExportContent,
  fetchImageAsDataUrl,
} from '../services/exportService';

type Chapter = Database['public']['Tables']['chapters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];
type Outline = Database['public']['Tables']['outlines']['Row'];

export default function Export() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState('');
  const [format, setFormat] = useState<ExportFormat>('html');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [embedImages, setEmbedImages] = useState(true);
  const [imageProgress, setImageProgress] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  async function generateExport() {
    if (!currentProjectId || !currentOutlineId) return;

    setExporting(true);
    setImageProgress('');
    try {
      const [projectRes, outlineRes, chaptersRes, scenesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', currentProjectId).maybeSingle(),
        supabase.from('outlines').select('*').eq('id', currentOutlineId).maybeSingle(),
        supabase.from('chapters').select('*').eq('outline_id', currentOutlineId).order('order_index'),
        supabase.from('scenes').select('*').eq('project_id', currentProjectId).order('order_index'),
      ]);

      const project = projectRes.data;
      const outline = outlineRes.data as Outline | null;
      const chapters = (chaptersRes.data || []) as Chapter[];
      const scenes = (scenesRes.data || []) as Scene[];

      let imageDataUrls: Map<string, string> | undefined;

      if (includeImages && embedImages) {
        const scenesWithImages = scenes.filter(s => s.generated_image_url);
        if (scenesWithImages.length > 0) {
          imageDataUrls = new Map();
          for (let i = 0; i < scenesWithImages.length; i++) {
            const scene = scenesWithImages[i];
            setImageProgress(`Embedding image ${i + 1} of ${scenesWithImages.length}...`);
            const dataUrl = await fetchImageAsDataUrl(scene.generated_image_url);
            if (dataUrl) {
              imageDataUrls.set(scene.id, dataUrl);
            }
          }
          setImageProgress('');
        }
      }

      const options: ExportOptions = { format, includeNotes, includeImages };
      const content = buildExportContent(
        { project, outline, chapters, scenes },
        options,
        imageDataUrls,
      );
      setPreview(content);
    } catch (error) {
      console.error('Error generating export:', error);
    } finally {
      setExporting(false);
    }
  }

  function downloadFile() {
    if (!preview) return;

    const extMap: Record<ExportFormat, string> = { html: 'html', markdown: 'md', plaintext: 'txt' };
    const mimeMap: Record<ExportFormat, string> = { html: 'text/html', markdown: 'text/markdown', plaintext: 'text/plain' };
    const ext = extMap[format];
    const mimeType = mimeMap[format];
    const blob = new Blob([preview], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novel-export.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(preview);
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (!currentOutlineId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select an outline first.</div>
      </div>
    );
  }

  const isHtml = format === 'html';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Export Novel</h1>
          <p className="text-sm text-slate-500 mt-1">Download your story with images in place</p>
        </div>
        <ProjectSelector />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Export Options</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
            <div className="flex gap-4">
              {([
                { value: 'html' as const, label: 'HTML (with images)', desc: 'Best for viewing and YouTube prep' },
                { value: 'markdown' as const, label: 'Markdown (.md)', desc: 'With image references' },
                { value: 'plaintext' as const, label: 'Plain Text (.txt)', desc: 'Text only' },
              ]).map(opt => (
                <label
                  key={opt.value}
                  className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    format === opt.value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      checked={format === opt.value}
                      onChange={() => setFormat(opt.value)}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(e) => setIncludeImages(e.target.checked)}
                disabled={format === 'plaintext'}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
              />
              <span className={`text-sm ${format === 'plaintext' ? 'text-slate-400' : 'text-slate-700'}`}>
                Include scene images
              </span>
            </label>

            {includeImages && format !== 'plaintext' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedImages}
                  onChange={(e) => setEmbedImages(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700">
                  Embed images in file
                </span>
                <span className="text-xs text-slate-400">(self-contained, larger file)</span>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700">Scene descriptions and notes</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={generateExport}
            disabled={exporting}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
          >
            {exporting ? 'Generating...' : 'Generate Preview'}
          </button>
          {preview && (
            <>
              <button
                onClick={downloadFile}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Download File
              </button>
              <button
                onClick={copyToClipboard}
                className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
              >
                Copy to Clipboard
              </button>
            </>
          )}
          {imageProgress && (
            <span className="text-sm text-teal-600 animate-pulse">{imageProgress}</span>
          )}
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="border-b border-slate-200 px-6 py-3 flex justify-between items-center">
            <h2 className="text-sm font-medium text-slate-700">Preview</h2>
            {isHtml && (
              <span className="text-xs text-slate-400">
                Rendered HTML preview -- download for full quality
              </span>
            )}
          </div>
          <div ref={previewRef} className="max-h-[700px] overflow-y-auto">
            {isHtml ? (
              <iframe
                srcDoc={preview}
                className="w-full border-0"
                style={{ height: '700px' }}
                title="Export Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="p-6">
                <pre className="whitespace-pre-wrap text-sm text-slate-800 font-serif leading-relaxed">
                  {preview}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
