import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import ProjectSelector from '../components/ProjectSelector';
import StoryEvents from '../components/consistency/StoryEvents';
import CharacterStates from '../components/consistency/CharacterStates';
import SceneReferences from '../components/consistency/SceneReferences';

type Character = Database['public']['Tables']['characters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];
type Chapter = Database['public']['Tables']['chapters']['Row'];

type TabKey = 'events' | 'states' | 'references';

export default function Consistency() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [activeTab, setActiveTab] = useState<TabKey>('events');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    if (currentProjectId) loadSupportingData();
  }, [currentProjectId, currentOutlineId]);

  async function loadSupportingData() {
    if (!currentProjectId) return;

    const [charsRes, scenesRes] = await Promise.all([
      supabase.from('characters').select('*').eq('project_id', currentProjectId),
      supabase.from('scenes').select('*').eq('project_id', currentProjectId).order('order_index'),
    ]);

    setCharacters(charsRes.data || []);
    setScenes(scenesRes.data || []);

    if (currentOutlineId) {
      const chaptersRes = await supabase
        .from('chapters')
        .select('*')
        .eq('outline_id', currentOutlineId)
        .order('order_index');
      setChapters(chaptersRes.data || []);
    }
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; description: string }[] = [
    { key: 'events', label: 'Story Events', description: 'Track important plot points for continuity' },
    { key: 'states', label: 'Character States', description: 'Track how characters change across scenes' },
    { key: 'references', label: 'Scene References', description: 'Mark scenes the AI should reference' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Consistency Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            Keep your story consistent by tracking events, character changes, and important references
          </p>
        </div>
        <ProjectSelector />
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        {tabs.find(t => t.key === activeTab)?.description}
      </p>

      {activeTab === 'events' && (
        <StoryEvents
          projectId={currentProjectId}
          scenes={scenes}
          chapters={chapters}
          characters={characters}
        />
      )}
      {activeTab === 'states' && (
        <CharacterStates
          projectId={currentProjectId}
          characters={characters}
          scenes={scenes}
        />
      )}
      {activeTab === 'references' && (
        <SceneReferences
          projectId={currentProjectId}
          scenes={scenes}
        />
      )}
    </div>
  );
}
