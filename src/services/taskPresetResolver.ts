import { supabase } from '../lib/supabase';
import { GenerationSettings } from './aiService';

export type PipelineTaskMode =
  | 'series_architect'
  | 'book_architect'
  | 'chapter_brief'
  | 'scene_blueprint'
  | 'scene_writer'
  | 'assembly';

export async function resolveSettingsForTask(
  projectId: string,
  taskMode: PipelineTaskMode,
  globalSettings: GenerationSettings,
): Promise<GenerationSettings> {
  const { data: preset } = await supabase
    .from('model_presets')
    .select('*')
    .eq('project_id', projectId)
    .eq('task_mode', taskMode)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!preset) return globalSettings;

  return {
    ...globalSettings,
    model_name: preset.model_name || globalSettings.model_name,
    api_endpoint: preset.api_endpoint || globalSettings.api_endpoint,
    context_length: preset.context_length || globalSettings.context_length,
    max_tokens: preset.max_tokens,
    temperature: preset.temperature,
    top_p: preset.top_p ?? globalSettings.top_p,
    top_k: preset.top_k ?? globalSettings.top_k,
    repetition_penalty: preset.repetition_penalty ?? globalSettings.repetition_penalty,
    presence_penalty: preset.presence_penalty ?? globalSettings.presence_penalty,
    frequency_penalty: preset.frequency_penalty ?? globalSettings.frequency_penalty,
  };
}

export function logTaskSettings(taskMode: PipelineTaskMode, settings: GenerationSettings): string {
  return `[Generation] Task: ${taskMode} | Model: ${settings.model_name} | Max Tokens: ${settings.max_tokens} | Temp: ${settings.temperature}`;
}
