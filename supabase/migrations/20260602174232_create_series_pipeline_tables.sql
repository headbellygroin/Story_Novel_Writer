/*
  # Create Full-Series Multi-Pass Pipeline Tables

  1. New Tables
    - `series_plans` - Level 1 output: high-level plan for each book in a series
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `outline_id` (uuid, FK to outlines, nullable - linked after Level 2)
      - `book_number` (integer) - which book in the series
      - `title` (text) - book title
      - `core_theme` (text)
      - `beginning_state` (text)
      - `ending_state` (text)
      - `main_conflict` (text)
      - `major_reveal` (text)
      - `character_arc_focus` (text)
      - `relationship_movement` (text)
      - `mystery_progression` (text)
      - `setup_for_next` (text)
      - `high_level_outline` (text) - broad narrative outline
      - `status` (text) - pending/complete/stale
      - `created_at`, `updated_at` (timestamptz)

    - `chapter_briefs` - Level 3 output: structured design brief per chapter
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `chapter_id` (uuid, FK to chapters)
      - `book_number` (integer)
      - `chapter_purpose` (text)
      - `emotional_goal` (text)
      - `character_goals` (text)
      - `conflict_structure` (text)
      - `theme_goals` (text)
      - `worldbuilding_allowed` (text)
      - `reveal_restrictions` (text)
      - `continuity_requirements` (text)
      - `scene_blueprint_text` (text) - scene-by-scene plan as text
      - `raw_output` (text) - full AI output for reference
      - `status` (text) - pending/complete/stale
      - `created_at`, `updated_at` (timestamptz)

    - `scene_blueprints` - Level 4 output: structured scene cards
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `chapter_id` (uuid, FK to chapters)
      - `scene_id` (uuid, FK to scenes, nullable - linked when scene record created)
      - `order_index` (integer)
      - `title` (text)
      - `pov_character` (text)
      - `characters_present` (text)
      - `setting` (text)
      - `opening_beat` (text)
      - `conflict_tension` (text)
      - `key_dialogue_beats` (text)
      - `emotional_turn` (text)
      - `worldbuilding_allowed` (text)
      - `reveal_restrictions` (text)
      - `closing_beat` (text)
      - `transition_to_next` (text)
      - `raw_output` (text)
      - `status` (text) - pending/complete/stale
      - `created_at`, `updated_at` (timestamptz)

    - `pipeline_state` - Tracks progress of full pipeline
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to projects)
      - `pipeline_mode` (text) - accelerated/guided
      - `current_level` (integer) - 1-6
      - `current_book` (integer)
      - `current_chapter` (integer)
      - `current_scene` (integer)
      - `level1_status` (text) - pending/running/complete
      - `level2_status` (text)
      - `level3_status` (text)
      - `level4_status` (text)
      - `level5_status` (text)
      - `level6_status` (text)
      - `is_running` (boolean)
      - `error_message` (text)
      - `started_at`, `completed_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add anon access policies matching existing project pattern
*/

-- Series Plans (Level 1 output)
CREATE TABLE IF NOT EXISTS series_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  outline_id uuid REFERENCES outlines(id) ON DELETE SET NULL,
  book_number integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  core_theme text NOT NULL DEFAULT '',
  beginning_state text NOT NULL DEFAULT '',
  ending_state text NOT NULL DEFAULT '',
  main_conflict text NOT NULL DEFAULT '',
  major_reveal text NOT NULL DEFAULT '',
  character_arc_focus text NOT NULL DEFAULT '',
  relationship_movement text NOT NULL DEFAULT '',
  mystery_progression text NOT NULL DEFAULT '',
  setup_for_next text NOT NULL DEFAULT '',
  high_level_outline text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chapter Briefs (Level 3 output)
CREATE TABLE IF NOT EXISTS chapter_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  book_number integer NOT NULL DEFAULT 1,
  chapter_purpose text NOT NULL DEFAULT '',
  emotional_goal text NOT NULL DEFAULT '',
  character_goals text NOT NULL DEFAULT '',
  conflict_structure text NOT NULL DEFAULT '',
  theme_goals text NOT NULL DEFAULT '',
  worldbuilding_allowed text NOT NULL DEFAULT '',
  reveal_restrictions text NOT NULL DEFAULT '',
  continuity_requirements text NOT NULL DEFAULT '',
  scene_blueprint_text text NOT NULL DEFAULT '',
  raw_output text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Scene Blueprints (Level 4 output)
CREATE TABLE IF NOT EXISTS scene_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  pov_character text NOT NULL DEFAULT '',
  characters_present text NOT NULL DEFAULT '',
  setting text NOT NULL DEFAULT '',
  opening_beat text NOT NULL DEFAULT '',
  conflict_tension text NOT NULL DEFAULT '',
  key_dialogue_beats text NOT NULL DEFAULT '',
  emotional_turn text NOT NULL DEFAULT '',
  worldbuilding_allowed text NOT NULL DEFAULT '',
  reveal_restrictions text NOT NULL DEFAULT '',
  closing_beat text NOT NULL DEFAULT '',
  transition_to_next text NOT NULL DEFAULT '',
  raw_output text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipeline State (orchestration tracking)
CREATE TABLE IF NOT EXISTS pipeline_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pipeline_mode text NOT NULL DEFAULT 'guided',
  current_level integer NOT NULL DEFAULT 1,
  current_book integer NOT NULL DEFAULT 1,
  current_chapter integer NOT NULL DEFAULT 0,
  current_scene integer NOT NULL DEFAULT 0,
  level1_status text NOT NULL DEFAULT 'pending',
  level2_status text NOT NULL DEFAULT 'pending',
  level3_status text NOT NULL DEFAULT 'pending',
  level4_status text NOT NULL DEFAULT 'pending',
  level5_status text NOT NULL DEFAULT 'pending',
  level6_status text NOT NULL DEFAULT 'pending',
  is_running boolean NOT NULL DEFAULT false,
  error_message text NOT NULL DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE series_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_state ENABLE ROW LEVEL SECURITY;

-- Policies for series_plans
CREATE POLICY "anon_select_series_plans" ON series_plans FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_series_plans" ON series_plans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_series_plans" ON series_plans FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_series_plans" ON series_plans FOR DELETE TO anon USING (true);

-- Policies for chapter_briefs
CREATE POLICY "anon_select_chapter_briefs" ON chapter_briefs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_chapter_briefs" ON chapter_briefs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_chapter_briefs" ON chapter_briefs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_chapter_briefs" ON chapter_briefs FOR DELETE TO anon USING (true);

-- Policies for scene_blueprints
CREATE POLICY "anon_select_scene_blueprints" ON scene_blueprints FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_scene_blueprints" ON scene_blueprints FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_scene_blueprints" ON scene_blueprints FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_scene_blueprints" ON scene_blueprints FOR DELETE TO anon USING (true);

-- Policies for pipeline_state
CREATE POLICY "anon_select_pipeline_state" ON pipeline_state FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_pipeline_state" ON pipeline_state FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_pipeline_state" ON pipeline_state FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pipeline_state" ON pipeline_state FOR DELETE TO anon USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_series_plans_project ON series_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_series_plans_book ON series_plans(project_id, book_number);
CREATE INDEX IF NOT EXISTS idx_chapter_briefs_chapter ON chapter_briefs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_briefs_project ON chapter_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_blueprints_chapter ON scene_blueprints(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scene_blueprints_scene ON scene_blueprints(scene_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_state_project ON pipeline_state(project_id);
