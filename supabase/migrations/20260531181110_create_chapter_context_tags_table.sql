/*
  # Create chapter context tags table

  1. New Tables
    - `chapter_context_tags`
      - `id` (uuid, primary key)
      - `chapter_id` (uuid, references chapters)
      - `project_id` (uuid, references projects)
      - `entity_type` (text) - characters, places, things, technologies, story_bible_entries
      - `entity_id` (uuid) - ID of the tagged entity
      - `entity_name` (text) - display name for UI
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `chapter_context_tags` table
    - Add policies for anon access (matching existing pattern)

  3. Notes
    - Chapter-level tags serve as defaults for all scenes in that chapter
    - Scene-level tags override chapter-level tags when present
    - This supports outline-driven workflows where context is set at the chapter level
*/

CREATE TABLE IF NOT EXISTS chapter_context_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapter_context_tags_chapter ON chapter_context_tags(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_context_tags_project ON chapter_context_tags(project_id);

ALTER TABLE chapter_context_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on chapter_context_tags"
  ON chapter_context_tags FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on chapter_context_tags"
  ON chapter_context_tags FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on chapter_context_tags"
  ON chapter_context_tags FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on chapter_context_tags"
  ON chapter_context_tags FOR DELETE
  TO anon
  USING (true);
