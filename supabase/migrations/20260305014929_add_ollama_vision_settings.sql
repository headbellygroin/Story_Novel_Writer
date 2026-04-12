/*
  # Add Ollama Vision Settings

  1. Modified Tables
    - `generation_settings`
      - `use_ollama_vision` (boolean, default false) - Toggle to use local Ollama for image analysis
      - `ollama_endpoint` (text, default 'http://localhost:11434') - Local Ollama server URL
      - `ollama_vision_model` (text, default 'llava:7b') - Which Ollama vision model to use

  2. Notes
    - When use_ollama_vision is true, the app calls Ollama directly from the browser
    - No API key needed for local Ollama
    - Default endpoint is standard Ollama port
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'use_ollama_vision'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN use_ollama_vision boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'ollama_endpoint'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN ollama_endpoint text DEFAULT 'http://localhost:11434';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'ollama_vision_model'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN ollama_vision_model text DEFAULT 'llava:7b';
  END IF;
END $$;