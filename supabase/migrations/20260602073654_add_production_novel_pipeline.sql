/*
  # Production Novel Pipeline

  1. New Tables
    - `generation_runs` - Tracks entire book generation sessions with resume capability
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `outline_id` (uuid, references outlines)
      - `status` (text) - idle/running/paused/completed/failed
      - `draft_profile` (text) - fast_draft/standard_draft/novel_draft/publisher_draft
      - `current_chapter_index` (int) - For resume
      - `current_scene_index` (int) - For resume
      - `total_chapters` (int)
      - `total_scenes` (int)
      - `completed_scenes` (int)
      - `total_words` (int)
      - `error_message` (text)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `chapter_assemblies` - Stores assembled chapter manuscripts
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `chapter_id` (uuid, references chapters)
      - `content` (text) - Full assembled chapter text
      - `word_count` (int)
      - `scene_count` (int)
      - `summary` (text) - Auto-generated chapter summary
      - `status` (text) - draft/assembled/reviewed/final
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `book_manuscripts` - Stores complete book assemblies
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `outline_id` (uuid, references outlines)
      - `title` (text)
      - `title_page` (text)
      - `chapter_index` (text)
      - `content` (text) - Full manuscript
      - `word_count` (int)
      - `chapter_count` (int)
      - `status` (text) - draft/assembled/reviewed/final
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `character_voices` - Tracks character voice profiles for consistency
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `character_id` (uuid, references characters)
      - `speaking_style` (text)
      - `vocabulary` (text)
      - `personality_traits` (text)
      - `emotional_tendencies` (text)
      - `relationship_dynamics` (text)
      - `sample_dialogue` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `bible_extraction_queue` - Pending world-building extractions awaiting approval
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `scene_id` (uuid, references scenes)
      - `extraction_type` (text) - character/location/technology/organization/event
      - `name` (text)
      - `description` (text)
      - `status` (text) - pending/approved/rejected
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Anon access policies (matches existing app pattern)
*/

-- generation_runs
CREATE TABLE IF NOT EXISTS generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  outline_id uuid NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'idle',
  draft_profile text NOT NULL DEFAULT 'novel_draft',
  current_chapter_index int NOT NULL DEFAULT 0,
  current_scene_index int NOT NULL DEFAULT 0,
  total_chapters int NOT NULL DEFAULT 0,
  total_scenes int NOT NULL DEFAULT 0,
  completed_scenes int NOT NULL DEFAULT 0,
  total_words int NOT NULL DEFAULT 0,
  error_message text DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read generation_runs"
  ON generation_runs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert generation_runs"
  ON generation_runs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update generation_runs"
  ON generation_runs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete generation_runs"
  ON generation_runs FOR DELETE TO anon USING (true);

-- chapter_assemblies
CREATE TABLE IF NOT EXISTS chapter_assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  word_count int NOT NULL DEFAULT 0,
  scene_count int NOT NULL DEFAULT 0,
  summary text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chapter_assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read chapter_assemblies"
  ON chapter_assemblies FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert chapter_assemblies"
  ON chapter_assemblies FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update chapter_assemblies"
  ON chapter_assemblies FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete chapter_assemblies"
  ON chapter_assemblies FOR DELETE TO anon USING (true);

-- book_manuscripts
CREATE TABLE IF NOT EXISTS book_manuscripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  outline_id uuid NOT NULL REFERENCES outlines(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  title_page text DEFAULT '',
  chapter_index text DEFAULT '',
  content text NOT NULL DEFAULT '',
  word_count int NOT NULL DEFAULT 0,
  chapter_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE book_manuscripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read book_manuscripts"
  ON book_manuscripts FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert book_manuscripts"
  ON book_manuscripts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update book_manuscripts"
  ON book_manuscripts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete book_manuscripts"
  ON book_manuscripts FOR DELETE TO anon USING (true);

-- character_voices
CREATE TABLE IF NOT EXISTS character_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  speaking_style text DEFAULT '',
  vocabulary text DEFAULT '',
  personality_traits text DEFAULT '',
  emotional_tendencies text DEFAULT '',
  relationship_dynamics text DEFAULT '',
  sample_dialogue text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, character_id)
);

ALTER TABLE character_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read character_voices"
  ON character_voices FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert character_voices"
  ON character_voices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update character_voices"
  ON character_voices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete character_voices"
  ON character_voices FOR DELETE TO anon USING (true);

-- bible_extraction_queue
CREATE TABLE IF NOT EXISTS bible_extraction_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  extraction_type text NOT NULL DEFAULT 'character',
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bible_extraction_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read bible_extraction_queue"
  ON bible_extraction_queue FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert bible_extraction_queue"
  ON bible_extraction_queue FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update bible_extraction_queue"
  ON bible_extraction_queue FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete bible_extraction_queue"
  ON bible_extraction_queue FOR DELETE TO anon USING (true);
