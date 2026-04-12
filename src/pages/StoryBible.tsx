import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';

type BibleEntry = Database['public']['Tables']['story_bible_entries']['Row'];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'character_fact', label: 'Character Facts' },
  { key: 'world_rule', label: 'World Rules' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'relationship', label: 'Relationships' },
  { key: 'plot_point', label: 'Plot Points' },
  { key: 'general', label: 'General' },
] as const;

const IMPORTANCE_LEVELS = ['critical', 'high', 'medium', 'low'] as const;

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-sky-100 text-sky-800 border-sky-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function StoryBible() {
  const { currentProjectId } = useStore();
  const [entries, setEntries] = useState<BibleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    category: 'general',
    subject: '',
    fact: '',
    importance: 'medium',
    tags: '',
  });

  useEffect(() => {
    if (currentProjectId) loadEntries();
  }, [currentProjectId]);

  async function loadEntries() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('story_bible_entries')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('importance', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading bible entries:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry() {
    if (!currentProjectId) return;

    try {
      const payload = {
        project_id: currentProjectId,
        category: formData.category,
        subject: formData.subject,
        fact: formData.fact,
        importance: formData.importance,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('story_bible_entries').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('story_bible_entries').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this story bible entry?')) return;
    const { error } = await supabase.from('story_bible_entries').delete().eq('id', id);
    if (!error) setEntries(entries.filter(e => e.id !== id));
  }

  function startEdit(entry: BibleEntry) {
    setEditingId(entry.id);
    setFormData({
      category: entry.category,
      subject: entry.subject,
      fact: entry.fact,
      importance: entry.importance,
      tags: entry.tags.join(', '),
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ category: 'general', subject: '', fact: '', importance: 'medium', tags: '' });
  }

  const filtered = entries.filter(e => {
    const matchesCategory = activeCategory === 'all' || e.category === activeCategory;
    const matchesSearch = !searchQuery ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.fact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) =>
    (importanceOrder[a.importance as keyof typeof importanceOrder] ?? 4) -
    (importanceOrder[b.importance as keyof typeof importanceOrder] ?? 4)
  );

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
          <h1 className="text-3xl font-bold text-slate-900">Story Bible</h1>
          <p className="text-sm text-slate-500 mt-1">
            Canonical facts the AI must follow. These are injected into every generation prompt.
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search facts..."
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm whitespace-nowrap"
        >
          Add Entry
        </button>
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeCategory === cat.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {cat.label}
              {cat.key !== 'all' && (
                <span className="ml-1.5 text-xs text-slate-400">
                  ({entries.filter(e => e.category === cat.key).length})
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Story Bible Entry</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Importance</label>
                <select
                  value={formData.importance}
                  onChange={(e) => setFormData({ ...formData, importance: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  {IMPORTANCE_LEVELS.map(level => (
                    <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="What or who is this fact about? (e.g., 'Aria's Eye Color', 'Magic System Limit')"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fact</label>
              <textarea
                value={formData.fact}
                onChange={(e) => setFormData({ ...formData, fact: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="The canonical fact that must be maintained (e.g., 'Aria has green eyes, never blue.')"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="appearance, Aria, chapter-1"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEntry}
                disabled={!formData.subject.trim() || !formData.fact.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
              >
                {editingId ? 'Update' : 'Add Entry'}
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
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {searchQuery ? 'No matching entries found.' : 'No story bible entries yet. Add your first canonical fact!'}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(entry => (
            <div
              key={entry.id}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${IMPORTANCE_COLORS[entry.importance]}`}>
                      {entry.importance}
                    </span>
                    <span className="text-xs text-slate-400">
                      {CATEGORIES.find(c => c.key === entry.category)?.label || entry.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{entry.subject}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{entry.fact}</p>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">{tag}</span>
                      ))}
                    </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
