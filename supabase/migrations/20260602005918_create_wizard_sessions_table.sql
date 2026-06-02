/*
  # Create wizard sessions table for state persistence

  1. New Tables
    - `wizard_sessions`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects, unique)
      - `mode` (text) - 'quick' or 'advanced'
      - `quick_step` (integer) - current step being generated (1-6, 0 = idle, 7 = complete)
      - `is_running` (boolean) - whether generation is actively in progress
      - `book_count` (integer)
      - `genre` (text)
      - `end_goal` (text)
      - `planning_style` (text)
      - `review_first` (boolean)
      - `plan_approved` (boolean)
      - `output_series_map` (text)
      - `output_major_events` (text)
      - `output_book_outline` (text)
      - `output_chapter_list` (text)
      - `output_chapter_briefs` (text)
      - `output_scenes` (text)
      - `updated_at` (timestamptz)

  2. Purpose
    - Persists wizard progress so navigating away doesn't lose completed steps
    - One session per project (upsert pattern)
    - When user returns to wizard page, completed steps are restored
    - Running state tracked so UI can show "generation in progress" status

  3. Security
    - Enable RLS on `wizard_sessions` table
    - Add policies for anon access (matching existing app pattern)
*/

CREATE TABLE IF NOT EXISTS wizard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'quick',
  quick_step integer NOT NULL DEFAULT 0,
  is_running boolean NOT NULL DEFAULT false,
  book_count integer NOT NULL DEFAULT 7,
  genre text NOT NULL DEFAULT '',
  end_goal text NOT NULL DEFAULT '',
  planning_style text NOT NULL DEFAULT 'balanced',
  review_first boolean NOT NULL DEFAULT true,
  plan_approved boolean NOT NULL DEFAULT false,
  output_series_map text NOT NULL DEFAULT '',
  output_major_events text NOT NULL DEFAULT '',
  output_book_outline text NOT NULL DEFAULT '',
  output_chapter_list text NOT NULL DEFAULT '',
  output_chapter_briefs text NOT NULL DEFAULT '',
  output_scenes text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT wizard_sessions_project_unique UNIQUE (project_id)
);

ALTER TABLE wizard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on wizard_sessions"
  ON wizard_sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on wizard_sessions"
  ON wizard_sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on wizard_sessions"
  ON wizard_sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on wizard_sessions"
  ON wizard_sessions FOR DELETE
  TO anon
  USING (true);
