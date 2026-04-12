import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import EntityImageUpload from '../components/EntityImageUpload';
import { PERSONALITY_SLIDERS, getSliderDescription } from '../lib/personalitySliders';

type EntityType = 'characters' | 'places' | 'things' | 'technologies';

const HEROS_JOURNEY_FIELDS = [
  { key: 'ordinary_world', label: '1. Ordinary World', placeholder: 'Life before the story. What does their normal look like? What are they missing or ignoring?' },
  { key: 'call_to_adventure', label: '2. Call to Adventure', placeholder: 'The inciting event. What disrupts their world and demands a response?' },
  { key: 'refusal_of_call', label: '3. Refusal of the Call', placeholder: 'Why do they hesitate? What fear, obligation, or doubt holds them back?' },
  { key: 'meeting_the_mentor', label: '4. Meeting the Mentor', placeholder: 'Who or what prepares them? A person, an object, a realization?' },
  { key: 'crossing_threshold', label: '5. Crossing the Threshold', placeholder: 'Point of no return. How do they commit to the journey?' },
  { key: 'tests_allies_enemies', label: '6. Tests, Allies & Enemies', placeholder: 'New world challenges. Who joins them? Who opposes them? What do they learn?' },
  { key: 'approach_innermost_cave', label: '7. Approach to the Innermost Cave', placeholder: 'Preparation for the worst. What must they confront within themselves?' },
  { key: 'ordeal', label: '8. The Ordeal', placeholder: 'The central crisis. Life-or-death stakes. What do they nearly lose?' },
  { key: 'reward', label: '9. Reward (Seizing the Sword)', placeholder: 'What do they gain? Knowledge, power, an object, clarity?' },
  { key: 'road_back', label: '10. The Road Back', placeholder: 'Complications on return. Pursuit, consequences, unfinished business?' },
  { key: 'resurrection', label: '11. Resurrection', placeholder: 'Final test. Everything at stake. How are they fundamentally transformed?' },
  { key: 'return_with_elixir', label: '12. Return with the Elixir', placeholder: 'How do they return changed? What do they bring back to their world?' },
] as const;

export default function WorldLibrary() {
  const { currentProjectId } = useStore();
  const [activeTab, setActiveTab] = useState<EntityType>('characters');
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (currentProjectId) {
      loadEntities();
    }
  }, [currentProjectId, activeTab]);

  async function loadEntities() {
    if (!currentProjectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(activeTab)
        .select('*')
        .eq('project_id', currentProjectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntity() {
    if (!currentProjectId) return;

    try {
      const payload = { ...formData, project_id: currentProjectId, updated_at: new Date().toISOString() };

      if (editingId) {
        const { error } = await supabase
          .from(activeTab)
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(activeTab)
          .insert([payload]);

        if (error) throw error;
      }

      loadEntities();
      setShowForm(false);
      setEditingId(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving entity:', error);
    }
  }

  async function deleteEntity(id: string) {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase.from(activeTab).delete().eq('id', id);

      if (error) throw error;
      setEntities(entities.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Error deleting entity:', error);
    }
  }

  function startEdit(entity: any) {
    setEditingId(entity.id);
    setFormData(entity);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({});
  }

  const tabs: { key: EntityType; label: string }[] = [
    { key: 'characters', label: 'Characters' },
    { key: 'places', label: 'Places' },
    { key: 'things', label: 'Things' },
    { key: 'technologies', label: 'Technology' },
  ];

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">World Library</h1>
        <ProjectSelector />
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setShowForm(false);
                setEditingId(null);
              }}
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

      <div className="mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add {tabs.find((t) => t.key === activeTab)?.label.slice(0, -1)}
        </button>
      </div>

      {showForm && <EntityForm
        type={activeTab}
        formData={formData}
        setFormData={setFormData}
        onSave={saveEntity}
        onCancel={resetForm}
        isEditing={!!editingId}
      />}

      {loading ? (
        <div className="text-center py-8 text-slate-600">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              type={activeTab}
              onEdit={() => startEdit(entity)}
              onDelete={() => deleteEntity(entity.id)}
            />
          ))}
        </div>
      )}

      {!loading && entities.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-600">
          No {tabs.find((t) => t.key === activeTab)?.label.toLowerCase()} yet. Create your first entry!
        </div>
      )}
    </div>
  );
}

