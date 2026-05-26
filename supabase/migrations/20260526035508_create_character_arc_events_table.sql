/*
  # Create character arc events table

  Stores AI-tracked personality slider adjustments as characters progress through the story.
  Each row represents a detected shift in a character's personality at a specific scene,
  including the reasoning behind the shift.

  1. New Tables
    - `character_arc_events`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `character_id` (uuid, FK to characters)
      - `scene_id` (uuid, FK to scenes) - the scene that triggered this shift
      - `slider_id` (text) - which personality slider changed (matches personalitySliders.ts ids)
      - `delta` (integer) - the adjustment amount (e.g., -2 means slider drops by 2)
      - `reasoning` (text) - AI explanation of why this shift occurred
      - `status` (text) - 'proposed' | 'accepted' | 'rejected'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `character_arc_events` table
    - Add permissive anon policies for CRUD (matches existing app pattern)
*/

CREATE TABLE IF NOT EXISTS character_arc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  slider_id text NOT NULL DEFAULT '',
  delta integer NOT NULL DEFAULT 0,
  reasoning text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_character_arc_events_project ON character_arc_events(project_id);
CREATE INDEX IF NOT EXISTS idx_character_arc_events_character ON character_arc_events(character_id);
CREATE INDEX IF NOT EXISTS idx_character_arc_events_scene ON character_arc_events(scene_id);

ALTER TABLE character_arc_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on character_arc_events"
  ON character_arc_events FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on character_arc_events"
  ON character_arc_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on character_arc_events"
  ON character_arc_events FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on character_arc_events"
  ON character_arc_events FOR DELETE
  TO anon
  USING (true);
