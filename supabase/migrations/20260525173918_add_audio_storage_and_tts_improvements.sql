/*
  # Audio Storage and TTS Improvements

  1. Changes
    - Add `speaker` column to `tts_chunks` to record which voice was used per chunk
    - Add `comfyui_filename` column to `tts_chunks` to store the raw ComfyUI output filename
    - Add `supabase_storage_path` column to `tts_chunks` for the Supabase Storage path
    - Create `audiobook-audio` storage bucket for persisting generated MP3 files
    - Add storage policies so authenticated and anonymous users can read/write

  2. Notes
    - `audio_url` will store the Supabase public URL once uploaded
    - `comfyui_filename` preserves the original filename for reference/retry
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tts_chunks' AND column_name = 'speaker'
  ) THEN
    ALTER TABLE tts_chunks ADD COLUMN speaker text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tts_chunks' AND column_name = 'comfyui_filename'
  ) THEN
    ALTER TABLE tts_chunks ADD COLUMN comfyui_filename text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tts_chunks' AND column_name = 'supabase_storage_path'
  ) THEN
    ALTER TABLE tts_chunks ADD COLUMN supabase_storage_path text DEFAULT '';
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audiobook-audio',
  'audiobook-audio',
  true,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Audiobook audio is publicly readable'
  ) THEN
    CREATE POLICY "Audiobook audio is publicly readable"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'audiobook-audio');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can upload audiobook audio'
  ) THEN
    CREATE POLICY "Anyone can upload audiobook audio"
      ON storage.objects FOR INSERT
      TO public
      WITH CHECK (bucket_id = 'audiobook-audio');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can update audiobook audio'
  ) THEN
    CREATE POLICY "Anyone can update audiobook audio"
      ON storage.objects FOR UPDATE
      TO public
      USING (bucket_id = 'audiobook-audio');
  END IF;
END $$;
