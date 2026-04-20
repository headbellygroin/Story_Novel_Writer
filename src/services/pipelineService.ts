import { supabase } from '../lib/supabase';
import { GenerationSettings } from './aiService';
import { analyzeChapterForVisuals, VisualMoment } from './sceneAnalysisService';
import { generateImage, ComfyUISettings } from './comfyuiService';
import { animateImage, ComfyUIAnimationSettings } from './comfyuiAnimationService';
import { generateTtsAudio, ComfyUITtsSettings } from './comfyuiTtsService';
import { generateLipsync, ComfyUILipsyncSettings } from './comfyuiLipsyncService';
import { chunkChapter, ChapterForAudiobook } from './audiobookService';

export type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'generating_images'
  | 'images_review'
  | 'animating'
  | 'animation_review'
  | 'generating_tts'
  | 'tts_review'
  | 'assembling_video'
  | 'video_review'
  | 'generating_lipsync'
  | 'lipsync_complete';

export type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface PipelineProgress {
  stage: PipelineStage;
  current: number;
  total: number;
  message: string;
}

type ProgressCallback = (progress: PipelineProgress) => void;

export async function getChapterText(chapterId: string): Promise<string> {
  const { data: scenes } = await supabase
    .from('scenes')
    .select('content, order_index')
    .eq('chapter_id', chapterId)
    .order('order_index');

  if (!scenes || scenes.length === 0) return '';
  return scenes
    .filter((s) => s.content && s.content.trim())
    .map((s) => s.content)
    .join('\n\n');
}

export async function runAnalysisStage(
  runId: string,
  projectId: string,
  chapterId: string,
  genre: string,
  settings: GenerationSettings,
  onProgress?: ProgressCallback
): Promise<VisualMoment[]> {
  await updatePipelineRun(runId, { current_stage: 'analyzing', status: 'running', started_at: new Date().toISOString() });
  onProgress?.({ stage: 'analyzing', current: 0, total: 1, message: 'Analyzing chapter for visual moments...' });

  const chapterText = await getChapterText(chapterId);
  if (!chapterText.trim()) {
    throw new Error('Chapter has no content to analyze.');
  }

  const moments = await analyzeChapterForVisuals(chapterText, genre, settings);

  if (moments.length === 0) {
    throw new Error('LLM found no visual moments in this chapter. Try again or check the chapter content.');
  }

  await supabase
    .from('pipeline_images')
    .delete()
    .eq('pipeline_run_id', runId);

  const inserts = moments.map((m, i) => ({
    pipeline_run_id: runId,
    project_id: projectId,
    chapter_id: chapterId,
    order_index: i,
    text_anchor: m.textAnchor,
    image_prompt: m.imagePrompt,
    animation_prompt: m.animationPrompt,
    status: 'pending',
  }));

  await supabase.from('pipeline_images').insert(inserts);

  await updatePipelineRun(runId, { current_stage: 'generating_images', status: 'running' });
  onProgress?.({ stage: 'analyzing', current: 1, total: 1, message: `Found ${moments.length} visual moments.` });

  return moments;
}

export async function runImageGenerationStage(
  runId: string,
  comfySettings: ComfyUISettings,
  onProgress?: ProgressCallback
): Promise<void> {
  await updatePipelineRun(runId, { current_stage: 'generating_images', status: 'running' });

  const { data: images } = await supabase
    .from('pipeline_images')
    .select('*')
    .eq('pipeline_run_id', runId)
    .order('order_index');

  if (!images || images.length === 0) {
    throw new Error('No images to generate. Run analysis first.');
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.status === 'generated' || img.status === 'animated') continue;

    onProgress?.({
      stage: 'generating_images',
      current: i + 1,
      total: images.length,
      message: `Generating image ${i + 1} of ${images.length}...`,
    });

    await supabase
      .from('pipeline_images')
      .update({ status: 'generating' })
      .eq('id', img.id);

    try {
      const imageUrl = await generateImage(img.image_prompt, comfySettings);
      await supabase
        .from('pipeline_images')
        .update({ image_url: imageUrl, status: 'generated' })
        .eq('id', img.id);
    } catch (err) {
      await supabase
        .from('pipeline_images')
        .update({ status: 'error' })
        .eq('id', img.id);
      throw err;
    }
  }

  await updatePipelineRun(runId, { current_stage: 'images_review', status: 'paused' });
  onProgress?.({
    stage: 'generating_images',
    current: images.length,
    total: images.length,
    message: 'All images generated. Ready for review.',
  });
}

