import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import { DEFAULT_PROHIBITED_WORDS } from '../lib/defaultProhibitedWords';

interface ProhibitedWord {
  id: string;
  project_id: string;
  word: string;
  category: string;
}

const CATEGORIES = [
  { key: 'ai_ism', label: 'AI-isms', color: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'cliche', label: 'Cliches', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'overused', label: 'Overused', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'custom', label: 'Custom', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export default function ProhibitedWords() {
  const { currentProjectId } = useStore();
  const [words, setWords] = useState<ProhibitedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('custom');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    if (currentProjectId) loadWords();
  }, [currentProjectId]);

  async function loadWords() {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prohibited_words')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('category')
        .order('word');

      if (error) throw error;
      setWords(data || []);
    } catch (error) {
      console.error('Error loading words:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addWord() {
    if (!currentProjectId || !newWord.trim()) return;

    const existing = words.find(w => w.word.toLowerCase() === newWord.trim().toLowerCase());
    if (existing) {
      alert('This word/phrase is already in the list.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('prohibited_words')
        .insert([{ project_id: currentProjectId, word: newWord.trim(), category: newCategory }])
        .select()
        .single();

      if (error) throw error;
      setWords([...words, data]);
      setNewWord('');
    } catch (error) {
      console.error('Error adding word:', error);
    }
  }

  async function deleteWord(id: string) {
    try {
      const { error } = await supabase.from('prohibited_words').delete().eq('id', id);
      if (error) throw error;
      setWords(words.filter(w => w.id !== id));
    } catch (error) {
      console.error('Error deleting word:', error);
    }
  }

  async function loadDefaults() {
    if (!currentProjectId) return;
    if (!confirm(`This will add ${DEFAULT_PROHIBITED_WORDS.length} common AI-isms, cliches, and overused phrases to your list. Existing entries won't be duplicated. Continue?`)) return;

    try {
      const existingLower = new Set(words.map(w => w.word.toLowerCase()));
      const toInsert = DEFAULT_PROHIBITED_WORDS
        .filter(d => !existingLower.has(d.word.toLowerCase()))
        .map(d => ({ project_id: currentProjectId, word: d.word, category: d.category }));

      if (toInsert.length === 0) {
        alert('All default words are already in your list.');
        return;
      }

      const { data, error } = await supabase
        .from('prohibited_words')
        .insert(toInsert)
        .select();

      if (error) throw error;
      setWords([...words, ...(data || [])]);
    } catch (error) {
      console.error('Error loading defaults:', error);
    }
  }

  const filteredWords = filterCategory
    ? words.filter(w => w.category === filterCategory)
    : words;

  const categoryCounts = CATEGORIES.map(c => ({
    ...c,
    count: words.filter(w => w.category === c.key).length,
  }));

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Prohibited Words</h1>
          <p className="text-sm text-slate-500 mt-1">
            Words and phrases the AI should avoid when generating prose. These are injected into every writing prompt.
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWord()}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            placeholder="Add a word or phrase..."
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          >
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={addWord}
            disabled={!newWord.trim()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm transition-colors"
          >
            Add
          </button>
        </div>

        <button
          onClick={loadDefaults}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm transition-colors border border-slate-200"
        >
          Load Default AI-isms & Cliches
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filterCategory ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          All ({words.length})
        </button>
        {categoryCounts.map(c => (
          <button
            key={c.key}
            onClick={() => setFilterCategory(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterCategory === c.key ? 'bg-slate-800 text-white border-slate-800' : `${c.color}`
            }`}
          >
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {filteredWords.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No prohibited words yet. Add some or load the defaults.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredWords.map(word => {
                const cat = CATEGORIES.find(c => c.key === word.category);
                return (
                  <div key={word.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cat?.color || ''}`}>
                        {cat?.label || word.category}
                      </span>
                      <span className="text-sm text-slate-800">{word.word}</span>
                    </div>
                    <button
                      onClick={() => deleteWord(word.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
