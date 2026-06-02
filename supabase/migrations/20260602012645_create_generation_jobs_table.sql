/*
  # Create generation jobs table

  1. New Tables
    - `generation_jobs`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `task_type` (text) - wizard_quick, wizard_step, scene, design_brief, editing_pass, etc.
      - `status` (text) - queued, running, completed, failed, cancelled
      - `current_step` (integer) - for multi-step jobs (wizard steps 1-6)
      - `total_steps` (integer) - total steps in this job
      - `step_label` (text) - human-readable current step description
      - `prompt` (text) - the full prompt being sent (for retry/debug)
      - `result` (text) - the completed generation output
      - `error_message` (text) - error details if failed
      - `settings_snapshot` (jsonb) - frozen copy of generation settings at job creation
      - `metadata` (jsonb) - flexible field for task-specific data (wizard inputs, context tags, etc.)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Decouples generation lifecycle from React component lifecycle
    - Jobs survive navigation, refresh, and component unmounts
    - Provides job history (recently completed, failed, cancelled)
    - Enables resume from interruption
    - One active job per project at a time (enforced at app level, not DB)

  3. Security
    - Enable RLS on `generation_jobs` table
    - Add policies for anon access (matching existing app pattern)
*/

CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  current_step integer NOT NULL DEFAULT 0,
  total_steps integer NOT NULL DEFAULT 1,
  step_label text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  settings_snapshot jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_status ON generation_jobs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on generation_jobs"
  ON generation_jobs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on generation_jobs"
  ON generation_jobs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on generation_jobs"
  ON generation_jobs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on generation_jobs"
  ON generation_jobs FOR DELETE
  TO anon
  USING (true);
