/*
  # Create Reveal Timeline Table

  1. New Tables
    - `reveal_timeline`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `entity_type` (text) - which table: characters, places, things, technologies, story_bible_entries
      - `entity_id` (uuid) - the specific entry being revealed
      - `entity_name` (text) - denormalized for display without joins
      - `fact` (text) - what specifically is revealed (e.g., "HAMSTER systems exist", "Ship can die")
      - `book_number` (integer) - which book/volume this is revealed in
      - `act` (text) - optional act/section within the book
      - `reveal_method` (text) - how it's revealed: 'direct', 'implied', 'foreshadowed', 'discovered', 'revealed_by_character'
      - `notes` (text) - additional context about the reveal
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `reveal_timeline` table
    - Add policies for anonymous access (matching existing app pattern)

  3. Purpose
    - Tracks controlled information release across the series
    - Lets the writer see at a glance what the reader knows at each point in the story
    - Prevents accidentally revealing information before its intended moment
    - Useful for series-level pacing of mysteries, lore, and worldbuilding
*/

CREATE TABLE IF NOT EXISTS reveal_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  entity_name text NOT NULL DEFAULT '',
  fact text NOT NULL DEFAULT '',
  book_number integer NOT NULL DEFAULT 1,
  act text DEFAULT '',
  reveal_method text DEFAULT 'direct',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reveal_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to reveal_timeline"
  ON reveal_timeline FOR SELECT
  TO anon
  USING (project_id IS NOT NULL);

CREATE POLICY "Allow anonymous insert to reveal_timeline"
  ON reveal_timeline FOR INSERT
  TO anon
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Allow anonymous update to reveal_timeline"
  ON reveal_timeline FOR UPDATE
  TO anon
  USING (project_id IS NOT NULL)
  WITH CHECK (project_id IS NOT NULL);

CREATE POLICY "Allow anonymous delete from reveal_timeline"
  ON reveal_timeline FOR DELETE
  TO anon
  USING (project_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_reveal_timeline_project ON reveal_timeline(project_id);
CREATE INDEX IF NOT EXISTS idx_reveal_timeline_book ON reveal_timeline(project_id, book_number);
CREATE INDEX IF NOT EXISTS idx_reveal_timeline_entity ON reveal_timeline(entity_id);
