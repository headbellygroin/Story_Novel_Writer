import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type ContextTag = Database['public']['Tables']['scene_context_tags']['Row'];

interface AvailableEntity {
  id: string;
  name: string;
  type: string;
}

interface Props {
  sceneId: string;
  projectId: string;
}

const ENTITY_TYPES = [
  { key: 'characters', label: 'Characters' },
  { key: 'places', label: 'Places' },
  { key: 'things', label: 'Things' },
  { key: 'technologies', label: 'Technology' },
  { key: 'story_bible_entries', label: 'Story Bible' },
] as const;

type EntityTypeKey = typeof ENTITY_TYPES[number]['key'];

export default function ContextTagsPanel({ sceneId, projectId }: Props) {
  const [tags, setTags] = useState<ContextTag[]>([]);
  const [availableEntities, setAvailableEntities] = useState<Record<string, AvailableEntity[]>>({});
  const [activeType, setActiveType] = useState<EntityTypeKey>('characters');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadTags();
    loadAvailableEntities();
  }, [sceneId, projectId]);

  async function loadTags() {
    const { data } = await supabase
      .from('scene_context_tags')
      .select('*')
      .eq('scene_id', sceneId);
    setTags(data || []);
  }

  async function loadAvailableEntities() {
    const results: Record<string, AvailableEntity[]> = {};

    const [chars, places, things, techs, bible] = await Promise.all([
      supabase.from('characters').select('id, name').eq('project_id', projectId),
      supabase.from('places').select('id, name').eq('project_id', projectId),
      supabase.from('things').select('id, name').eq('project_id', projectId),
      supabase.from('technologies').select('id, name').eq('project_id', projectId),
      supabase.from('story_bible_entries').select('id, subject, category').eq('project_id', projectId),
    ]);

    results.characters = (chars.data || []).map(c => ({ id: c.id, name: c.name, type: 'characters' }));
    results.places = (places.data || []).map(p => ({ id: p.id, name: p.name, type: 'places' }));
    results.things = (things.data || []).map(t => ({ id: t.id, name: t.name, type: 'things' }));
    results.technologies = (techs.data || []).map(t => ({ id: t.id, name: t.name, type: 'technologies' }));
    results.story_bible_entries = (bible.data || []).map(b => ({
      id: b.id,
      name: `${b.subject} (${b.category})`,
      type: 'story_bible_entries',
    }));

    setAvailableEntities(results);
  }

  async function addTag(entity: AvailableEntity) {
    const exists = tags.some(t => t.entity_id === entity.id && t.entity_type === entity.type);
    if (exists) return;

    const { data, error } = await supabase
      .from('scene_context_tags')
      .insert([{
        scene_id: sceneId,
        project_id: projectId,
        entity_type: entity.type,
        entity_id: entity.id,
        entity_name: entity.name,
      }])
      .select()
      .single();

    if (!error && data) {
      setTags([...tags, data]);
    }
  }

  async function removeTag(tagId: string) {
    const { error } = await supabase
      .from('scene_context_tags')
      .delete()
      .eq('id', tagId);

    if (!error) {
      setTags(tags.filter(t => t.id !== tagId));
    }
  }

  const taggedIds = new Set(tags.map(t => t.entity_id));

  const typeColors: Record<string, string> = {
    characters: 'bg-sky-100 text-sky-700 border-sky-200',
    places: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    things: 'bg-amber-100 text-amber-700 border-amber-200',
    technologies: 'bg-rose-100 text-rose-700 border-rose-200',
    story_bible_entries: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-700">Context Tags</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary-600 hover:text-primary-800"
        >
          {expanded ? 'Collapse' : 'Add Tags'}
        </button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(tag => (
            <span
              key={tag.id}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border ${typeColors[tag.entity_type] || 'bg-slate-100 text-slate-600'}`}
            >
              {tag.entity_name}
              <button
                onClick={() => removeTag(tag.id)}
                className="hover:opacity-70 ml-0.5"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {tags.length === 0 && !expanded && (
        <p className="text-xs text-slate-400 italic">
          Tag characters, places, and facts relevant to this scene. Only tagged items will be sent to the AI.
        </p>
      )}

      {expanded && (
        <div className="mt-2 border border-slate-200 rounded-md overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {ENTITY_TYPES.map(et => (
              <button
                key={et.key}
                onClick={() => setActiveType(et.key)}
                className={`px-2 py-1.5 text-xs whitespace-nowrap border-b-2 transition-colors ${
                  activeType === et.key
                    ? 'border-primary-500 text-primary-700 bg-primary-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>
          <div className="max-h-40 overflow-y-auto p-2 space-y-1">
            {(availableEntities[activeType] || []).length === 0 && (
              <p className="text-xs text-slate-400 italic">No {activeType} found. Add some in the World Library.</p>
            )}
            {(availableEntities[activeType] || []).map(entity => {
              const isTagged = taggedIds.has(entity.id);
              return (
                <button
                  key={entity.id}
                  onClick={() => isTagged ? undefined : addTag(entity)}
                  disabled={isTagged}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                    isTagged
                      ? 'bg-green-50 text-green-700 cursor-default'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {isTagged ? '+ ' : ''}{entity.name}
                  {isTagged && <span className="float-right text-green-500">tagged</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
