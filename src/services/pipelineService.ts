import { supabase } from '../lib/supabase';
import { GenerationSettings } from './aiService';
import { analyzeChapterForVisuals, VisualMoment } from './sceneAnalysisService';
import { generateImage, ComfyUISettings } from './comfyuiService';
import { animateImage, ComfyUIAnimationSettings } from './comfyuiAnimationService';
import { ComfyUITtsSettings } from './comfyuiTtsService';
import { generateLipsync, ComfyUILipsyncSettings } from './comfyuiLipsyncService';
import { chunkChapter, ChapterForAudiobook, generateChunkAudio, assembleChapterAudio } from './audiobookService';
import { fetchAndUploadSafe, extFromUrl } from './storageService';

export type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'generating_images'
  | 'images_review'
  | 'animating'
  | 'animation_review'
  | 'generating_tts'
  | 'tts_review'
  | 'assembling_audio'
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

// ─── Stage 1a: Analysis ──────────────────────────────────────────────────────

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
  if (!chapterText.trim()) throw new Error('Chapter has no content to analyze.');

  const moments = await analyzeChapterForVisuals(chapterText, genre, settings);
  if (moments.length === 0) throw new Error('LLM found no visual moments in this chapter. Try again or check the chapter content.');

  await supabase.from('pipeline_images').delete().eq('pipeline_run_id', runId);

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

// ─── Stage 1b: Image generation ─────────────────────────────────────────────

