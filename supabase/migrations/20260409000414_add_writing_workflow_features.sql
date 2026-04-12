/*
  # Add Writing Workflow Features

  Adds several new features inspired by a structured AI writing workflow:

  1. New Tables
    - `story_dossiers` - Pre-writing planning documents for each project
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `content` (text) - The generated dossier content
      - `genre_tropes` (text) - Genre tropes reference material
      - `braindump` (text) - Raw brainstorming/series outline input
      - `status` (text) - draft/complete
      - `created_at`, `updated_at` (timestamptz)

    - `scene_briefs` - Detailed per-chapter/scene preparation documents
      - `id` (uuid, primary key)
      - `chapter_id` (uuid, references chapters)
      - `project_id` (uuid, references projects)
      - `pov_character` (text)
      - `genre` (text)
      - `plot_beats` (text) - Scene beats extracted and expanded
      - `scene_function` (text) - Narrative function of the scene
      - `characters_in_scene` (text) - Character details for this specific scene
      - `setting_details` (text) - Sensory-rich environment description
      - `conflict` (text) - Main source of conflict
      - `tone_notes` (text) - Writing voice and style cues
      - `symbolism` (text) - Thematic layers and symbols
      - `continuity_notes` (text) - Links to past/future events
      - `other_notes` (text)
      - `created_at`, `updated_at` (timestamptz)

    - `prohibited_words` - Words/phrases to ban from AI output
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `word` (text) - The banned word or phrase
      - `category` (text) - Category grouping (ai_ism, cliche, overused, custom)
      - `created_at` (timestamptz)

    - `editing_passes` - Two-pass editing workflow
      - `id` (uuid, primary key)
      - `scene_id` (uuid, references scenes)
      - `project_id` (uuid, references projects)
      - `pass_type` (text) - improvement_plan or implementation
      - `content` (text) - The plan or edited result
      - `original_content` (text) - Snapshot of content before editing
      - `status` (text) - pending/in_progress/complete
      - `created_at`, `updated_at` (timestamptz)

    - `logic_checks` - Consistency/logic audit results
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `check_type` (text) - dossier/characters/worldbuilding/outline/chapter
      - `target_id` (text, nullable) - ID of the specific item checked
      - `target_name` (text) - Human-readable name of what was checked
      - `result` (text) - The audit result content
      - `status` (text) - pass/issues_found/needs_review
      - `created_at` (timestamptz)

  2. Modified Tables
    - `characters` - Add personality slider fields (jsonb)
      - `personality_sliders` (jsonb) - 15 slider values from -10 to 10
      - `dialogue_style` (text) - How the character speaks
      - `character_arc` (jsonb) - Arc structure with beginning/end/midpoint/climax

  3. Security
    - Enable RLS on all new tables
    - Add anon access policies (matching existing pattern)
*/

-- Story Dossiers
CREATE TABLE IF NOT EXISTS story_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  genre_tropes text NOT NULL DEFAULT '',
  braindump text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE story_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on story_dossiers"
  ON story_dossiers FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on story_dossiers"
  ON story_dossiers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on story_dossiers"
  ON story_dossiers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on story_dossiers"
  ON story_dossiers FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_story_dossiers_project ON story_dossiers(project_id);

-- Scene Briefs
CREATE TABLE IF NOT EXISTS scene_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pov_character text NOT NULL DEFAULT '',
  genre text NOT NULL DEFAULT '',
  plot_beats text NOT NULL DEFAULT '',
  scene_function text NOT NULL DEFAULT '',
  characters_in_scene text NOT NULL DEFAULT '',
  setting_details text NOT NULL DEFAULT '',
  conflict text NOT NULL DEFAULT '',
  tone_notes text NOT NULL DEFAULT '',
  symbolism text NOT NULL DEFAULT '',
  continuity_notes text NOT NULL DEFAULT '',
  other_notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scene_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on scene_briefs"
  ON scene_briefs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on scene_briefs"
  ON scene_briefs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on scene_briefs"
  ON scene_briefs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on scene_briefs"
  ON scene_briefs FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_scene_briefs_chapter ON scene_briefs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scene_briefs_project ON scene_briefs(project_id);

-- Prohibited Words
CREATE TABLE IF NOT EXISTS prohibited_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  word text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'custom',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prohibited_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on prohibited_words"
  ON prohibited_words FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on prohibited_words"
  ON prohibited_words FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on prohibited_words"
  ON prohibited_words FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on prohibited_words"
  ON prohibited_words FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_prohibited_words_project ON prohibited_words(project_id);

-- Editing Passes
CREATE TABLE IF NOT EXISTS editing_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pass_type text NOT NULL DEFAULT 'improvement_plan',
  content text NOT NULL DEFAULT '',
  original_content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE editing_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on editing_passes"
  ON editing_passes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on editing_passes"
  ON editing_passes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on editing_passes"
  ON editing_passes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on editing_passes"
  ON editing_passes FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_editing_passes_scene ON editing_passes(scene_id);
CREATE INDEX IF NOT EXISTS idx_editing_passes_project ON editing_passes(project_id);

-- Logic Checks
CREATE TABLE IF NOT EXISTS logic_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  check_type text NOT NULL DEFAULT 'dossier',
  target_id text,
  target_name text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'needs_review',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE logic_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on logic_checks"
  ON logic_checks FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on logic_checks"
  ON logic_checks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on logic_checks"
  ON logic_checks FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on logic_checks"
  ON logic_checks FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_logic_checks_project ON logic_checks(project_id);

-- Add personality sliders, dialogue style, and character arc to characters table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'personality_sliders'
  ) THEN
    ALTER TABLE characters ADD COLUMN personality_sliders jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'dialogue_style'
  ) THEN
    ALTER TABLE characters ADD COLUMN dialogue_style text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'character_arc'
  ) THEN
    ALTER TABLE characters ADD COLUMN character_arc jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
