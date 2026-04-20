/*
  # Add Voice Chat, TTS, and Art Style Preset Settings

  1. Modified Tables
    - `generation_settings`
      - `comfyui_tts_workflow` (jsonb) - Custom ComfyUI workflow JSON for TTS generation
      - `comfyui_tts_speaker` (text) - Speaker/voice name for TTS workflow
      - `comfyui_tts_sample_rate` (integer) - Audio sample rate for TTS output, default 24000
      - `voice_chat_enabled` (boolean) - Whether voice chat mode is active
      - `voice_chat_voice` (text) - Browser SpeechSynthesis voice name preference
      - `voice_chat_rate` (numeric) - Speech rate for browser TTS, default 1.0
      - `voice_chat_pitch` (numeric) - Speech pitch for browser TTS, default 1.0
      - `art_style_presets` (jsonb) - Array of art style presets mapping style names to checkpoint models and prompts

  2. New Tables
    - `tts_chunks` - Stores generated TTS audio chunks for story narration
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `chapter_id` (uuid, references chapters)
      - `scene_id` (uuid, nullable, references scenes)
      - `chunk_index` (integer) - Order of the chunk within the chapter/scene
      - `text_content` (text) - The text that was converted to speech
      - `audio_url` (text) - URL/path to the generated audio file
      - `status` (text) - pending, generating, completed, error
      - `duration_seconds` (numeric, nullable) - Duration of the audio chunk
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `tts_chunks` table
    - Add anon access policies matching existing table patterns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_tts_workflow'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_tts_workflow jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_tts_speaker'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_tts_speaker text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_tts_sample_rate'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_tts_sample_rate integer DEFAULT 24000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'voice_chat_enabled'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN voice_chat_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'voice_chat_voice'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN voice_chat_voice text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'voice_chat_rate'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN voice_chat_rate numeric DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'voice_chat_pitch'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN voice_chat_pitch numeric DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'art_style_presets'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN art_style_presets jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tts_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  chapter_id uuid NOT NULL REFERENCES chapters(id),
  scene_id uuid REFERENCES scenes(id),
  chunk_index integer NOT NULL DEFAULT 0,
  text_content text NOT NULL DEFAULT '',
  audio_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  duration_seconds numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tts_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on tts_chunks"
  ON tts_chunks FOR SELECT
  TO anon
  USING (project_id IS NOT NULL);

CREATE POLICY "Allow anon insert on tts_chunks"
  ON tts_chunks FOR INSERT
  TO anon
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Allow anon update on tts_chunks"
  ON tts_chunks FOR UPDATE
  TO anon
  USING (project_id IS NOT NULL)
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Allow anon delete on tts_chunks"
  ON tts_chunks FOR DELETE
  TO anon
  USING (project_id IS NOT NULL);
