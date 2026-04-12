import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import { generateScene } from '../services/aiService';
import { buildDossierPrompt } from '../services/workflowPrompts';

interface DossierData {
  id: string;
  project_id: string;
  content: string;
  genre_tropes: string;
  braindump: string;
  status: string;
}

export default function Dossier() {
  const { currentProjectId } = useStore();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [braindump, setBraindump] = useState('');
  const [genreTropes, setGenreTropes] = useState('');
  const [content, setContent] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentProjectId) {
      loadDossier();
      loadProject();
    }
  }, [currentProjectId]);

  async function loadProject() {
    if (!currentProjectId) return;
    const { data } = await supabase
      .from('projects')
      .select('title, genre')
      .eq('id', currentProjectId)
      .maybeSingle();
    if (data) setProjectTitle(data.title);
  }

  async function loadDossier() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('story_dossiers')
        .select('*')
        .eq('project_id', currentProjectId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setDossier(data);
        setBraindump(data.braindump);
        setGenreTropes(data.genre_tropes);
        setContent(data.content);
      } else {
        setDossier(null);
        setBraindump('');
        setGenreTropes('');
        setContent('');
      }
    } catch (error) {
      console.error('Error loading dossier:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveDossier() {
    if (!currentProjectId) return;
    setSaving(true);
    try {
      const payload = {
        project_id: currentProjectId,
        braindump,
        genre_tropes: genreTropes,
        content,
        status: content ? 'complete' : 'draft',
        updated_at: new Date().toISOString(),
      };

      if (dossier) {
        const { error } = await supabase
          .from('story_dossiers')
          .update(payload)
          .eq('id', dossier.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('story_dossiers')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setDossier(data);
      }
    } catch (error) {
      console.error('Error saving dossier:', error);
    } finally {
      setSaving(false);
    }
  }

  async function generateDossier() {
    if (!currentProjectId || !braindump.trim()) return;

    const settingsRes = await supabase
      .from('generation_settings')
      .select('*')
      .eq('project_id', currentProjectId)
      .maybeSingle();

    if (!settingsRes.data) {
      alert('Please configure AI settings first in the Settings page');
      return;
    }

    setGenerating(true);
    try {
      const prompt = buildDossierPrompt(braindump, genreTropes, projectTitle || 'Untitled');

      const result = await generateScene({
        sceneDescription: prompt,
        context: {},
        settings: {
          ...settingsRes.data,
          style_rules: (settingsRes.data.style_rules as Record<string, boolean>) || undefined,
        },
      });

      setContent(result);

      const payload = {
        project_id: currentProjectId,
        braindump,
        genre_tropes: genreTropes,
        content: result,
        status: 'complete',
        updated_at: new Date().toISOString(),
      };

      if (dossier) {
        await supabase.from('story_dossiers').update(payload).eq('id', dossier.id);
      } else {
        const { data } = await supabase
          .from('story_dossiers')
          .insert([payload])
          .select()
          .single();
        if (data) setDossier(data);
      }
    } catch (error) {
      console.error('Error generating dossier:', error);
      alert('Failed to generate dossier. Check AI settings and ensure your model is running.');
    } finally {
      setGenerating(false);
    }
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Story Dossier</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pre-writing planning -- brainstorm your ideas, define genre tropes, and let AI create a structured dossier.
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Brain Dump / Series Outline</h2>
          <p className="text-sm text-slate-500 mb-3">
            Paste your raw ideas, brainstorming notes, series outline, or any material you have so far.
          </p>
          <textarea
            value={braindump}
            onChange={(e) => setBraindump(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            placeholder="Paste your brainstorming notes, series outline, character ideas, world concepts..."
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Genre Tropes</h2>
          <p className="text-sm text-slate-500 mb-3">
            List the key tropes and conventions of your genre. This helps the AI keep suggestions consistent with reader expectations.
          </p>
          <textarea
            value={genreTropes}
            onChange={(e) => setGenreTropes(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            placeholder="e.g., Chosen one narrative, mentor figure, found family, magic system with costs, coming-of-age arc..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={generateDossier}
            disabled={generating || !braindump.trim()}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors"
          >
            {generating ? 'Generating Dossier...' : 'Generate Story Dossier with AI'}
          </button>
          <button
            onClick={saveDossier}
            disabled={saving}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>

        {content && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Generated Dossier</h2>
              {dossier?.status === 'complete' && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Complete</span>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={25}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={saveDossier}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
