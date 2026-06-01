import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ProjectSelector from '../components/ProjectSelector';
import EntityImageUpload from '../components/EntityImageUpload';
import ImageLightbox from '../components/ImageLightbox';
import { PERSONALITY_SLIDERS, getSliderDescription } from '../lib/personalitySliders';
import { INFRASTRUCTURE_SLIDERS, getInfraSliderDescription } from '../lib/infrastructureSliders';
import { CHARACTER_DOSSIER_TEMPLATE, DOSSIER_SECTIONS, countFilledSections } from '../lib/characterDossierTemplate';
import { CANON_STATUSES, CANON_STATUS_COLORS, CANON_STATUS_DOT } from '../lib/canonStatus';
import { generateSceneStreaming } from '../services/aiService';
import { proxyImageUrl, comfyProxyGet } from '../lib/proxyFetch';
import { getEndpointConfig } from '../lib/endpointResolver';

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
  const [comfyEndpoint, setComfyEndpoint] = useState('');
  const [exportingLocations, setExportingLocations] = useState(false);
  const [exportingCharacters, setExportingCharacters] = useState(false);
  const [exportingThings, setExportingThings] = useState(false);
  const [exportingTech, setExportingTech] = useState(false);

  useEffect(() => {
    if (currentProjectId) {
      getEndpointConfig().then((config) => {
        if (config.isRemote && config.remoteComfy) {
          setComfyEndpoint(config.remoteComfy);
        } else {
          setComfyEndpoint(config.localComfy || 'http://127.0.0.1:8188');
        }
      });
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      loadEntities();
    }
  }, [currentProjectId, activeTab]);

  async function handleExportLocations() {
    if (!currentProjectId) return;
    setExportingLocations(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { data: places, error } = await supabase
        .from('places')
        .select('name, description, image_url')
        .eq('project_id', currentProjectId)
        .order('name');
      if (error) throw error;
      if (!places || places.length === 0) {
        alert('No locations found.');
        setExportingLocations(false);
        return;
      }
      const config = await getEndpointConfig();
      const endpoint = config.isRemote && config.remoteComfy
        ? config.remoteComfy
        : config.localComfy || 'http://127.0.0.1:8188';
      const zip = new JSZip();
      const mdResponse = await fetch('/downloads/sailor_town_locations.md');
      if (mdResponse.ok) {
        zip.file('universe_map_locations.md', await mdResponse.text());
      }
      const imagesFolder = zip.folder('images');
      for (const place of places) {
        if (!place.image_url) continue;
        try {
          const resolvedUrl = proxyImageUrl(place.image_url, endpoint);
          const imgResponse = await fetch(resolvedUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const safeName = place.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            imagesFolder!.file(`${safeName}.${ext}`, blob);
          }
        } catch (imgErr) {
          console.warn(`Failed to fetch image for ${place.name}:`, imgErr);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'universe_map_locations.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console.');
    } finally {
      setExportingLocations(false);
    }
  }

  async function handleExportCharacters() {
    if (!currentProjectId) return;
    setExportingCharacters(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { data: characters, error } = await supabase
        .from('characters')
        .select('name, description, role, personality, background, goals, image_url')
        .eq('project_id', currentProjectId)
        .order('name');
      if (error) throw error;
      if (!characters || characters.length === 0) {
        alert('No characters found.');
        setExportingCharacters(false);
        return;
      }
      const config = await getEndpointConfig();
      const endpoint = config.isRemote && config.remoteComfy
        ? config.remoteComfy
        : config.localComfy || 'http://127.0.0.1:8188';
      const zip = new JSZip();
      const mdResponse = await fetch('/downloads/sailor_town_characters.md');
      if (mdResponse.ok) {
        zip.file('characters_reference.md', await mdResponse.text());
      }
      const imagesFolder = zip.folder('images');
      for (const char of characters) {
        if (!char.image_url) continue;
        try {
          const resolvedUrl = proxyImageUrl(char.image_url, endpoint);
          const imgResponse = await fetch(resolvedUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const safeName = char.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            imagesFolder!.file(`${safeName}.${ext}`, blob);
          }
        } catch (imgErr) {
          console.warn(`Failed to fetch image for ${char.name}:`, imgErr);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'characters_package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console.');
    } finally {
      setExportingCharacters(false);
    }
  }

  async function handleExportThings() {
    if (!currentProjectId) return;
    setExportingThings(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { data: things, error } = await supabase
        .from('things')
        .select('name, type, description, properties, history, notes, image_url, canon_status')
        .eq('project_id', currentProjectId)
        .order('name');
      if (error) throw error;
      if (!things || things.length === 0) {
        alert('No things found.');
        setExportingThings(false);
        return;
      }
      const config = await getEndpointConfig();
      const endpoint = config.isRemote && config.remoteComfy
        ? config.remoteComfy
        : config.localComfy || 'http://127.0.0.1:8188';
      const zip = new JSZip();
      let md = '# Things Reference\n\n';
      for (const thing of things) {
        md += `## ${thing.name}\n\n`;
        if (thing.type) md += `**Type:** ${thing.type}\n\n`;
        if (thing.canon_status) md += `**Canon Status:** ${thing.canon_status}\n\n`;
        if (thing.description) md += `**Description:** ${thing.description}\n\n`;
        if (thing.properties) md += `**Properties:** ${thing.properties}\n\n`;
        if (thing.history) md += `**History:** ${thing.history}\n\n`;
        if (thing.notes) md += `**Notes:** ${thing.notes}\n\n`;
        md += '---\n\n';
      }
      zip.file('things_reference.md', md);
      const imagesFolder = zip.folder('images');
      for (const thing of things) {
        if (!thing.image_url) continue;
        try {
          const resolvedUrl = proxyImageUrl(thing.image_url, endpoint);
          const imgResponse = await fetch(resolvedUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const safeName = thing.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            imagesFolder!.file(`${safeName}.${ext}`, blob);
          }
        } catch (imgErr) {
          console.warn(`Failed to fetch image for ${thing.name}:`, imgErr);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'things_package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console.');
    } finally {
      setExportingThings(false);
    }
  }

  async function handleExportTech() {
    if (!currentProjectId) return;
    setExportingTech(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { data: tech, error } = await supabase
        .from('technologies')
        .select('name, type, description, rules, applications, notes, image_url, canon_status')
        .eq('project_id', currentProjectId)
        .order('name');
      if (error) throw error;
      if (!tech || tech.length === 0) {
        alert('No technologies found.');
        setExportingTech(false);
        return;
      }
      const config = await getEndpointConfig();
      const endpoint = config.isRemote && config.remoteComfy
        ? config.remoteComfy
        : config.localComfy || 'http://127.0.0.1:8188';
      const zip = new JSZip();
      let md = '# Technologies Reference\n\n';
      for (const item of tech) {
        md += `## ${item.name}\n\n`;
        if (item.type) md += `**Type:** ${item.type}\n\n`;
        if (item.canon_status) md += `**Canon Status:** ${item.canon_status}\n\n`;
        if (item.description) md += `**Description:** ${item.description}\n\n`;
        if (item.rules) md += `**Rules:** ${item.rules}\n\n`;
        if (item.applications) md += `**Applications:** ${item.applications}\n\n`;
        if (item.notes) md += `**Notes:** ${item.notes}\n\n`;
        md += '---\n\n';
      }
      zip.file('technologies_reference.md', md);
      const imagesFolder = zip.folder('images');
      for (const item of tech) {
        if (!item.image_url) continue;
        try {
          const resolvedUrl = proxyImageUrl(item.image_url, endpoint);
          const imgResponse = await fetch(resolvedUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const safeName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
            imagesFolder!.file(`${safeName}.${ext}`, blob);
          }
        } catch (imgErr) {
          console.warn(`Failed to fetch image for ${item.name}:`, imgErr);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'technologies_package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console.');
    } finally {
      setExportingTech(false);
    }
  }

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

      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add {tabs.find((t) => t.key === activeTab)?.label.slice(0, -1)}
        </button>
        {activeTab === 'places' && (
          <button
            onClick={handleExportLocations}
            disabled={exportingLocations}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {exportingLocations ? 'Exporting...' : 'Download Map Package'}
          </button>
        )}
        {activeTab === 'characters' && (
          <button
            onClick={handleExportCharacters}
            disabled={exportingCharacters}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {exportingCharacters ? 'Exporting...' : 'Download Character Package'}
          </button>
        )}
        {activeTab === 'things' && (
          <button
            onClick={handleExportThings}
            disabled={exportingThings}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {exportingThings ? 'Exporting...' : 'Download Things Package'}
          </button>
        )}
        {activeTab === 'technologies' && (
          <button
            onClick={handleExportTech}
            disabled={exportingTech}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {exportingTech ? 'Exporting...' : 'Download Technology Package'}
          </button>
        )}
      </div>

      {showForm && <EntityForm
        type={activeTab}
        formData={formData}
        setFormData={setFormData}
        onSave={saveEntity}
        onCancel={resetForm}
        isEditing={!!editingId}
        entityId={editingId || undefined}
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
              comfyEndpoint={comfyEndpoint}
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
  entityId,
}: {
  type: EntityType;
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
  entityId?: string;
}) {
  const { currentProjectId } = useStore();
  const fields = getFieldsForType(type);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [slidersOpen, setSlidersOpen] = useState(false);
  const [infraSlidersOpen, setInfraSlidersOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [generatingDossier, setGeneratingDossier] = useState(false);
  const [dossierMode, setDossierMode] = useState<'structured' | 'narrative'>('narrative');

  async function handleGenerateWriteup() {
    if (!currentProjectId || !formData.name?.trim()) return;
    const settingsRes = await supabase
      .from('generation_settings')
      .select('*')
      .eq('project_id', currentProjectId)
      .maybeSingle();
    if (!settingsRes.data) {
      alert('Please configure AI settings first in the Settings page.');
      return;
    }
    setGeneratingDossier(true);
    try {
      const charContext: string[] = [];
      charContext.push(`Character Name: ${formData.name}`);
      if (formData.role) charContext.push(`Role: ${formData.role}`);
      if (formData.description) charContext.push(`Description: ${formData.description}`);
      if (formData.personality) charContext.push(`Personality: ${formData.personality}`);
      if (formData.background) charContext.push(`Background: ${formData.background}`);
      if (formData.goals) charContext.push(`Goals: ${formData.goals}`);
      if (formData.dialogue_style) charContext.push(`Dialogue Style: ${formData.dialogue_style}`);
      if (formData.notes) charContext.push(`Notes: ${formData.notes}`);
      const sliderData = formData.personality_sliders as Record<string, number> | undefined;
      if (sliderData && Object.keys(sliderData).length > 0) {
        const sliderLines = Object.entries(sliderData)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => {
            const slider = PERSONALITY_SLIDERS.find(s => s.id === k);
            return slider ? `${slider.label}: ${v}/10` : `${k}: ${v}/10`;
          });
        if (sliderLines.length > 0) charContext.push(`Personality Sliders:\n${sliderLines.join('\n')}`);
      }
      const infraData = formData.infrastructure_sliders as Record<string, number> | undefined;
      if (infraData && Object.keys(infraData).length > 0) {
        const infraLines = Object.entries(infraData)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => {
            const slider = INFRASTRUCTURE_SLIDERS.find(s => s.id === k);
            return slider ? `${slider.label}: ${v}/10` : `${k}: ${v}/10`;
          });
        if (infraLines.length > 0) charContext.push(`Infrastructure Sliders:\n${infraLines.join('\n')}`);
      }
      HEROS_JOURNEY_FIELDS.forEach(f => {
        if (formData[f.key]?.trim()) charContext.push(`${f.label}: ${formData[f.key]}`);
      });
      if (formData.dossier?.trim()) charContext.push(`Existing Dossier Content:\n${formData.dossier}`);

      const structuredInstructions = `You are a creative writing assistant specializing in deep character profiles. Based on the following character information, write a comprehensive Character Dossier using structured markdown sections. Use ## headers for each section. Fill each section with insightful, specific content derived from the character data provided. If information for a section isn't available, use creative inference based on what IS provided. Skip sections that truly cannot be inferred.

=== CHARACTER DATA ===
${charContext.join('\n\n')}

=== DOSSIER TEMPLATE SECTIONS TO FILL ===
1. Core Role (emotional/narrative purpose)
2. Function/Occupation
3. Public Appearance (how society sees them)
4. Internal Appearance (how loved ones see them)
5. Personality Traits (positive, negative, contradictory)
6. Emotional Function Within Group
7. Relationship With Setting
8. Key Relationships
9. Personal Fear
10. Personal Flaw
11. Quiet Human Moments (small realistic details)
12. Comedy Dynamics
13. Symbolic Theme
14. Character Arc (beginning, midpoint, end)
15. Relationship To The Wider World

Write the dossier now, using markdown headers (##) for each section. Be specific, vivid, and true to the character data provided.`;

      const narrativeInstructions = `You are a creative writing assistant specializing in deep character profiles. Based on the following character information, write a comprehensive character dossier as flowing narrative prose. Write it like an in-universe personnel file, biography, or character essay. Do NOT use section headers, bullet points, or lists. The text should read naturally as continuous prose, suitable for direct inclusion in franchise documentation. Cover: their role and function, how the world sees them versus how those close to them see them, personality (including contradictions), emotional function in the group, fears, flaws, quiet human moments, comedic qualities, symbolic themes, and character arc. Be specific, vivid, and true to the character data. If information for an aspect isn't available, use creative inference based on what IS provided.

=== CHARACTER DATA ===
${charContext.join('\n\n')}

Write the narrative dossier now. No headers. No bullet points. Flowing prose only.`;

      const prompt = dossierMode === 'narrative' ? narrativeInstructions : structuredInstructions;

      await generateSceneStreaming(
        {
          sceneDescription: prompt,
          context: {},
          settings: {
            ...settingsRes.data,
            style_rules: (settingsRes.data.style_rules as Record<string, boolean>) || undefined,
          },
        },
        (streamedText) => {
          setFormData({ ...formData, dossier: streamedText });
        },
      );
    } catch (err) {
      console.error('Dossier generation failed:', err);
      alert('Dossier generation failed. Check console for details.');
    } finally {
      setGeneratingDossier(false);
    }
  }

  const filledStages = type === 'characters'
    ? HEROS_JOURNEY_FIELDS.filter(f => formData[f.key]?.trim()).length
    : 0;

  const sliders = (formData.personality_sliders || {}) as Record<string, number>;
  const configuredSliders = Object.keys(sliders).filter(k => sliders[k] !== undefined).length;

  const infraSliders = (formData.infrastructure_sliders || {}) as Record<string, number>;
  const configuredInfraSliders = Object.keys(infraSliders).filter(k => infraSliders[k] !== undefined).length;

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
            entityDescription={formData.description || ''}
            projectId={currentProjectId}
            entityId={entityId}
            onImageChange={(url, desc) =>
              setFormData({ ...formData, image_url: url, image_description: desc })
            }
          />
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Canon Status</label>
          <div className="flex flex-wrap gap-2">
            {CANON_STATUSES.map(status => (
              <button
                key={status.key}
                type="button"
                onClick={() => setFormData({ ...formData, canon_status: status.key })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  (formData.canon_status || 'draft') === status.key
                    ? `${CANON_STATUS_COLORS[status.key]} ring-2 ring-offset-1 ring-current`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
                title={status.description}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, emergent_character: !formData.emergent_character })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              formData.emergent_character ? 'bg-sky-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                formData.emergent_character ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-slate-700">Emergent Character</span>
            <p className="text-xs text-slate-500">This entity has its own personality and agency -- it acts, not just exists.</p>
          </div>
        </div>

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

        {formData.emergent_character && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setInfraSlidersOpen(!infraSlidersOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">Infrastructure Traits</span>
                {configuredInfraSliders > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full font-medium">
                    {configuredInfraSliders}/{INFRASTRUCTURE_SLIDERS.length} set
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${infraSlidersOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {infraSlidersOpen && (
              <div className="p-4 space-y-5 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  For ships, stations, or other infrastructure-as-character entities. These traits describe how the structure behaves, feels, and relates to its occupants. Range: -10 to +10.
                </p>
                {INFRASTRUCTURE_SLIDERS.map(slider => {
                  const value = infraSliders[slider.id] ?? 0;
                  const desc = getInfraSliderDescription(slider.id, value);
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
                            const updated = { ...infraSliders, [slider.id]: parseInt(e.target.value) };
                            setFormData({ ...formData, infrastructure_sliders: updated });
                          }}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
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

        {type === 'characters' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDossierOpen(!dossierOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">Character Dossier</span>
                {countFilledSections(formData.dossier || '') > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                    {countFilledSections(formData.dossier || '')}/{DOSSIER_SECTIONS.length} sections
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${dossierOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dossierOpen && (
              <div className="p-4 space-y-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Deep character development profile. Covers emotional role, dual appearance (public vs. internal),
                  relationships, fears, flaws, quiet moments, comedy, symbolism, and arc. Fill in what applies -- leave
                  irrelevant sections blank.
                </p>
                <div className="flex gap-2">
                  {!formData.dossier?.trim() && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dossier: CHARACTER_DOSSIER_TEMPLATE })}
                      className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Load Template
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setDossierMode('structured')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dossierMode === 'structured' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Structured
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierMode('narrative')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dossierMode === 'narrative' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Narrative
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateWriteup}
                    disabled={generatingDossier || !formData.name?.trim()}
                    className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingDossier ? 'Generating...' : 'Generate Writeup'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {dossierMode === 'narrative'
                    ? 'Flowing prose -- reads like a personnel file or character essay. No headers.'
                    : 'Section-based template with ## headers for each category.'}
                </p>
                {generatingDossier && (
                  <div className="text-xs text-teal-600 animate-pulse">AI is writing the character dossier...</div>
                )}
                <textarea
                  value={formData.dossier || ''}
                  onChange={(e) => setFormData({ ...formData, dossier: e.target.value })}
                  rows={24}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono text-sm leading-relaxed"
                  placeholder="Click 'Load Template' above to start with the guided template, or write freeform..."
                />
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

function EntityImage({ url, comfyEndpoint, alt, described }: { url: string; comfyEndpoint: string; alt: string; described: boolean }) {
  const [src, setSrc] = useState(() => proxyImageUrl(url, comfyEndpoint));
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleError = useCallback(async () => {
    if (failed) return;
    setFailed(true);
    const viewMatch = url.match(/\/view\?.+$/);
    if (!viewMatch) { setHidden(true); return; }
    try {
      const res = await comfyProxyGet(comfyEndpoint, viewMatch[0]);
      if (res.ok) {
        const blob = await res.blob();
        setSrc(URL.createObjectURL(blob));
      } else {
        setHidden(true);
      }
    } catch {
      setHidden(true);
    }
  }, [url, comfyEndpoint, failed]);

  if (hidden) return null;

  return (
    <>
      <div
        className="relative h-52 bg-slate-900 cursor-zoom-in group"
        onClick={() => setLightboxOpen(true)}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]" onError={handleError} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
            </svg>
          </div>
        </div>
        {described && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-1.5">
            <span className="text-xs text-white/80">AI-described</span>
          </div>
        )}
      </div>
      {lightboxOpen && (
        <ImageLightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

function EntityCard({
  entity,
  type,
  comfyEndpoint,
  onEdit,
  onDelete,
}: {
  entity: any;
  type: EntityType;
  comfyEndpoint: string;
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
  const dossierSections = type === 'characters' ? countFilledSections(entity.dossier || '') : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {entity.image_url && comfyEndpoint && (
        <EntityImage url={entity.image_url} comfyEndpoint={comfyEndpoint} alt={entity.name} described={!!entity.image_description} />
      )}
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{entity.name}</h3>
            {entity.emergent_character && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-sky-50 text-sky-700 border-sky-200">
                Emergent
              </span>
            )}
            {entity.canon_status && entity.canon_status !== 'draft' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${CANON_STATUS_COLORS[entity.canon_status] || ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${CANON_STATUS_DOT[entity.canon_status] || ''}`} />
                {CANON_STATUSES.find(s => s.key === entity.canon_status)?.label}
              </span>
            )}
          </div>
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
        {type === 'characters' && (journeyStages > 0 || sliderCount > 0 || dossierSections > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            {dossierSections > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: DOSSIER_SECTIONS.length }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < dossierSections ? 'bg-orange-500' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-500">{dossierSections}/{DOSSIER_SECTIONS.length} dossier</span>
              </div>
            )}
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
        { key: 'book_introduced', label: 'Book Introduced', type: 'text', placeholder: '1 (default — available immediately)' },
        { key: 'chapter_introduced', label: 'Chapter Introduced', type: 'text', placeholder: 'Chapter number (leave blank = available from book start)' },
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
