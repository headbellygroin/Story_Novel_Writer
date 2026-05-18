/*
  # Add Lip-sync Generation Config

  Adds user-configurable lipsync generation fields to generation_settings:

  1. New Columns
    - `lipsync_orientation` (text) — 'portrait' | 'landscape' | 'square', default 'portrait'
    - `lipsync_noise_mode` (text) — 'random' | 'fixed', default 'random'
    - `lipsync_noise_seed` (bigint) — fixed seed value when mode is 'fixed', default 42
    - `lipsync_background_prompt` (text) — background setting description
    - `lipsync_character_prompt` (text) — character appearance description

  2. Notes
    - All fields have safe defaults so existing rows continue to work
    - Width/height are derived from orientation at generation time, not stored separately
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'lipsync_orientation'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN lipsync_orientation text DEFAULT 'portrait';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'lipsync_noise_mode'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN lipsync_noise_mode text DEFAULT 'random';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'lipsync_noise_seed'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN lipsync_noise_seed bigint DEFAULT 42;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'lipsync_background_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN lipsync_background_prompt text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'lipsync_character_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN lipsync_character_prompt text DEFAULT '';
  END IF;
END $$;