function EntityForm({
  type,
  formData,
  setFormData,
  onSave,
  onCancel,
  isEditing,
}: {
  type: EntityType;
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const { currentProjectId } = useStore();
  const fields = getFieldsForType(type);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [slidersOpen, setSlidersOpen] = useState(false);

  const filledStages = type === 'characters'
    ? HEROS_JOURNEY_FIELDS.filter(f => formData[f.key]?.trim()).length
    : 0;

  const sliders = (formData.personality_sliders || {}) as Record<string, number>;
  const configuredSliders = Object.keys(sliders).filter(k => sliders[k] !== undefined).length;

  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-semibold mb-4">
        {isEditing ? 'Edit' : 'Create'} {type.slice(0, -1).charAt(0).toUpperCase() + type.slice(1, -1)}
      </h2>
      <div className="space-y-4">
        {currentProjectId && (
          <EntityImageUpload
            entityType={type}
            entityName={formData.name || ''}
            imageUrl={formData.image_url || ''}
            imageDescription={formData.image_description || ''}
            projectId={currentProjectId}
            onImageChange={(url, desc) =>
              setFormData({ ...formData, image_url: url, image_description: desc })
            }
          />
        )}

        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                value={formData[field.key] || ''}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                rows={field.rows || 3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={field.placeholder}
              />
            ) : (
              <input
                type="text"
                value={formData[field.key] || ''}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}

        {type === 'characters' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setJourneyOpen(!journeyOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">Hero's Journey</span>
                {filledStages > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full font-medium">
                    {filledStages}/12 stages
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${journeyOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {journeyOpen && (
              <div className="p-4 space-y-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Map this character's arc through Campbell's monomyth. Fill in the stages that apply -- not every character needs all twelve.
                </p>
                {HEROS_JOURNEY_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {field.label}
                    </label>
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {type === 'characters' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setSlidersOpen(!slidersOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">Personality Sliders</span>
                {configuredSliders > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
                    {configuredSliders}/{PERSONALITY_SLIDERS.length} set
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${slidersOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {slidersOpen && (
              <div className="p-4 space-y-5 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Set emotional and behavioral baselines for this character. These values are injected into AI prompts for consistent characterization. Range: -10 to +10.
                </p>
                {PERSONALITY_SLIDERS.map(slider => {
                  const value = sliders[slider.id] ?? 0;
                  const desc = getSliderDescription(slider.id, value);
                  return (
                    <div key={slider.id}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">{slider.label}</label>
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {value}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-20 text-right shrink-0">{slider.negativePole}</span>
                        <input
                          type="range"
                          min={-10}
                          max={10}
                          step={1}
                          value={value}
                          onChange={(e) => {
                            const updated = { ...sliders, [slider.id]: parseInt(e.target.value) };
                            setFormData({ ...formData, personality_sliders: updated });
                          }}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                        />
                        <span className="text-xs text-slate-400 w-20 shrink-0">{slider.positivePole}</span>
                      </div>
                      {desc && (
                        <p className="text-xs text-slate-500 mt-1 ml-[calc(5rem+0.75rem)]">{desc}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={!formData.name}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isEditing ? 'Update' : 'Create'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EntityCard({
  entity,
  type,
  onEdit,
  onDelete,
}: {
  entity: any;
  type: EntityType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const preview = getPreviewForType(type, entity);

  const journeyStages = type === 'characters'
    ? HEROS_JOURNEY_FIELDS.filter(f => entity[f.key]?.trim()).length
    : 0;

  const entitySliders = (entity.personality_sliders || {}) as Record<string, number>;
  const sliderCount = type === 'characters'
    ? Object.keys(entitySliders).filter(k => entitySliders[k] !== undefined).length
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {entity.image_url && (
        <div className="relative h-40 bg-slate-100">
          <img
            src={entity.image_url}
            alt={entity.name}
            className="w-full h-full object-cover"
          />
          {entity.image_description && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-1.5">
              <span className="text-xs text-white/80">AI-described</span>
            </div>
          )}
        </div>
      )}
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-slate-900">{entity.name}</h3>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="text-primary-600 hover:text-primary-800 text-sm"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          </div>
        </div>
        {(entity.role || entity.type) && (
          <div className="text-sm text-primary-600 mb-2">{entity.role || entity.type}</div>
        )}
        {preview && (
          <p className="text-slate-600 text-sm line-clamp-4">{preview}</p>
        )}
        {type === 'characters' && (journeyStages > 0 || sliderCount > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            {journeyStages > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < journeyStages ? 'bg-primary-500' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-500">{journeyStages}/12 journey stages</span>
              </div>
            )}
            {sliderCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: PERSONALITY_SLIDERS.length }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < sliderCount ? 'bg-teal-500' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-500">{sliderCount}/{PERSONALITY_SLIDERS.length} personality</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getFieldsForType(type: EntityType) {
  switch (type) {
    case 'characters':
      return [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Character name' },
        { key: 'role', label: 'Role', type: 'text', placeholder: 'Protagonist, Antagonist, Supporting...' },
        { key: 'description', label: 'Physical Description', type: 'textarea', placeholder: 'How they look...', rows: 3 },
        { key: 'personality', label: 'Personality', type: 'textarea', placeholder: 'Personality traits...', rows: 3 },
        { key: 'background', label: 'Background', type: 'textarea', placeholder: 'Their backstory...', rows: 4 },
        { key: 'goals', label: 'Goals', type: 'textarea', placeholder: 'What they want...', rows: 2 },
        { key: 'dialogue_style', label: 'Dialogue Style', type: 'textarea', placeholder: 'How they speak -- vocabulary, cadence, tics, accent, favorite phrases...', rows: 3 },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...', rows: 2 },
      ];
    case 'places':
      return [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Place name' },
        { key: 'type', label: 'Type', type: 'text', placeholder: 'City, Building, Region, Planet...' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Physical description...', rows: 4 },
        { key: 'history', label: 'History', type: 'textarea', placeholder: 'Historical background...', rows: 3 },
        { key: 'significance', label: 'Significance', type: 'textarea', placeholder: 'Why this place matters...', rows: 2 },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...', rows: 2 },
      ];
    case 'things':
      return [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Item name' },
        { key: 'type', label: 'Type', type: 'text', placeholder: 'Weapon, Artifact, Tool...' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Physical description...', rows: 3 },
        { key: 'properties', label: 'Properties', type: 'textarea', placeholder: 'Special properties or abilities...', rows: 3 },
        { key: 'history', label: 'History', type: 'textarea', placeholder: 'Origin and history...', rows: 3 },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...', rows: 2 },
      ];
    case 'technologies':
      return [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Technology/System name' },
        { key: 'type', label: 'Type', type: 'text', placeholder: 'Science, Magic, Hybrid...' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'How it works...', rows: 4 },
        { key: 'rules', label: 'Rules', type: 'textarea', placeholder: 'Rules and limitations...', rows: 3 },
        { key: 'applications', label: 'Applications', type: 'textarea', placeholder: 'Common uses...', rows: 3 },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...', rows: 2 },
      ];
  }
}

function getPreviewForType(type: EntityType, entity: any): string {
  switch (type) {
    case 'characters':
      return entity.description || entity.personality || entity.background || '';
    case 'places':
      return entity.description || entity.history || '';
    case 'things':
      return entity.description || entity.properties || '';
    case 'technologies':
      return entity.description || entity.rules || '';
  }
}
