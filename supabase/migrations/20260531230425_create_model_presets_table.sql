/*
  # Create model presets table for auto-routing

  1. New Tables
    - `model_presets`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `task_mode` (text) - the generation task this preset applies to
      - `label` (text) - human-readable name for the preset
      - `model_name` (text) - LM Studio model identifier
      - `api_endpoint` (text) - endpoint URL (allows different endpoints per model)
      - `context_length` (integer) - context window size
      - `max_tokens` (integer) - max generation tokens
      - `temperature` (numeric) - sampling temperature
      - `top_p` (numeric, nullable)
      - `top_k` (integer, nullable)
      - `repetition_penalty` (numeric, nullable)
      - `presence_penalty` (numeric, nullable)
      - `frequency_penalty` (numeric, nullable)
      - `is_active` (boolean) - whether this preset is enabled for auto-routing
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Task Modes
    - design_brief: Design Briefs, Context Tag Recommendations, Lore Audits
    - outline: Book/Chapter/Scene Outlines
    - scene: Scene Generation, Chapter Writing
    - rewrite: Editing passes, rewrites
    - brainstorm: Quick creative generation (NPC names, locations, songs)
    - vision: Image analysis
    - utility: Summaries, metadata, JSON generation

  3. Security
    - Enable RLS on `model_presets` table
    - Add policies for anon access (matching existing pattern)

  4. Notes
    - Each project can have one active preset per task_mode
    - The generation system checks for a matching preset before using default settings
    - If no preset exists for a mode, falls back to the project's default generation_settings
*/

CREATE TABLE IF NOT EXISTS model_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_mode text NOT NULL,
  label text NOT NULL DEFAULT '',
  model_name text NOT NULL DEFAULT '',
  api_endpoint text NOT NULL DEFAULT '',
  context_length integer NOT NULL DEFAULT 4096,
  max_tokens integer NOT NULL DEFAULT 1200,
  temperature numeric NOT NULL DEFAULT 0.6,
  top_p numeric,
  top_k integer,
  repetition_penalty numeric,
  presence_penalty numeric,
  frequency_penalty numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_presets_project_mode ON model_presets(project_id, task_mode);

ALTER TABLE model_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on model_presets"
  ON model_presets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on model_presets"
  ON model_presets FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on model_presets"
  ON model_presets FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on model_presets"
  ON model_presets FOR DELETE
  TO anon
  USING (true);
