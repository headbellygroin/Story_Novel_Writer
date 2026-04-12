import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { generateScene } from '../../services/aiService';
import { buildImprovementPlanPrompt, buildImplementEditPrompt } from '../../services/workflowPrompts';
import { getActiveRulePrompts } from '../../lib/styleRules';

interface EditingPassPanelProps {
  sceneId: string;
  projectId: string;
  sceneContent: string;
  chapterTitle: string;
  onContentUpdate: (content: string) => void;
}

interface EditingPass {
  id: string;
  pass_type: string;
  content: string;
  original_content: string;
  status: string;
  created_at: string;
}

export default function EditingPassPanel({
  sceneId,
  projectId,
  sceneContent,
  chapterTitle,
  onContentUpdate,
}: EditingPassPanelProps) {
  const [passes, setPasses] = useState<EditingPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewingPass, setViewingPass] = useState<string | null>(null);

  useEffect(() => {
    loadPasses();
  }, [sceneId]);

  async function loadPasses() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('editing_passes')
        .select('*')
        .eq('scene_id', sceneId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      setPasses(data || []);
    } catch (error) {
      console.error('Error loading editing passes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateImprovementPlan() {
    if (!sceneContent?.trim()) {
      alert('No scene content to edit. Generate or write content first.');
      return;
    }

    setGenerating('improvement');
    try {
      const [settingsRes, briefRes, wordsRes, chaptersRes] = await Promise.all([
        supabase.from('generation_settings').select('*').eq('project_id', projectId).maybeSingle(),
        supabase.from('scene_briefs').select('*').eq('project_id', projectId).limit(1),
        supabase.from('prohibited_words').select('word').eq('project_id', projectId),
        supabase.from('scenes').select('content, chapter_id, order_index').eq('id', sceneId).maybeSingle(),
      ]);

      if (!settingsRes.data) {
        alert('Please configure AI settings first.');
        return;
      }

      const sceneBrief = briefRes.data?.[0]
        ? Object.entries(briefRes.data[0])
            .filter(([k]) => !['id', 'chapter_id', 'project_id', 'created_at', 'updated_at'].includes(k))
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n')
        : '';

      const prohibitedWords = (wordsRes.data || []).map((w: { word: string }) => w.word);

      const styleRules = settingsRes.data.style_rules as Record<string, boolean> | null;
      const activeRules = styleRules ? getActiveRulePrompts(styleRules) : [];
      const styleSheet = [
        settingsRes.data.style_guide || '',
        ...activeRules,
      ].filter(Boolean).join('\n\n');

      let previousChapterText = '';
      if (chaptersRes.data) {
        const { data: prevScenes } = await supabase
          .from('scenes')
          .select('content')
          .eq('chapter_id', chaptersRes.data.chapter_id)
          .lt('order_index', chaptersRes.data.order_index)
          .order('order_index', { ascending: false })
          .limit(1);

        if (prevScenes?.[0]?.content) {
          previousChapterText = prevScenes[0].content;
        }
      }

      const prompt = buildImprovementPlanPrompt(
        sceneContent,
        sceneBrief,
        previousChapterText,
        styleSheet,
        prohibitedWords,
      );

      const result = await generateScene({
        sceneDescription: prompt,
        context: {},
        settings: {
          ...settingsRes.data,
          style_rules: styleRules || undefined,
        },
      });

      const { data } = await supabase
        .from('editing_passes')
        .insert([{
          scene_id: sceneId,
          project_id: projectId,
          pass_type: 'improvement_plan',
          content: result,
          original_content: sceneContent,
          status: 'complete',
        }])
        .select()
        .single();

      if (data) setPasses([data, ...passes]);
    } catch (error) {
      console.error('Error generating improvement plan:', error);
      alert('Failed to generate improvement plan. Check AI settings.');
    } finally {
      setGenerating(null);
    }
  }

  async function implementEdits() {
    const latestPlan = passes.find(p => p.pass_type === 'improvement_plan');
    if (!latestPlan) {
      alert('Generate an improvement plan first.');
      return;
    }

    setGenerating('implement');
    try {
      const settingsRes = await supabase
        .from('generation_settings')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (!settingsRes.data) {
        alert('Please configure AI settings first.');
        return;
      }

      const prompt = buildImplementEditPrompt(
        latestPlan.original_content,
        latestPlan.content,
        chapterTitle,
      );

      const result = await generateScene({
        sceneDescription: prompt,
        context: {},
        settings: {
          ...settingsRes.data,
          style_rules: (settingsRes.data.style_rules as Record<string, boolean>) || undefined,
        },
      });

      const { data } = await supabase
        .from('editing_passes')
        .insert([{
          scene_id: sceneId,
          project_id: projectId,
          pass_type: 'implemented_edit',
          content: result,
          original_content: latestPlan.original_content,
          status: 'complete',
        }])
        .select()
        .single();

      if (data) setPasses([data, ...passes]);
    } catch (error) {
      console.error('Error implementing edits:', error);
      alert('Failed to implement edits. Check AI settings.');
    } finally {
      setGenerating(null);
    }
  }

  function applyEditToScene(passContent: string) {
    if (!confirm('Replace current scene content with this edited version?')) return;
    onContentUpdate(passContent);
  }

  if (loading) return <div className="p-3 text-xs text-slate-400">Loading...</div>;

  const latestPlan = passes.find(p => p.pass_type === 'improvement_plan');

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <svg
            className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Two-Pass Editing
          {passes.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              {passes.length}
            </span>
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 mt-3">
          <div className="flex flex-col gap-2">
            <button
              onClick={generateImprovementPlan}
              disabled={!!generating || !sceneContent?.trim()}
              className="w-full px-3 py-2 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium"
            >
              {generating === 'improvement' ? 'Analyzing...' : 'Step 1: Generate Improvement Plan'}
            </button>
            <button
              onClick={implementEdits}
              disabled={!!generating || !latestPlan}
              className="w-full px-3 py-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
            >
              {generating === 'implement' ? 'Implementing...' : 'Step 2: Implement Edits'}
            </button>
          </div>

          {!sceneContent?.trim() && (
            <p className="text-xs text-slate-400">
              Write or generate scene content first, then use two-pass editing to refine it.
            </p>
          )}

          {passes.length > 0 && (
            <div className="space-y-2">
              {passes.map(pass => (
                <div key={pass.id} className="border border-slate-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewingPass(viewingPass === pass.id ? null : pass.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        pass.pass_type === 'improvement_plan' ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                      <span className="text-xs font-medium text-slate-600">
                        {pass.pass_type === 'improvement_plan' ? 'Improvement Plan' : 'Implemented Edit'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(pass.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  {viewingPass === pass.id && (
                    <div className="p-2">
                      <div className="text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto mb-2 bg-slate-50 p-2 rounded">
                        {pass.content.slice(0, 2000)}{pass.content.length > 2000 ? '...' : ''}
                      </div>
                      {pass.pass_type === 'implemented_edit' && (
                        <button
                          onClick={() => applyEditToScene(pass.content)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Apply to Scene
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
