/*
  # Production Pipeline Tables

  Adds tables to track the automated production pipeline that converts
  finished chapters into YouTube litRPG videos and lip-sync content.

  ## Pipeline stages (sequential, one at a time):
  1. Image Generation - LLM analyzes chapter, identifies visual moments, generates images
  2. Image Animation - Animate each generated image with subtle motion via ComfyUI
  3. TTS Generation - Convert chapter text to audio via ComfyUI TTS workflow
  4. Video Assembly - Combine animated images + TTS into a single video file
  5. Lip-sync Generation - Generate lip-sync video chunks from character image + TTS audio

  ## New Tables

  1. `pipeline_runs` - Tracks each pipeline execution for a chapter
    - `id` (uuid, primary key)
    - `project_id` (FK to projects)
    - `chapter_id` (FK to chapters)
    - `current_stage` (text) - which stage the pipeline is at
    - `status` (text) - idle/running/paused/completed/error
    - `started_at`, `completed_at`, `updated_at`, `created_at`
    - `lipsync_image_url` (text) - selected character image for lip-sync
    - `error_message` (text) - last error if any
    - `notes` (text) - user notes about this run

  2. `pipeline_images` - Images identified and generated for a chapter
    - `id` (uuid, primary key)
    - `pipeline_run_id` (FK to pipeline_runs)
    - `project_id` (FK to projects)
    - `chapter_id` (FK to chapters)
    - `order_index` (integer) - sequential order in the chapter
    - `text_anchor` (text) - the passage of text this image illustrates
    - `image_prompt` (text) - the SD prompt generated for this image
    - `animation_prompt` (text) - description of what to animate
    - `image_url` (text) - URL of the generated still image
    - `animated_url` (text) - URL of the animated version
    - `status` (text) - pending/generating/generated/animating/animated/error
    - `created_at`

  3. `pipeline_lipsync_chunks` - Lip-sync video chunks generated per TTS segment
    - `id` (uuid, primary key)
    - `pipeline_run_id` (FK to pipeline_runs)
    - `project_id` (FK to projects)
    - `chapter_id` (FK to chapters)
    - `chunk_index` (integer) - sequential order
    - `tts_audio_url` (text) - source TTS audio for this chunk
    - `video_url` (text) - generated lip-sync video URL
    - `filename` (text) - standardized filename for assembly
    - `status` (text) - pending/generating/completed/error
    - `created_at`

  ## Security
  - RLS enabled on all tables
  - Anon access policies (matches existing app pattern - no auth)
*/

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  current_stage text NOT NULL DEFAULT 'idle',
  status text NOT NULL DEFAULT 'idle',
  lipsync_image_url text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pipeline runs are accessible"
  ON pipeline_runs FOR SELECT
  TO anon
  USING (project_id IS NOT NULL);

CREATE POLICY "Pipeline runs can be inserted"
  ON pipeline_runs FOR INSERT
  TO anon
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Pipeline runs can be updated"
  ON pipeline_runs FOR UPDATE
  TO anon
  USING (project_id IS NOT NULL)
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Pipeline runs can be deleted"
  ON pipeline_runs FOR DELETE
  TO anon
  USING (project_id IS NOT NULL);


CREATE TABLE IF NOT EXISTS pipeline_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  text_anchor text NOT NULL DEFAULT '',
  image_prompt text NOT NULL DEFAULT '',
  animation_prompt text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  animated_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pipeline images are accessible"
  ON pipeline_images FOR SELECT
  TO anon
  USING (project_id IS NOT NULL);

CREATE POLICY "Pipeline images can be inserted"
  ON pipeline_images FOR INSERT
  TO anon
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Pipeline images can be updated"
  ON pipeline_images FOR UPDATE
  TO anon
  USING (project_id IS NOT NULL)
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Pipeline images can be deleted"
  ON pipeline_images FOR DELETE
  TO anon
  USING (project_id IS NOT NULL);


CREATE TABLE IF NOT EXISTS pipeline_lipsync_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  tts_audio_url text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  filename text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_lipsync_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pipeline lipsync chunks are accessible"
  ON pipeline_lipsync_chunks FOR SELECT
  TO anon
  USING (project_id IS NOT NULL);

CREATE POLICY "Pipeline lipsync chunks can be inserted"
  ON pipeline_lipsync_chunks FOR INSERT
  TO anon
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Pipeline lipsync chunks can be updated"
  ON pipeline_lipsync_chunks FOR UPDATE
  TO anon
  USING (project_id IS NOT NULL)
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Pipeline lipsync chunks can be deleted"
  ON pipeline_lipsync_chunks FOR DELETE
  TO anon
  USING (project_id IS NOT NULL);


CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project ON pipeline_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_chapter ON pipeline_runs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_images_run ON pipeline_images(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_images_chapter ON pipeline_images(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_lipsync_run ON pipeline_lipsync_chunks(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_lipsync_chapter ON pipeline_lipsync_chunks(chapter_id);
