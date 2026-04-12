import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type CharacterState = Database['public']['Tables']['character_states']['Row'];
type Character = Database['public']['Tables']['characters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];

interface Props {
  projectId: string;
  characters: Character[];
  scenes: Scene[];
}

export default function CharacterStates({ projectId, characters, scenes }: Props) {
  const [states, setStates] = useState<CharacterState[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CharacterState>>({});
  const [filterCharId, setFilterCharId] = useState<string>('');

  useEffect(() => {
    loadStates();
  }, [projectId]);

  async function loadStates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('character_states')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error) setStates(data || []);
    setLoading(false);
  }

  async function saveState() {
    const payload = {
      ...formData,
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('character_states').update(payload).eq('id', editingId);
      if (!error) loadStates();
    } else {
      const { error } = await supabase.from('character_states').insert([payload]);
      if (!error) loadStates();
    }

    resetForm();
  }

  async function deleteState(id: string) {
    if (!confirm('Delete this character state entry?')) return;
    const { error } = await supabase.from('character_states').delete().eq('id', id);
    if (!error) setStates(states.filter(s => s.id !== id));
  }

  function startEdit(state: CharacterState) {
    setEditingId(state.id);
    setFormData(state);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({});
  }

  const filtered = filterCharId
    ? states.filter(s => s.character_id === filterCharId)
    : states;

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Character State
        </button>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Filter:</label>
          <select
            value={filterCharId}
            onChange={(e) => setFilterCharId(e.target.value)}
            className="rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          >
            <option value="">All Characters</option>
            {characters.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Character State</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Character</label>
                <select
                  value={formData.character_id || ''}
                  onChange={(e) => setFormData({ ...formData, character_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select character...</option>
                  {characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">As of Scene</label>
                <select
                  value={formData.scene_id || ''}
                  onChange={(e) => setFormData({ ...formData, scene_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select scene...</option>
                  {scenes.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Physical State</label>
              <textarea
                value={formData.physical_state || ''}
                onChange={(e) => setFormData({ ...formData, physical_state: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Injured left arm, wearing blue cloak..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Emotional State</label>
              <textarea
                value={formData.emotional_state || ''}
                onChange={(e) => setFormData({ ...formData, emotional_state: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Grieving, distrustful of allies..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Knowledge</label>
              <textarea
                value={formData.knowledge || ''}
                onChange={(e) => setFormData({ ...formData, knowledge: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Knows about the betrayal, unaware of the prophecy..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Possessions</label>
              <textarea
                value={formData.possessions || ''}
                onChange={(e) => setFormData({ ...formData, possessions: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Sword of Light, map fragment, 50 gold..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveState}
                disabled={!formData.character_id || !formData.scene_id}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {editingId ? 'Update' : 'Add'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(state => {
          const char = characters.find(c => c.id === state.character_id);
          const scene = scenes.find(s => s.id === state.scene_id);
          return (
            <div key={state.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{char?.name || 'Unknown'}</h3>
                  <p className="text-xs text-slate-500">as of: {scene?.title || 'Unknown scene'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(state)} className="text-primary-600 hover:text-primary-800 text-sm">Edit</button>
                  <button onClick={() => deleteState(state.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {state.physical_state && (
                  <div>
                    <span className="font-medium text-slate-700">Physical:</span>
                    <p className="text-slate-600 mt-0.5">{state.physical_state}</p>
                  </div>
                )}
                {state.emotional_state && (
                  <div>
                    <span className="font-medium text-slate-700">Emotional:</span>
                    <p className="text-slate-600 mt-0.5">{state.emotional_state}</p>
                  </div>
                )}
                {state.knowledge && (
                  <div>
                    <span className="font-medium text-slate-700">Knowledge:</span>
                    <p className="text-slate-600 mt-0.5">{state.knowledge}</p>
                  </div>
                )}
                {state.possessions && (
                  <div>
                    <span className="font-medium text-slate-700">Possessions:</span>
                    <p className="text-slate-600 mt-0.5">{state.possessions}</p>
                  </div>
                )}
              </div>
              {state.notes && (
                <p className="text-sm text-slate-500 mt-3 italic">{state.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-600">
          {filterCharId
            ? 'No state entries for this character. Add one to track their changes.'
            : 'No character states tracked yet. Track how characters evolve across scenes.'}
        </div>
      )}
    </div>
  );
}
