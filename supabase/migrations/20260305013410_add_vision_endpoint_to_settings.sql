/*
  # Add vision API endpoint to generation settings

  1. Modified Tables
    - `generation_settings`
      - `vision_api_endpoint` (text) - Endpoint for vision-capable LLM API (OpenAI-compatible chat completions format)
      - `vision_api_key` (text) - Optional API key for the vision endpoint

  2. Important Notes
    - Defaults to empty string (will fall back to main API endpoint in the app)
    - No data loss -- only adding new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'vision_api_endpoint'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN vision_api_endpoint text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'vision_api_key'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN vision_api_key text NOT NULL DEFAULT '';
  END IF;
END $$;