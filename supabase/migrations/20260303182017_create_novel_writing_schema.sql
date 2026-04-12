/*
  # Novel Writing Application Database Schema

  ## Overview
  This migration creates a comprehensive database schema for an AI-powered novel writing application
  with world-building capabilities and story outlining features.

  ## New Tables

  ### 1. `projects`
  Main container for novel projects
  - `id` (uuid, primary key)
  - `title` (text) - Project/novel title
  - `description` (text) - Project description
  - `genre` (text) - Genre of the novel
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `characters`
  Character entities in the world library
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `name` (text) - Character name
  - `role` (text) - protagonist, antagonist, supporting, etc.
  - `description` (text) - Physical description
  - `personality` (text) - Personality traits
  - `background` (text) - Character backstory
  - `goals` (text) - Character goals/motivations
  - `relationships` (jsonb) - Relationships with other characters
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `places`
  Location entities in the world library
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `name` (text) - Place name
  - `type` (text) - city, building, region, planet, etc.
  - `description` (text) - Physical description
  - `history` (text) - Historical background
  - `significance` (text) - Why this place matters
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `things`
  Object/item entities in the world library
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `name` (text) - Item name
  - `type` (text) - weapon, artifact, tool, etc.
  - `description` (text) - Physical description
  - `properties` (text) - Special properties/abilities
  - `history` (text) - Origin and history
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `technologies`
  Technology/magic systems in the world library
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `name` (text) - Technology/system name
  - `type` (text) - science, magic, hybrid, etc.
  - `description` (text) - How it works
  - `rules` (text) - Rules and limitations
  - `applications` (text) - Common uses
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. `outlines`
  Story outlines/plot structures
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `title` (text) - Outline title
  - `synopsis` (text) - Overall story synopsis
  - `act_structure` (text) - Act structure notes
  - `themes` (text) - Major themes
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `chapters`
  Individual chapters in the outline
  - `id` (uuid, primary key)
  - `outline_id` (uuid, foreign key)
  - `project_id` (uuid, foreign key)
  - `order_index` (integer) - Chapter order
  - `title` (text) - Chapter title
  - `summary` (text) - Chapter summary/beats
  - `pov_character_id` (uuid, nullable) - POV character reference
  - `setting_place_id` (uuid, nullable) - Primary location reference
  - `key_events` (text) - Key events in this chapter
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. `scenes`
  Individual scenes within chapters
  - `id` (uuid, primary key)
  - `chapter_id` (uuid, foreign key)
  - `project_id` (uuid, foreign key)
  - `order_index` (integer) - Scene order within chapter
  - `title` (text) - Scene title
  - `description` (text) - Scene description/beats
  - `content` (text) - Generated prose content
  - `status` (text) - draft, reviewed, final
  - `ai_prompt` (text) - Prompt used for generation
  - `context_data` (jsonb) - World library data used
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. `generation_settings`
  AI generation settings per project
  - `id` (uuid, primary key)
  - `project_id` (uuid, foreign key)
  - `model_name` (text) - Local model identifier
  - `api_endpoint` (text) - API endpoint for local model
  - `temperature` (numeric) - Generation temperature
  - `max_tokens` (integer) - Max tokens per generation
  - `system_prompt` (text) - Base system prompt
  - `style_guide` (text) - Writing style guidelines
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  - This is a local/offline application, so we use simple user-based policies
*/

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  genre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (true);

-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT '',
  description text DEFAULT '',
  personality text DEFAULT '',
  background text DEFAULT '',
  goals text DEFAULT '',
  relationships jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all characters"
  ON characters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create characters"
  ON characters FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update characters"
  ON characters FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete characters"
  ON characters FOR DELETE
  TO authenticated
  USING (true);

-- Places table
CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT '',
  description text DEFAULT '',
  history text DEFAULT '',
  significance text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all places"
  ON places FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create places"
  ON places FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update places"
  ON places FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete places"
  ON places FOR DELETE
  TO authenticated
  USING (true);

-- Things table
CREATE TABLE IF NOT EXISTS things (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT '',
  description text DEFAULT '',
  properties text DEFAULT '',
  history text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE things ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all things"
  ON things FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create things"
  ON things FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update things"
  ON things FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete things"
  ON things FOR DELETE
  TO authenticated
  USING (true);

-- Technologies table
CREATE TABLE IF NOT EXISTS technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT '',
  description text DEFAULT '',
  rules text DEFAULT '',
  applications text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE technologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all technologies"
  ON technologies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create technologies"
  ON technologies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update technologies"
  ON technologies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete technologies"
  ON technologies FOR DELETE
  TO authenticated
  USING (true);

-- Outlines table
CREATE TABLE IF NOT EXISTS outlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  synopsis text DEFAULT '',
  act_structure text DEFAULT '',
  themes text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE outlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all outlines"
  ON outlines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create outlines"
  ON outlines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update outlines"
  ON outlines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete outlines"
  ON outlines FOR DELETE
  TO authenticated
  USING (true);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_id uuid NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  summary text DEFAULT '',
  pov_character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  setting_place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  key_events text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all chapters"
  ON chapters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create chapters"
  ON chapters FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update chapters"
  ON chapters FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete chapters"
  ON chapters FOR DELETE
  TO authenticated
  USING (true);

-- Scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text DEFAULT '',
  content text DEFAULT '',
  status text DEFAULT 'draft',
  ai_prompt text DEFAULT '',
  context_data jsonb DEFAULT '{}'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all scenes"
  ON scenes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create scenes"
  ON scenes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update scenes"
  ON scenes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete scenes"
  ON scenes FOR DELETE
  TO authenticated
  USING (true);

-- Generation settings table
CREATE TABLE IF NOT EXISTS generation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  model_name text DEFAULT 'local-model',
  api_endpoint text DEFAULT 'http://localhost:5000/v1/completions',
  temperature numeric DEFAULT 0.7,
  max_tokens integer DEFAULT 1000,
  system_prompt text DEFAULT 'You are a creative fiction writer helping to write a novel. Write engaging, vivid prose that matches the style and tone of the project.',
  style_guide text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE generation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all generation settings"
  ON generation_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create generation settings"
  ON generation_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update generation settings"
  ON generation_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete generation settings"
  ON generation_settings FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_places_project_id ON places(project_id);
CREATE INDEX IF NOT EXISTS idx_things_project_id ON things(project_id);
CREATE INDEX IF NOT EXISTS idx_technologies_project_id ON technologies(project_id);
CREATE INDEX IF NOT EXISTS idx_outlines_project_id ON outlines(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_outline_id ON chapters(outline_id);
CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_chapter_id ON scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);