export async function runAnimationStage(
  runId: string,
  animSettings: ComfyUIAnimationSettings,
  onProgress?: ProgressCallback
): Promise<void> {
  await updatePipelineRun(runId, { current_stage: 'animating', status: 'running' });

  const { data: images } = await supabase
    .from('pipeline_images')
    .select('*')
    .eq('pipeline_run_id', runId)
    .in('status', ['generated'])
    .order('order_index');

  if (!images || images.length === 0) {
    throw new Error('No generated images to animate.');
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    onProgress?.({
      stage: 'animating',
      current: i + 1,
      total: images.length,
      message: `Animating image ${i + 1} of ${images.length}...`,
    });

    await supabase
      .from('pipeline_images')
      .update({ status: 'animating' })
      .eq('id', img.id);

    try {
      const animatedUrl = await animateImage(img.image_url, img.animation_prompt, animSettings);
      await supabase
        .from('pipeline_images')
        .update({ animated_url: animatedUrl, status: 'animated' })
        .eq('id', img.id);
    } catch (err) {
      await supabase
        .from('pipeline_images')
        .update({ status: 'error' })
        .eq('id', img.id);
      throw err;
    }
  }

  await updatePipelineRun(runId, { current_stage: 'animation_review', status: 'paused' });
  onProgress?.({
    stage: 'animating',
    current: images.length,
    total: images.length,
    message: 'All animations complete. Ready for review.',
  });
}

export async function runTtsStage(
  runId: string,
  projectId: string,
  chapterId: string,
  ttsSettings: ComfyUITtsSettings,
  onProgress?: ProgressCallback
): Promise<void> {
  await updatePipelineRun(runId, { current_stage: 'generating_tts', status: 'running' });

  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, title, content, order_index')
    .eq('chapter_id', chapterId)
    .order('order_index');

  if (!scenes || scenes.length === 0) {
    throw new Error('No scenes with content found.');
  }

  const { data: chapterData } = await supabase
    .from('chapters')
    .select('id, title, order_index')
    .eq('id', chapterId)
    .maybeSingle();

  if (!chapterData) throw new Error('Chapter not found.');

  const chapter: ChapterForAudiobook = {
    id: chapterData.id,
    title: chapterData.title,
    orderIndex: chapterData.order_index,
    scenes: scenes.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content || '',
      orderIndex: s.order_index,
    })),
  };

  const chunks = chunkChapter(chapter);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    onProgress?.({
      stage: 'generating_tts',
      current: i + 1,
      total: chunks.length,
      message: `Generating TTS chunk ${i + 1} of ${chunks.length}...`,
    });

    try {
      const audioUrl = await generateTtsAudio(chunk.text, ttsSettings);

      await supabase.from('tts_chunks').upsert(
        {
          project_id: projectId,
          chapter_id: chapterId,
          scene_id: chunk.sceneId || null,
          chunk_index: chunk.index,
          text_content: chunk.text,
          audio_url: audioUrl,
          status: 'completed',
        },
        { onConflict: 'project_id,chapter_id,chunk_index', ignoreDuplicates: false }
      );
    } catch (err) {
      await supabase.from('tts_chunks').upsert(
        {
          project_id: projectId,
          chapter_id: chapterId,
          chunk_index: chunk.index,
          text_content: chunk.text,
          status: 'error',
        },
        { onConflict: 'project_id,chapter_id,chunk_index', ignoreDuplicates: false }
      );
      throw err;
    }
  }

  await updatePipelineRun(runId, { current_stage: 'tts_review', status: 'paused' });
  onProgress?.({
    stage: 'generating_tts',
    current: chunks.length,
    total: chunks.length,
    message: 'TTS generation complete. Ready for review.',
  });
}

