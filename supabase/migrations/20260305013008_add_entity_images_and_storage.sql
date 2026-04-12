/*
  # Add image support for all world library entities

  1. Storage
    - Create `entity-images` storage bucket for character, place, thing, and technology images
    - Allow public read access to images
    - Allow anonymous uploads (matching current app auth pattern)

  2. Modified Tables
    - `characters` - add `image_url` (text) and `image_description` (text) columns
    - `places` - add `image_url` (text) and `image_description` (text) columns
    - `things` - add `image_url` (text) and `image_description` (text) columns
    - `technologies` - add `image_url` (text) and `image_description` (text) columns

  3. Important Notes
    - `image_url` stores the Supabase Storage public URL for the uploaded image
    - `image_description` stores the AI-generated text description of the image
    - All columns are optional with empty string defaults
    - No data loss -- only adding new columns
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('entity-images', 'entity-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to entity images'
  ) THEN
    CREATE POLICY "Allow public read access to entity images"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'entity-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow uploads to entity images'
  ) THEN
    CREATE POLICY "Allow uploads to entity images"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'entity-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow updates to entity images'
  ) THEN
    CREATE POLICY "Allow updates to entity images"
      ON storage.objects FOR UPDATE
      TO anon, authenticated
      USING (bucket_id = 'entity-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow deletes from entity images'
  ) THEN
    CREATE POLICY "Allow deletes from entity images"
      ON storage.objects FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'entity-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE characters ADD COLUMN image_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'image_description'
  ) THEN
    ALTER TABLE characters ADD COLUMN image_description text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE places ADD COLUMN image_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'image_description'
  ) THEN
    ALTER TABLE places ADD COLUMN image_description text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'things' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE things ADD COLUMN image_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'things' AND column_name = 'image_description'
  ) THEN
    ALTER TABLE things ADD COLUMN image_description text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technologies' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE technologies ADD COLUMN image_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technologies' AND column_name = 'image_description'
  ) THEN
    ALTER TABLE technologies ADD COLUMN image_description text NOT NULL DEFAULT '';
  END IF;
END $$;