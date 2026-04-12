/*
  # Add Consistency Tracking Features

  ## Overview
  This migration adds features to help track story consistency, important events,
  and references across the novel to prevent AI drift.

  ## New Tables

  ### 1. `story_events`
  Track important plot points and events for reference
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `scene_id` (uuid, nullable, foreign key) - Scene where this occurred
  - `chapter_id` (uuid, nullable, foreign key) - Chapter where this occurred
  - `title` (text) - Event title
  - `description` (text) - What happened
  - `importance` (text) - critical, major, minor
  - `affects_characters` (jsonb) - Character IDs affected
  - `affects_world` (text) - How this changes the world
  - `tags` (text[]) - Searchable tags
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `character_states`
  Track how characters change throughout the story
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `character_id` (uuid, foreign key)
  - `scene_id` (uuid, nullable, foreign key) - When this state occurred
  - `physical_state` (text) - Injuries, appearance changes, etc.
  - `emotional_state` (text) - Current emotional state
  - `knowledge` (text) - What they know at this point
  - `possessions` (text) - What they have/lost
  - `relationships_changed` (text) - Changed relationships
  - `created_at` (timestamptz)

  ### 3. `scene_references`
  Mark scenes that should be referenced when writing future scenes
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `scene_id` (uuid, foreign key) - The scene being referenced
  - `reference_type` (text) - callback, foreshadowing, continuity, etc.
  - `reference_note` (text) - Why this should be referenced
  - `tags` (text[]) - Tags for finding relevant references
  - `active` (boolean) - Whether to actively include in context
  - `created_at` (timestamptz)

  ## Modifications

  ### Update `scenes` table
  - Add `tags` column for categorizing scenes
  - Add `importance_level` for prioritizing context
  - Add `key_details` for tracking critical information

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users

  ## Notes
  - This system helps prevent AI drift by tracking what happened
  - References can be selectively included in AI context
  - Character states prevent inconsistencies in character portrayal
*/

-- Story events table
CREATE TABLE IF NOT EXISTS story_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  importance text DEFAULT 'minor',
  affects_characters jsonb DEFAULT '[]'::jsonb,
  affects_world text DEFAULT '',
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE story_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all story events"
  ON story_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create story events"
  ON story_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update story events"
  ON story_events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete story events"
  ON story_events FOR DELETE
  TO authenticated
  USING (true);

-- Character states table
CREATE TABLE IF NOT EXISTS character_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  physical_state text DEFAULT '',
  emotional_state text DEFAULT '',
  knowledge text DEFAULT '',
  possessions text DEFAULT '',
  relationships_changed text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE character_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all character states"
  ON character_states FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create character states"
  ON character_states FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update character states"
  ON character_states FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete character states"
  ON character_states FOR DELETE
  TO authenticated
  USING (true);

-- Scene references table
CREATE TABLE IF NOT EXISTS scene_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  reference_type text DEFAULT 'continuity',
  reference_note text DEFAULT '',
  tags text[] DEFAULT ARRAY[]::text[],
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scene_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all scene references"
  ON scene_references FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create scene references"
  ON scene_references FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update scene references"
  ON scene_references FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete scene references"
  ON scene_references FOR DELETE
  TO authenticated
  USING (true);

-- Add new columns to scenes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'tags'
  ) THEN
    ALTER TABLE scenes ADD COLUMN tags text[] DEFAULT ARRAY[]::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'importance_level'
  ) THEN
    ALTER TABLE scenes ADD COLUMN importance_level text DEFAULT 'normal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'key_details'
  ) THEN
    ALTER TABLE scenes ADD COLUMN key_details text DEFAULT '';
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_story_events_project_id ON story_events(project_id);
CREATE INDEX IF NOT EXISTS idx_story_events_scene_id ON story_events(scene_id);
CREATE INDEX IF NOT EXISTS idx_story_events_tags ON story_events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_character_states_character_id ON character_states(character_id);
CREATE INDEX IF NOT EXISTS idx_character_states_scene_id ON character_states(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_references_scene_id ON scene_references(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_references_tags ON scene_references USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_scenes_tags ON scenes USING GIN(tags);