export async function runLipsyncStage(
  runId: string,
  projectId: string,
  chapterId: string,
  lipsyncImageUrl: string,
  lipsyncSettings: ComfyUILipsyncSettings,
  chapterOrderIndex: number,
  onProgress?: ProgressCallback
): Promise<void> {
  await updatePipelineRun(runId, {
    current_stage: 'generating_lipsync',
    status: 'running',
    lipsync_image_url: lipsyncImageUrl,
  });

  const { data: ttsChunks } = await supabase
    .from('tts_chunks')
    .select('*')
    .eq('project_id', projectId)
    .eq('chapter_id', chapterId)
    .eq('status', 'completed')
    .order('chunk_index');

  if (!ttsChunks || ttsChunks.length === 0) {
    throw new Error('No completed TTS chunks found. Generate TTS first.');
  }

  await supabase
    .from('pipeline_lipsync_chunks')
    .delete()
    .eq('pipeline_run_id', runId);

  const chIdx = String(chapterOrderIndex + 1).padStart(2, '0');

  for (let i = 0; i < ttsChunks.length; i++) {
    const chunk = ttsChunks[i];
    const chunkIdx = String(i + 1).padStart(3, '0');
    const filename = `ch${chIdx}_lipsync_${chunkIdx}.mp4`;

    onProgress?.({
      stage: 'generating_lipsync',
      current: i + 1,
      total: ttsChunks.length,
      message: `Generating lip-sync ${i + 1} of ${ttsChunks.length} (${filename})...`,
    });

    try {
      const videoUrl = await generateLipsync(lipsyncImageUrl, chunk.audio_url, lipsyncSettings);

      await supabase.from('pipeline_lipsync_chunks').insert({
        pipeline_run_id: runId,
        project_id: projectId,
        chapter_id: chapterId,
        chunk_index: i,
        tts_audio_url: chunk.audio_url,
        video_url: videoUrl,
        filename,
        status: 'completed',
      });
    } catch (err) {
      await supabase.from('pipeline_lipsync_chunks').insert({
        pipeline_run_id: runId,
        project_id: projectId,
        chapter_id: chapterId,
        chunk_index: i,
        tts_audio_url: chunk.audio_url,
        filename,
        status: 'error',
      });
      throw err;
    }
  }

  await updatePipelineRun(runId, { current_stage: 'lipsync_complete', status: 'completed', completed_at: new Date().toISOString() });
  onProgress?.({
    stage: 'generating_lipsync',
    current: ttsChunks.length,
    total: ttsChunks.length,
    message: 'All lip-sync chunks generated.',
  });
}

export function buildVideoAssemblyData(
  images: Array<{ order_index: number; text_anchor: string; animated_url: string; image_url: string }>,
  ttsChunks: Array<{ chunk_index: number; text_content: string; audio_url: string }>,
  chapterOrderIndex: number
) {
  const chIdx = String(chapterOrderIndex + 1).padStart(2, '0');

  const imageTimeline = images.map((img, i) => ({
    index: i,
    textAnchor: img.text_anchor,
    mediaUrl: img.animated_url || img.image_url,
    isAnimated: !!img.animated_url,
  }));

  const audioTimeline = ttsChunks.map((chunk) => ({
    index: chunk.chunk_index,
    text: chunk.text_content,
    audioUrl: chunk.audio_url,
  }));

  return {
    chapterLabel: `Chapter ${chIdx}`,
    images: imageTimeline,
    audio: audioTimeline,
  };
}

async function updatePipelineRun(runId: string, updates: Record<string, unknown>) {
  await supabase
    .from('pipeline_runs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', runId);
}

export async function createPipelineRun(projectId: string, chapterId: string): Promise<string> {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({ project_id: projectId, chapter_id: chapterId })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function setPipelineError(runId: string, message: string) {
  await updatePipelineRun(runId, { status: 'error', error_message: message });
}
