/*
  # Add vision_model_name to generation_settings

  1. Modified Tables
    - `generation_settings`
      - Added `vision_model_name` (text) - stores the model identifier for vision analysis (e.g. "llava")
      - Defaults to 'llava'

  2. Notes
    - This column allows users to specify which model LM Studio should use for image analysis
    - The old ollama-specific columns are left in place to avoid data loss
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'vision_model_name'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN vision_model_name text NOT NULL DEFAULT 'llava';
  END IF;
END $$;
