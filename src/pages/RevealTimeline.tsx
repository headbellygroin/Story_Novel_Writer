import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';

interface RevealEntry {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  fact: string;
  book_number: number;
  act: string;
  reveal_method: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

const REVEAL_METHODS = [
  { key: 'direct', label: 'Direct' },
  { key: 'implied', label: 'Implied' },
  { key: 'foreshadowed', label: 'Foreshadowed' },
  { key: 'discovered', label: 'Discovered' },
  { key: 'revealed_by_character', label: 'Character Reveals' },
] as const;

const METHOD_COLORS: Record<string, string> = {
  direct: 'bg-sky-100 text-sky-800',
  implied: 'bg-amber-100 text-amber-800',
  foreshadowed: 'bg-rose-100 text-rose-700',
  discovered: 'bg-emerald-100 text-emerald-800',
  revealed_by_character: 'bg-teal-100 text-teal-800',
};

const ENTITY_TYPES = [
  { key: '', label: 'General' },
  { key: 'characters', label: 'Character' },
  { key: 'places', label: 'Place' },
  { key: 'things', label: 'Thing' },
  { key: 'technologies', label: 'Technology' },
  { key: 'story_bible_entries', label: 'Story Bible' },
] as const;

export default function RevealTimeline() {
  const { currentProjectId } = useStore();
  const [entries, setEntries] = useState<RevealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterBook, setFilterBook] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    entity_type: '',
    entity_name: '',
    fact: '',
    book_number: 1,
    act: '',
    reveal_method: 'direct',
    notes: '',
  });

  useEffect(() => {
    if (currentProjectId) loadEntries();
  }, [currentProjectId]);

  async function loadEntries() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reveal_timeline')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('book_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading reveal timeline:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry() {
    if (!currentProjectId) return;

    try {
      const payload = {
        project_id: currentProjectId,
        entity_type: formData.entity_type,
        entity_name: formData.entity_name,
        fact: formData.fact,
        book_number: formData.book_number,
        act: formData.act,
        reveal_method: formData.reveal_method,
        notes: formData.notes,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('reveal_timeline').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reveal_timeline').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error saving reveal entry:', error);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this reveal entry?')) return;
    const { error } = await supabase.from('reveal_timeline').delete().eq('id', id);
    if (!error) setEntries(entries.filter(e => e.id !== id));
  }

  function startEdit(entry: RevealEntry) {
    setEditingId(entry.id);
    setFormData({
      entity_type: entry.entity_type,
      entity_name: entry.entity_name,
      fact: entry.fact,
      book_number: entry.book_number,
      act: entry.act,
      reveal_method: entry.reveal_method,
      notes: entry.notes,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ entity_type: '', entity_name: '', fact: '', book_number: 1, act: '', reveal_method: 'direct', notes: '' });
  }

  const bookNumbers = [...new Set(entries.map(e => e.book_number))].sort((a, b) => a - b);
  const maxBook = bookNumbers.length > 0 ? Math.max(...bookNumbers) : 1;

  const filtered = filterBook !== null
    ? entries.filter(e => e.book_number === filterBook)
    : entries;

  const grouped = filtered.reduce<Record<number, RevealEntry[]>>((acc, entry) => {
    if (!acc[entry.book_number]) acc[entry.book_number] = [];
    acc[entry.book_number].push(entry);
    return acc;
  }, {});

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reveal Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track when information is revealed to the reader across books and acts.
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterBook(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filterBook === null
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            All Books
          </button>
          {Array.from({ length: Math.max(maxBook, 1) }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onClick={() => setFilterBook(num)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filterBook === num
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              Book {num}
              <span className="ml-1 text-xs opacity-60">
                ({entries.filter(e => e.book_number === num).length})
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm whitespace-nowrap ml-auto"
        >
          Add Reveal
        </button>
      </div>

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Reveal Entry</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Book Number</label>
                <input
                  type="number"
                  min={1}
                  value={formData.book_number}
                  onChange={(e) => setFormData({ ...formData, book_number: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Act / Section</label>
                <input
                  type="text"
                  value={formData.act}
                  onChange={(e) => setFormData({ ...formData, act: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Act 1, Chapter 3, Midpoint..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reveal Method</label>
                <select
                  value={formData.reveal_method}
                  onChange={(e) => setFormData({ ...formData, reveal_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  {REVEAL_METHODS.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                <select
                  value={formData.entity_type}
                  onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  {ENTITY_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entity Name</label>
                <input
                  type="text"
                  value={formData.entity_name}
                  onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="What or who this reveal is about"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">What Is Revealed</label>
              <textarea
                value={formData.fact}
                onChange={(e) => setFormData({ ...formData, fact: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="The specific information the reader learns (e.g., 'Ships have emotional imprinting')"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Context, setup needed, dependencies on other reveals..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEntry}
                disabled={!formData.fact.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
              >
                {editingId ? 'Update' : 'Add Reveal'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-600">Loading...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No reveal entries yet. Track when your readers discover key information!
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([bookNum, bookEntries]) => (
            <div key={bookNum}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900">Book {bookNum}</h2>
                <span className="text-xs text-slate-400 font-medium">
                  {bookEntries.length} reveal{bookEntries.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                {bookEntries.map(entry => (
                  <div key={entry.id} className="relative">
                    <div className="absolute -left-[1.6rem] top-2 w-3 h-3 rounded-full bg-white border-2 border-slate-400" />
                    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${METHOD_COLORS[entry.reveal_method] || 'bg-slate-100 text-slate-600'}`}>
                              {REVEAL_METHODS.find(m => m.key === entry.reveal_method)?.label || entry.reveal_method}
                            </span>
                            {entry.entity_name && (
                              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {entry.entity_name}
                              </span>
                            )}
                            {entry.act && (
                              <span className="text-xs text-slate-400">{entry.act}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-900 font-medium">{entry.fact}</p>
                          {entry.notes && (
                            <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => startEdit(entry)} className="text-primary-600 hover:text-primary-800 text-sm">
                            Edit
                          </button>
                          <button onClick={() => deleteEntry(entry.id)} className="text-red-600 hover:text-red-800 text-sm">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
