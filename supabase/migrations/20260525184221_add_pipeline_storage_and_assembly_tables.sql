/*
  # Pipeline Storage and Assembly Tables

  1. Storage buckets
    - `pipeline-images` — generated still images (PNG/JPG)
    - `pipeline-animations` — generated animation videos (MP4/WebM/GIF)
    - `pipeline-lipsync` — generated lipsync videos (MP4)
    - `pipeline-audio` — assembled chapter audio (MP3)
    - `pipeline-video` — final assembled chapter videos (MP4)

  2. New columns on pipeline_images
    - `image_storage_path` — Supabase Storage path for still image
    - `animated_storage_path` — Supabase Storage path for animation video

  3. New columns on pipeline_lipsync_chunks
    - `video_storage_path` — Supabase Storage path for lipsync video

  4. New table: pipeline_assembly
    - Tracks audio assembly (combined chapter MP3) and video assembly metadata
    - One row per pipeline_run
*/

-- ─── Storage buckets ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pipeline-images',     'pipeline-images',     true, 20971520,  ARRAY['image/png','image/jpeg','image/webp']),
  ('pipeline-animations', 'pipeline-animations', true, 104857600, ARRAY['video/mp4','video/webm','image/gif','image/webp']),
  ('pipeline-lipsync',    'pipeline-lipsync',    true, 209715200, ARRAY['video/mp4','video/webm']),
  ('pipeline-audio',      'pipeline-audio',      true, 209715200, ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/flac']),
  ('pipeline-video',      'pipeline-video',      true, 524288000, ARRAY['video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Public read for all pipeline buckets
DO $$
DECLARE
  bucket_name text;
  policy_name text;
BEGIN
  FOREACH bucket_name IN ARRAY ARRAY['pipeline-images','pipeline-animations','pipeline-lipsync','pipeline-audio','pipeline-video']
  LOOP
    policy_name := 'Public read ' || bucket_name;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR SELECT TO public USING (bucket_id = %L)',
        policy_name, bucket_name
      );
    END IF;

    policy_name := 'Public insert ' || bucket_name;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = %L)',
        policy_name, bucket_name
      );
    END IF;

    policy_name := 'Public update ' || bucket_name;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR UPDATE TO public USING (bucket_id = %L)',
        policy_name, bucket_name
      );
    END IF;
  END LOOP;
END $$;

-- ─── pipeline_images: add storage path columns ──────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_images' AND column_name = 'image_storage_path'
  ) THEN
    ALTER TABLE pipeline_images ADD COLUMN image_storage_path text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_images' AND column_name = 'animated_storage_path'
  ) THEN
    ALTER TABLE pipeline_images ADD COLUMN animated_storage_path text DEFAULT '';
  END IF;
END $$;

-- ─── pipeline_lipsync_chunks: add storage path column ───────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_lipsync_chunks' AND column_name = 'video_storage_path'
  ) THEN
    ALTER TABLE pipeline_lipsync_chunks ADD COLUMN video_storage_path text DEFAULT '';
  END IF;
END $$;

-- ─── pipeline_assembly: audio + video assembly tracking ─────────────────────

CREATE TABLE IF NOT EXISTS pipeline_assembly (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id       uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL,
  chapter_id            uuid NOT NULL,

  -- Audio assembly
  audio_status          text NOT NULL DEFAULT 'pending',
  audio_storage_path    text DEFAULT '',
  audio_url             text DEFAULT '',
  audio_duration_seconds numeric,
  audio_chunk_count     integer DEFAULT 0,

  -- Video assembly
  video_status          text NOT NULL DEFAULT 'pending',
  video_storage_path    text DEFAULT '',
  video_url             text DEFAULT '',
  video_duration_seconds numeric,
  image_count           integer DEFAULT 0,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE pipeline_assembly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pipeline_assembly"
  ON pipeline_assembly FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert pipeline_assembly"
  ON pipeline_assembly FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update pipeline_assembly"
  ON pipeline_assembly FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
