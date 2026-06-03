/*
  # Add Quality Gate Columns for Pipeline Integrity

  1. Purpose
    - Add Book Ownership gate fields to series_plans
    - Add MSU (Making Stuff Up) detection fields to series_plans, chapter_briefs, scene_blueprints
    - Add Reveal Timeline gate fields to series_plans, chapter_briefs, scene_blueprints
    - Add Scene Depth tracking fields to scenes
    - Add scene_depth_mode to pipeline_state

  2. Modified Tables
    - `series_plans`: ownership config + ownership/msu/reveal status fields
    - `chapter_briefs`: msu + reveal status fields
    - `scene_blueprints`: msu + reveal status fields
    - `scenes`: depth tracking fields
    - `pipeline_state`: scene_depth_mode

  3. Important Notes
    - All new columns are nullable to avoid breaking existing data
    - No destructive operations
    - No new tables created
*/

-- series_plans: ownership configuration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'required_owner') THEN
    ALTER TABLE series_plans ADD COLUMN required_owner text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'required_theme') THEN
    ALTER TABLE series_plans ADD COLUMN required_theme text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'ownership_beats') THEN
    ALTER TABLE series_plans ADD COLUMN ownership_beats text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'ownership_score') THEN
    ALTER TABLE series_plans ADD COLUMN ownership_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'ownership_status') THEN
    ALTER TABLE series_plans ADD COLUMN ownership_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'msu_status') THEN
    ALTER TABLE series_plans ADD COLUMN msu_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'msu_flags') THEN
    ALTER TABLE series_plans ADD COLUMN msu_flags text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'reveal_status') THEN
    ALTER TABLE series_plans ADD COLUMN reveal_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'reveal_flags') THEN
    ALTER TABLE series_plans ADD COLUMN reveal_flags text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_plans' AND column_name = 'repair_attempts') THEN
    ALTER TABLE series_plans ADD COLUMN repair_attempts integer DEFAULT 0;
  END IF;
END $$;

-- chapter_briefs: msu + reveal status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_briefs' AND column_name = 'msu_status') THEN
    ALTER TABLE chapter_briefs ADD COLUMN msu_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_briefs' AND column_name = 'msu_flags') THEN
    ALTER TABLE chapter_briefs ADD COLUMN msu_flags text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_briefs' AND column_name = 'reveal_status') THEN
    ALTER TABLE chapter_briefs ADD COLUMN reveal_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_briefs' AND column_name = 'reveal_flags') THEN
    ALTER TABLE chapter_briefs ADD COLUMN reveal_flags text;
  END IF;
END $$;

-- scene_blueprints: msu + reveal status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scene_blueprints' AND column_name = 'msu_status') THEN
    ALTER TABLE scene_blueprints ADD COLUMN msu_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scene_blueprints' AND column_name = 'msu_flags') THEN
    ALTER TABLE scene_blueprints ADD COLUMN msu_flags text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scene_blueprints' AND column_name = 'reveal_status') THEN
    ALTER TABLE scene_blueprints ADD COLUMN reveal_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scene_blueprints' AND column_name = 'reveal_flags') THEN
    ALTER TABLE scene_blueprints ADD COLUMN reveal_flags text;
  END IF;
END $$;

-- scenes: depth tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'scene_depth_status') THEN
    ALTER TABLE scenes ADD COLUMN scene_depth_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'word_count') THEN
    ALTER TABLE scenes ADD COLUMN word_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'target_word_count') THEN
    ALTER TABLE scenes ADD COLUMN target_word_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'expansion_attempts') THEN
    ALTER TABLE scenes ADD COLUMN expansion_attempts integer DEFAULT 0;
  END IF;
END $$;

-- pipeline_state: scene depth mode
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipeline_state' AND column_name = 'scene_depth_mode') THEN
    ALTER TABLE pipeline_state ADD COLUMN scene_depth_mode text DEFAULT 'standard_draft';
  END IF;
END $$;