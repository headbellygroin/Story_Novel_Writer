import { supabase } from '../lib/supabase';

const TEXT_TABLES = [
  'outlines',
  'chapters',
  'scenes',
  'characters',
  'places',
  'things',
  'technologies',
  'story_events',
  'character_states',
  'scene_references',
  'scene_summaries',
  'story_bible_entries',
  'style_anchors',
  'scene_context_tags',
  'story_dossiers',
  'scene_briefs',
  'editing_passes',
  'logic_checks',
  'prohibited_words',
  'generation_settings',
] as const;

const IMAGE_FIELDS = [
  'image_url',
  'image_description',
  'generated_image_url',
  'image_prompt',
  'comfyui_endpoint',
  'comfyui_workflow',
  'comfyui_checkpoint',
  'image_width',
  'image_height',
  'image_steps',
  'image_cfg_scale',
  'image_sampler',
  'image_negative_prompt',
  'vision_api_endpoint',
  'vision_api_key',
  'vision_model_name',
  'use_ollama_vision',
  'ollama_endpoint',
  'ollama_vision_model',
];

export interface ProjectBackup {
  version: number;
  exported_at: string;
  project: {
    title: string;
    description: string;
    genre: string;
  };
  tables: Record<string, Record<string, unknown>[]>;
}

function stripImageFields(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...row };
  for (const field of IMAGE_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}

export async function exportProject(projectId: string): Promise<ProjectBackup> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error('Could not load project');
  }

  const backup: ProjectBackup = {
    version: 1,
    exported_at: new Date().toISOString(),
    project: {
      title: project.title,
      description: project.description,
      genre: project.genre,
    },
    tables: {},
  };

  for (const table of TEXT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      continue;
    }

    if (data && data.length > 0) {
      backup.tables[table] = data.map((row) => stripImageFields(row as Record<string, unknown>));
    }
  }

  return backup;
}

export function downloadBackup(backup: ProjectBackup) {
  const filename = `${backup.project.title.replace(/[^a-zA-Z0-9]/g, '_')}_backup_${
    new Date().toISOString().split('T')[0]
  }.json`;

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBackupFile(file: File): Promise<ProjectBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.version || !data.project || !data.tables) {
          reject(new Error('Invalid backup file format'));
          return;
        }
        resolve(data as ProjectBackup);
      } catch {
        reject(new Error('Could not parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

const TABLE_LOAD_ORDER = [
  'generation_settings',
  'prohibited_words',
  'outlines',
  'characters',
  'places',
  'things',
  'technologies',
  'chapters',
  'scenes',
  'story_events',
  'character_states',
  'scene_references',
  'scene_summaries',
  'story_bible_entries',
  'style_anchors',
  'scene_context_tags',
  'story_dossiers',
  'scene_briefs',
  'editing_passes',
  'logic_checks',
] as const;

interface IdMapping {
  [oldId: string]: string;
}

const FK_FIELDS: Record<string, string[]> = {
  chapters: ['outline_id', 'pov_character_id', 'setting_place_id'],
  scenes: ['chapter_id'],
  story_events: ['scene_id', 'chapter_id'],
  character_states: ['character_id', 'scene_id'],
  scene_references: ['scene_id'],
  scene_summaries: ['scene_id'],
  story_bible_entries: ['source_scene_id'],
  scene_context_tags: ['scene_id', 'entity_id'],
  scene_briefs: ['chapter_id'],
  editing_passes: ['scene_id'],
  logic_checks: ['target_id'],
};

function remapIds(
  row: Record<string, unknown>,
  table: string,
  idMap: IdMapping,
): Record<string, unknown> {
  const mapped = { ...row };

  delete mapped.id;
  delete mapped.created_at;
  delete mapped.updated_at;

  const fkFields = FK_FIELDS[table] || [];
  for (const field of fkFields) {
    const oldVal = mapped[field];
    if (oldVal && typeof oldVal === 'string' && idMap[oldVal]) {
      mapped[field] = idMap[oldVal];
    }
  }

  if (Array.isArray(mapped.affects_characters)) {
    mapped.affects_characters = (mapped.affects_characters as string[]).map(
      (id) => idMap[id] || id
    );
  }

  if (Array.isArray(mapped.characters_involved)) {
    mapped.characters_involved = (mapped.characters_involved as string[]).map(
      (id) => idMap[id] || id
    );
  }

  return mapped;
}

export type ImportProgress = {
  table: string;
  done: number;
  total: number;
};

export async function importProject(
  backup: ProjectBackup,
  onProgress?: (progress: ImportProgress) => void,
): Promise<string> {
  const { data: newProject, error: projectError } = await supabase
    .from('projects')
    .insert([{
      title: backup.project.title,
      description: backup.project.description || '',
      genre: backup.project.genre || '',
    }])
    .select()
    .single();

  if (projectError || !newProject) {
    throw new Error('Failed to create project: ' + (projectError?.message || 'unknown error'));
  }

  const newProjectId = newProject.id;
  const idMap: IdMapping = {};

  for (const table of TABLE_LOAD_ORDER) {
    const rows = backup.tables[table];
    if (!rows || rows.length === 0) continue;

    onProgress?.({ table, done: 0, total: rows.length });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const oldId = row.id as string;

      const mapped = remapIds(row, table, idMap);
      mapped.project_id = newProjectId;

      const { data: inserted, error } = await supabase
        .from(table)
        .insert([mapped])
        .select()
        .single();

      if (error) {
        console.error(`Error importing ${table} row:`, error, mapped);
        continue;
      }

      if (inserted && oldId) {
        idMap[oldId] = inserted.id;
      }

      onProgress?.({ table, done: i + 1, total: rows.length });
    }
  }

  return newProjectId;
}
