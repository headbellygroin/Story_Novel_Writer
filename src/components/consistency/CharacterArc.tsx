import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { PERSONALITY_SLIDERS } from '../../lib/personalitySliders';
import {
  getArcEventsForCharacter,
  computeEvolvedSliders,
  updateArcEventStatus,
  analyzeSceneForArcShifts,
  saveArcEvents,
} from '../../services/arcAnalysisService';

type Character = Database['public']['Tables']['characters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];
type ArcEvent = Database['public']['Tables']['character_arc_events']['Row'];

interface Props {
  projectId: string;
  characters: Character[];
  scenes: Scene[];
}

export default function CharacterArc({ projectId, characters, scenes }: Props) {
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [events, setEvents] = useState<ArcEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeSceneId, setAnalyzeSceneId] = useState<string>('');

  useEffect(() => {
    if (selectedCharId) loadEvents();
  }, [selectedCharId]);

  async function loadEvents() {
    setLoading(true);
    const data = await getArcEventsForCharacter(projectId, selectedCharId);
    setEvents(data);
    setLoading(false);
  }

  async function handleStatusChange(id: string, status: 'accepted' | 'rejected') {
    await updateArcEventStatus(id, status);
    setEvents(events.map(e => e.id === id ? { ...e, status } : e));
  }

  async function runAnalysis() {
    if (!analyzeSceneId) return;
    const scene = scenes.find(s => s.id === analyzeSceneId);
    if (!scene) return;

    const settingsRes = await supabase
      .from('generation_settings')
      .select('api_endpoint, model_name, temperature, max_tokens')
      .eq('project_id', projectId)
      .maybeSingle();

    if (!settingsRes.data) {
      alert('Please configure AI settings first.');
      return;
    }

    const charsToAnalyze = selectedCharId
      ? characters.filter(c => c.id === selectedCharId)
      : characters;

    setAnalyzing(true);
    try {
      const results = await analyzeSceneForArcShifts(scene, charsToAnalyze, settingsRes.data);
      await saveArcEvents(projectId, analyzeSceneId, results);
      if (selectedCharId) loadEvents();
      const count = results.reduce((sum, r) => sum + r.adjustments.length, 0);
      alert(`Analysis complete: ${count} shift(s) proposed across ${results.length} character(s).`);
    } catch (err) {
      console.error('Arc analysis failed:', err);
      alert('Analysis failed. Check console for details.');
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const baselineSliders: Record<string, number> = selectedChar?.personality_sliders
    ? (typeof selectedChar.personality_sliders === 'string'
      ? JSON.parse(selectedChar.personality_sliders)
      : selectedChar.personality_sliders as Record<string, number>)
    : {};

  const acceptedEvents = events.filter(e => e.status === 'accepted');
  const evolvedSliders = computeEvolvedSliders(baselineSliders, acceptedEvents);

  return (
    <div>
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Analyze Scene for Arc Shifts</h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Scene to Analyze</label>
            <select
              value={analyzeSceneId}
              onChange={(e) => setAnalyzeSceneId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select a scene...</option>
              {scenes.filter(s => s.content).map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <button
            onClick={runAnalysis}
            disabled={!analyzeSceneId || analyzing}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {analyzing ? 'Analyzing...' : 'Run Arc Analysis'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          The AI will read the scene and propose personality slider adjustments for {selectedCharId ? 'the selected character' : 'all characters'}.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">View Character:</label>
        <select
          value={selectedCharId}
          onChange={(e) => setSelectedCharId(e.target.value)}
          className="rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm"
        >
          <option value="">Select character...</option>
          {characters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {selectedCharId && !loading && (
        <>
          <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Personality Evolution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PERSONALITY_SLIDERS.map(slider => {
                const baseline = baselineSliders[slider.id];
                if (baseline === undefined) return null;
                const current = evolvedSliders[slider.id] ?? baseline;
                const diff = current - baseline;
                return (
                  <div key={slider.id} className="flex items-center gap-3">
                    <div className="w-40 text-sm text-slate-700 truncate">{slider.label}</div>
                    <div className="flex-1 relative h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 h-full w-1 bg-slate-400"
                        style={{ left: `${((baseline + 10) / 20) * 100}%` }}
                        title={`Baseline: ${baseline}`}
                      />
                      <div
                        className={`absolute top-1 bottom-1 rounded-full ${diff > 0 ? 'bg-teal-400' : diff < 0 ? 'bg-amber-400' : 'bg-slate-300'}`}
                        style={{
                          left: `${((Math.min(baseline, current) + 10) / 20) * 100}%`,
                          width: `${(Math.abs(diff) / 20) * 100}%`,
                        }}
                      />
                      <div
                        className={`absolute top-0 h-full w-2 rounded-full ${diff !== 0 ? 'bg-teal-600' : 'bg-slate-500'}`}
                        style={{ left: `${((current + 10) / 20) * 100}%` }}
                        title={`Current: ${current}`}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-mono">
                      {baseline}
                      {diff !== 0 && (
                        <span className={diff > 0 ? 'text-teal-600' : 'text-amber-600'}>
                          {' '}{diff > 0 ? '+' : ''}{diff}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {Object.keys(baselineSliders).length === 0 && (
              <p className="text-sm text-slate-500">No baseline sliders set for this character. Set them in World Library first.</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Arc Events ({events.length})</h3>
            {events.length === 0 && (
              <p className="text-sm text-slate-500 py-4">No arc events tracked yet. Run an analysis on a completed scene to generate proposals.</p>
            )}
            {events.map(event => {
              const slider = PERSONALITY_SLIDERS.find(s => s.id === event.slider_id);
              const scene = scenes.find(s => s.id === event.scene_id);
              return (
                <div key={event.id} className={`bg-white rounded-lg shadow-sm border p-4 ${
                  event.status === 'accepted' ? 'border-teal-200 bg-teal-50/30' :
                  event.status === 'rejected' ? 'border-slate-200 opacity-60' :
                  'border-amber-200 bg-amber-50/30'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900">
                          {slider?.label || event.slider_id}
                        </span>
                        <span className={`text-sm font-mono ${event.delta > 0 ? 'text-teal-600' : 'text-amber-600'}`}>
                          {event.delta > 0 ? '+' : ''}{event.delta}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          event.status === 'accepted' ? 'bg-teal-100 text-teal-700' :
                          event.status === 'rejected' ? 'bg-slate-100 text-slate-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{event.reasoning}</p>
                      <p className="text-xs text-slate-400 mt-1">Scene: {scene?.title || 'Unknown'}</p>
                    </div>
                    {event.status === 'proposed' && (
                      <div className="flex gap-1 ml-3">
                        <button
                          onClick={() => handleStatusChange(event.id, 'accepted')}
                          className="px-3 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleStatusChange(event.id, 'rejected')}
                          className="px-3 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {loading && <div className="text-center py-8 text-slate-600">Loading arc events...</div>}
    </div>
  );
}
