/*
  # Add Text-to-Image Generation Config

  Adds user-configurable image generation fields to generation_settings for the
  NetaYume Lumina workflow. These replace the old free-form image settings that
  were previously editable field-by-field.

  1. New Columns
    - `image_orientation` (text) — 'portrait' | 'landscape' | 'square', default 'portrait'
    - `image_noise_mode` (text) — 'random' | 'fixed', default 'random'
    - `image_noise_seed` (bigint) — fixed seed value when mode is 'fixed', default 42
    - `image_background_prompt` (text) — background setting description
    - `image_foreground_prompt` (text) — foreground elements description
    - `image_characters_prompt` (text) — character appearance description

  2. Notes
    - batch_size of 4 is the user-facing default; Story Forge uses 1 for automated generation
    - Width/height are derived from orientation at generation time
    - All fields have safe defaults so existing rows continue to work
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_orientation'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_orientation text DEFAULT 'portrait';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_noise_mode'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_noise_mode text DEFAULT 'random';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_noise_seed'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_noise_seed bigint DEFAULT 42;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_background_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_background_prompt text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_foreground_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_foreground_prompt text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_characters_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_characters_prompt text DEFAULT '';
  END IF;
END $$;
