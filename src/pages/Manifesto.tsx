import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';

export default function Manifesto() {
  const { currentProjectId } = useStore();
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProjectId) loadManifesto();
  }, [currentProjectId]);

  async function loadManifesto() {
    setLoading(true);
    const { data } = await supabase
      .from('franchise_manifesto')
      .select('content')
      .eq('project_id', currentProjectId!)
      .maybeSingle();

    setContent(data?.content || '');
    setSaved(true);
    setLoading(false);
  }

  async function saveManifesto() {
    if (!currentProjectId) return;

    const { error } = await supabase
      .from('franchise_manifesto')
      .upsert({
        project_id: currentProjectId,
        content,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id' });

    if (error) {
      console.error('Error saving manifesto:', error);
      return;
    }
    setSaved(true);
  }

  if (!currentProjectId) {
    return (
      <div className="p-6">
        <ProjectSelector />
        <p className="mt-4 text-slate-500">Select a project to manage its Franchise Manifesto.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Franchise Manifesto</h1>
            <p className="text-sm text-slate-500 mt-1">
              Immutable truths about your series. This is the highest-priority guidance in generation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!saved && (
              <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
            )}
            <button
              onClick={saveManifesto}
              disabled={saved}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                saved
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              Save Manifesto
            </button>
          </div>
        </div>

        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Guidance Hierarchy</h3>
          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-medium">Franchise Manifesto</span>
            <span className="text-slate-400">&rarr;</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">System Prompt</span>
            <span className="text-slate-400">&rarr;</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Style Guide</span>
            <span className="text-slate-400">&rarr;</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Story Bible</span>
            <span className="text-slate-400">&rarr;</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Characters</span>
            <span className="text-slate-400">&rarr;</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Outline</span>
            <span className="text-slate-400">&rarr;</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">Scene</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>
        ) : (
          <div className="h-full flex flex-col gap-4">
            <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Write franchise-level rules here. These appear at the top of every generation prompt
              and override all other guidance. Use for truths that must never drift: tone, core themes,
              non-negotiable rules, philosophical anchors.
            </div>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setSaved(false); }}
              placeholder={`Example:\n\nThis is a story about people, not systems.\nHome is something people build together.\nEvery character earns their place through presence, not usefulness.\nThe ship is not a vehicle. The ship is a family member.\nHumor lives in the gap between dignity and absurdity.\nNo character is purely evil. No system is purely good.\nThe reader should always feel comfortable in the crew's company.`}
              className="flex-1 w-full p-4 border border-slate-200 rounded-lg resize-none font-mono text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}