export async function runImageGenerationStage(
  runId: string,
  projectId: string,
  chapterId: string,
  comfySettings: ComfyUISettings,
  onProgress?: ProgressCallback
): Promise<void> {
  await updatePipelineRun(runId, { current_stage: 'generating_images', status: 'running' });

  const { data: images } = await supabase
    .from('pipeline_images')
    .select('*')
    .eq('pipeline_run_id', runId)
    .order('order_index');

  if (!images || images.length === 0) throw new Error('No images to generate. Run analysis first.');

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.status === 'generated' || img.status === 'animated') continue;

    onProgress?.({
      stage: 'generating_images',
      current: i + 1,
      total: images.length,
      message: `Generating image ${i + 1} of ${images.length}...`,
    });

    await supabase.from('pipeline_images').update({ status: 'generating' }).eq('id', img.id);

    try {
      const result = await generateImage(img.image_prompt, comfySettings);

      // Upload still image to Supabase Storage
      const ext = result.filename.split('.').pop() || 'png';
      const storagePath = `${projectId}/${chapterId}/${runId}/img_${String(i).padStart(3, '0')}.${ext}`;
      const { publicUrl, storagePath: savedPath } = await fetchAndUploadSafe(
        result.comfyUrl,
        'pipeline-images',
        storagePath
      );

      await supabase.from('pipeline_images').update({
        image_url: publicUrl,
        image_storage_path: savedPath,
        status: 'generated',
      }).eq('id', img.id);
    } catch (err) {
      await supabase.from('pipeline_images').update({ status: 'error' }).eq('id', img.id);
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

// ─── Stage 2: Animation ──────────────────────────────────────────────────────

export async function runAnimationStage(
  runId: string,
  projectId: string,
  chapterId: string,
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

  if (!images || images.length === 0) throw new Error('No generated images to animate.');

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    onProgress?.({
      stage: 'animating',
      current: i + 1,
      total: images.length,
      message: `Animating image ${i + 1} of ${images.length}...`,
    });

    await supabase.from('pipeline_images').update({ status: 'animating' }).eq('id', img.id);

    try {
      const result = await animateImage(img.image_url, img.animation_prompt, animSettings);

      const ext = result.filename.split('.').pop() || 'mp4';
      const storagePath = `${projectId}/${chapterId}/${runId}/anim_${String(i).padStart(3, '0')}.${ext}`;
      const { publicUrl, storagePath: savedPath } = await fetchAndUploadSafe(
        result.comfyUrl,
        'pipeline-animations',
        storagePath
      );

      await supabase.from('pipeline_images').update({
        animated_url: publicUrl,
        animated_storage_path: savedPath,
        status: 'animated',
      }).eq('id', img.id);
    } catch (err) {
      await supabase.from('pipeline_images').update({ status: 'error' }).eq('id', img.id);
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

// ─── Stage 3: TTS generation ─────────────────────────────────────────────────

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

  if (!scenes || scenes.length === 0) throw new Error('No scenes with content found.');

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

    // Skip already-completed chunks
    const { data: existing } = await supabase
      .from('tts_chunks')
      .select('status')
      .eq('project_id', projectId)
      .eq('chapter_id', chapterId)
      .eq('chunk_index', chunk.index)
      .maybeSingle();

    if (existing?.status === 'completed') continue;

    onProgress?.({
      stage: 'generating_tts',
      current: i + 1,
      total: chunks.length,
      message: `Generating TTS chunk ${i + 1} of ${chunks.length}...`,
    });

    try {
      const result = await generateChunkAudio(
        chunk,
        ttsSettings,
        projectId,
        chapterId,
        (_idx, status) => {
          if (status === 'uploading') {
            onProgress?.({
              stage: 'generating_tts',
              current: i + 1,
              total: chunks.length,
              message: `Uploading chunk ${i + 1} of ${chunks.length}...`,
            });
          }
        }
      );

      await supabase.from('tts_chunks').upsert(
        {
          project_id: projectId,
          chapter_id: chapterId,
          scene_id: chunk.sceneId || null,
          chunk_index: chunk.index,
          text_content: chunk.text,
          audio_url: result.audioUrl,
          supabase_storage_path: result.storagePath,
          comfyui_filename: result.comfyuiFilename,
          speaker: ttsSettings.speaker,
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

// ─── Stage 4: Audio assembly ─────────────────────────────────────────────────

export async function runAudioAssemblyStage(
  runId: string,
  projectId: string,
  chapterId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  await updatePipelineRun(runId, { current_stage: 'assembling_audio', status: 'running' });

  const { data: ttsChunks } = await supabase
    .from('tts_chunks')
    .select('chunk_index, audio_url')
    .eq('project_id', projectId)
    .eq('chapter_id', chapterId)
    .eq('status', 'completed')
    .order('chunk_index');

  if (!ttsChunks || ttsChunks.length === 0) throw new Error('No completed TTS chunks to assemble.');

  const { data: chapterData } = await supabase
    .from('chapters')
    .select('order_index')
    .eq('id', chapterId)
    .maybeSingle();

  const chapterOrderIndex = chapterData?.order_index ?? 0;
  const audioUrls = ttsChunks.map((c) => c.audio_url).filter(Boolean) as string[];

  onProgress?.({ stage: 'assembling_audio', current: 0, total: audioUrls.length, message: 'Assembling chapter audio...' });

  const assemblyResult = await assembleChapterAudio(
    audioUrls,
    projectId,
    chapterId,
    chapterOrderIndex,
    (current, total) => onProgress?.({
      stage: 'assembling_audio',
      current,
      total,
      message: `Decoding chunk ${current} of ${total}...`,
    })
  );

  // Upsert assembly record
  const { data: existingAssembly } = await supabase
    .from('pipeline_assembly')
    .select('id')
    .eq('pipeline_run_id', runId)
    .maybeSingle();

  if (existingAssembly) {
    await supabase.from('pipeline_assembly').update({
      audio_status: 'completed',
      audio_storage_path: assemblyResult.storagePath,
      audio_url: assemblyResult.audioUrl,
      audio_duration_seconds: assemblyResult.durationSeconds,
      audio_chunk_count: assemblyResult.chunkCount,
      updated_at: new Date().toISOString(),
    }).eq('id', existingAssembly.id);
  } else {
    await supabase.from('pipeline_assembly').insert({
      pipeline_run_id: runId,
      project_id: projectId,
      chapter_id: chapterId,
      audio_status: 'completed',
      audio_storage_path: assemblyResult.storagePath,
      audio_url: assemblyResult.audioUrl,
      audio_duration_seconds: assemblyResult.durationSeconds,
      audio_chunk_count: assemblyResult.chunkCount,
    });
  }

  await updatePipelineRun(runId, { current_stage: 'assembling_video', status: 'paused' });
  onProgress?.({
    stage: 'assembling_audio',
    current: audioUrls.length,
    total: audioUrls.length,
    message: `Chapter audio assembled (${Math.round(assemblyResult.durationSeconds)}s). Ready for video assembly.`,
  });
}

// ─── Stage 5: Video assembly data ────────────────────────────────────────────
// Builds the timeline manifest and records it in pipeline_assembly.
// Actual video encoding is done client-side or via a future edge function.

export interface VideoAssemblyManifest {
  chapterLabel: string;
  audioUrl: string;
  audioDurationSeconds: number;
  images: Array<{
    index: number;
    textAnchor: string;
    mediaUrl: string;
    isAnimated: boolean;
    storagePath: string;
  }>;
}

export async function buildVideoAssemblyManifest(
  runId: string,
  _projectId: string,
  _chapterId: string,
  chapterOrderIndex: number
): Promise<VideoAssemblyManifest> {
  const [imagesRes, assemblyRes] = await Promise.all([
    supabase
      .from('pipeline_images')
      .select('*')
      .eq('pipeline_run_id', runId)
      .order('order_index'),
    supabase
      .from('pipeline_assembly')
      .select('*')
      .eq('pipeline_run_id', runId)
      .maybeSingle(),
  ]);

  const images = imagesRes.data || [];
  const assembly = assemblyRes.data;

  const chIdx = String(chapterOrderIndex + 1).padStart(2, '0');

  return {
    chapterLabel: `Chapter ${chIdx}`,
    audioUrl: assembly?.audio_url || '',
    audioDurationSeconds: assembly?.audio_duration_seconds ?? 0,
    images: images.map((img, i) => ({
      index: i,
      textAnchor: img.text_anchor || '',
      mediaUrl: img.animated_url || img.image_url || '',
      isAnimated: !!img.animated_url,
      storagePath: img.animated_storage_path || img.image_storage_path || '',
    })),
  };
}

// ─── Stage 6: Lipsync ────────────────────────────────────────────────────────

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

  if (!ttsChunks || ttsChunks.length === 0) throw new Error('No completed TTS chunks found. Generate TTS first.');

  await supabase.from('pipeline_lipsync_chunks').delete().eq('pipeline_run_id', runId);

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
      const result = await generateLipsync(lipsyncImageUrl, chunk.audio_url, lipsyncSettings, chunk.text_content ?? '');

      // Upload lipsync video to Supabase Storage
      const ext = extFromUrl(result.comfyUrl) || 'mp4';
      const storagePath = `${projectId}/${chapterId}/${runId}/lipsync_${chunkIdx}.${ext}`;
      const { publicUrl, storagePath: savedPath } = await fetchAndUploadSafe(
        result.comfyUrl,
        'pipeline-lipsync',
        storagePath
      );

      await supabase.from('pipeline_lipsync_chunks').insert({
        pipeline_run_id: runId,
        project_id: projectId,
        chapter_id: chapterId,
        chunk_index: i,
        tts_audio_url: chunk.audio_url,
        video_url: publicUrl,
        video_storage_path: savedPath,
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

  await updatePipelineRun(runId, {
    current_stage: 'lipsync_complete',
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  onProgress?.({
    stage: 'generating_lipsync',
    current: ttsChunks.length,
    total: ttsChunks.length,
    message: 'All lip-sync chunks generated.',
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
