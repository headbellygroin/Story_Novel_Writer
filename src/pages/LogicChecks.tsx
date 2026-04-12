import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import { generateScene } from '../services/aiService';
import { buildLogicCheckPrompt } from '../services/workflowPrompts';

interface LogicCheck {
  id: string;
  check_type: string;
  target_id: string | null;
  target_name: string;
  result: string;
  status: string;
  created_at: string;
}

interface CheckTarget {
  id: string;
  name: string;
  content: string;
}

const CHECK_TYPES = [
  { key: 'dossier', label: 'Story Dossier' },
  { key: 'outline', label: 'Outline / Synopsis' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'character', label: 'Character' },
  { key: 'worldbuilding', label: 'Worldbuilding' },
];

export default function LogicChecks() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [checks, setChecks] = useState<LogicCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState('dossier');
  const [targets, setTargets] = useState<CheckTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [viewingCheck, setViewingCheck] = useState<string | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      loadChecks();
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      loadTargets();
    }
  }, [currentProjectId, selectedType, currentOutlineId]);

  async function loadChecks() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('logic_checks')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('created_at', { ascending: false });

      setChecks(data || []);
    } catch (error) {
      console.error('Error loading logic checks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTargets() {
    if (!currentProjectId) return;
    setTargets([]);
    setSelectedTargetId(null);

    try {
      switch (selectedType) {
        case 'dossier': {
          const { data } = await supabase
            .from('story_dossiers')
            .select('id, content')
            .eq('project_id', currentProjectId)
            .maybeSingle();
          if (data?.content) {
            setTargets([{ id: data.id, name: 'Story Dossier', content: data.content }]);
            setSelectedTargetId(data.id);
          }
          break;
        }
        case 'outline': {
          if (!currentOutlineId) break;
          const { data } = await supabase
            .from('outlines')
            .select('id, title, synopsis')
            .eq('id', currentOutlineId)
            .maybeSingle();
          if (data) {
            setTargets([{ id: data.id, name: data.title, content: data.synopsis || '' }]);
            setSelectedTargetId(data.id);
          }
          break;
        }
        case 'chapter': {
          if (!currentOutlineId) break;
          const { data } = await supabase
            .from('chapters')
            .select('id, title, summary, key_events')
            .eq('outline_id', currentOutlineId)
            .order('order_index');
          if (data) {
            setTargets(data.map(c => ({
              id: c.id,
              name: c.title,
              content: `${c.summary}\n\nKey Events: ${c.key_events}`,
            })));
          }
          break;
        }
        case 'character': {
          const { data } = await supabase
            .from('characters')
            .select('id, name, role, personality, background, goals')
            .eq('project_id', currentProjectId);
          if (data) {
            setTargets(data.map(c => ({
              id: c.id,
              name: c.name,
              content: `Name: ${c.name}\nRole: ${c.role}\nPersonality: ${c.personality}\nBackground: ${c.background}\nGoals: ${c.goals}`,
            })));
          }
          break;
        }
        case 'worldbuilding': {
          const [placesRes, thingsRes, techsRes] = await Promise.all([
            supabase.from('places').select('id, name, type, description').eq('project_id', currentProjectId),
            supabase.from('things').select('id, name, type, description, properties').eq('project_id', currentProjectId),
            supabase.from('technologies').select('id, name, type, description, rules').eq('project_id', currentProjectId),
          ]);
          const combined: CheckTarget[] = [
            ...(placesRes.data || []).map(p => ({
              id: p.id,
              name: `[Place] ${p.name}`,
              content: `Place: ${p.name} (${p.type})\n${p.description}`,
            })),
            ...(thingsRes.data || []).map(t => ({
              id: t.id,
              name: `[Thing] ${t.name}`,
              content: `Object: ${t.name} (${t.type})\n${t.description}\nProperties: ${t.properties}`,
            })),
            ...(techsRes.data || []).map(t => ({
              id: t.id,
              name: `[Tech] ${t.name}`,
              content: `System: ${t.name} (${t.type})\n${t.description}\nRules: ${t.rules}`,
            })),
          ];
          setTargets(combined);
          break;
        }
      }
    } catch (error) {
      console.error('Error loading targets:', error);
    }
  }

  async function runCheck() {
    if (!currentProjectId) return;

    const settingsRes = await supabase
      .from('generation_settings')
      .select('*')
      .eq('project_id', currentProjectId)
      .maybeSingle();

    if (!settingsRes.data) {
      alert('Please configure AI settings first in the Settings page.');
      return;
    }

    let content = '';
    let targetName = '';
    let targetId: string | null = null;

    if (selectedType === 'worldbuilding' && !selectedTargetId) {
      content = targets.map(t => t.content).join('\n\n---\n\n');
      targetName = 'All Worldbuilding';
    } else {
      const target = targets.find(t => t.id === selectedTargetId);
      if (!target) {
        alert('Please select a target to check.');
        return;
      }
      content = target.content;
      targetName = target.name;
      targetId = target.id;
    }

    if (!content.trim()) {
      alert('No content found for this target.');
      return;
    }

    setGenerating(true);
    try {
      const prompt = buildLogicCheckPrompt(content, selectedType);

      const result = await generateScene({
        sceneDescription: prompt,
        context: {},
        settings: {
          ...settingsRes.data,
          style_rules: (settingsRes.data.style_rules as Record<string, boolean>) || undefined,
        },
      });

      const { data } = await supabase
        .from('logic_checks')
        .insert([{
          project_id: currentProjectId,
          check_type: selectedType,
          target_id: targetId,
          target_name: targetName,
          result,
          status: 'complete',
        }])
        .select()
        .single();

      if (data) setChecks([data, ...checks]);
    } catch (error) {
      console.error('Error running logic check:', error);
      alert('Failed to run logic check. Check AI settings.');
    } finally {
      setGenerating(false);
    }
  }

  async function deleteCheck(id: string) {
    try {
      await supabase.from('logic_checks').delete().eq('id', id);
      setChecks(checks.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting check:', error);
    }
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Logic Checks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Run AI-powered consistency and plausibility audits against your story elements.
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">New Check</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Check Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            >
              {CHECK_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
            {targets.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 border border-slate-200 rounded-lg bg-slate-50">
                No {selectedType} data found
              </div>
            ) : (
              <select
                value={selectedTargetId || ''}
                onChange={(e) => setSelectedTargetId(e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                {selectedType === 'worldbuilding' && (
                  <option value="">All Worldbuilding Elements</option>
                )}
                {targets.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={generating || targets.length === 0}
          className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors"
        >
          {generating ? 'Running Audit...' : 'Run Logic Check'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading...</div>
      ) : checks.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No logic checks yet. Select a target above and run your first audit.
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Previous Checks</h2>
          {checks.map(check => {
            const typeLabel = CHECK_TYPES.find(t => t.key === check.check_type)?.label || check.check_type;
            return (
              <div key={check.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                  onClick={() => setViewingCheck(viewingCheck === check.id ? null : check.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
                      {typeLabel}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{check.target_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {new Date(check.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCheck(check.id);
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
                {viewingCheck === check.id && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                      {check.result}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
