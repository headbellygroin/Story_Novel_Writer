import { supabase } from '../lib/supabase';

export type StorageBucket =
  | 'pipeline-images'
  | 'pipeline-animations'
  | 'pipeline-lipsync'
  | 'pipeline-audio'
  | 'pipeline-video'
  | 'audiobook-audio';

const MIME_BY_EXT: Record<string, string> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4:  'video/mp4',
  webm: 'video/webm',
  gif:  'image/gif',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  flac: 'audio/flac',
  ogg:  'audio/ogg',
};

function mimeForFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
}

/**
 * Fetch a URL (typically a ComfyUI /view URL) and upload the blob to
 * Supabase Storage. Falls back gracefully — if upload fails the caller
 * gets back the original ComfyUI URL so generation never hard-fails.
 */
export async function fetchAndUploadToStorage(
  sourceUrl: string,
  bucket: StorageBucket,
  storagePath: string
): Promise<UploadResult> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch source: ${res.status} ${sourceUrl}`);

  const blob = await res.blob();
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? '';
  const contentType = mimeForFilename(storagePath) || blob.type || MIME_BY_EXT[ext] || 'application/octet-stream';

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, blob, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed (${bucket}/${storagePath}): ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: urlData.publicUrl, storagePath };
}

/**
 * Same as fetchAndUploadToStorage but returns the original URL on failure
 * instead of throwing, so the pipeline can continue with the ComfyUI URL.
 */
export async function fetchAndUploadSafe(
  sourceUrl: string,
  bucket: StorageBucket,
  storagePath: string
): Promise<UploadResult> {
  try {
    return await fetchAndUploadToStorage(sourceUrl, bucket, storagePath);
  } catch (err) {
    console.warn(`Storage upload skipped, using source URL directly:`, err);
    return { publicUrl: sourceUrl, storagePath: '' };
  }
}

export function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && MIME_BY_EXT[ext]) return ext;
  } catch { /* ignore */ }
  // ComfyUI /view?filename=foo.mp4 — parse from query
  const filenameMatch = url.match(/[?&]filename=([^&]+)/);
  if (filenameMatch) {
    const ext = decodeURIComponent(filenameMatch[1]).split('.').pop()?.toLowerCase();
    if (ext && MIME_BY_EXT[ext]) return ext;
  }
  return 'bin';
}
