/*
  # Add AI Memory & Context Features

  This migration adds tables and columns to help the AI maintain consistency
  and reduce drift when generating novel content.

  1. New Tables
    - `scene_summaries`
      - `id` (uuid, primary key)
      - `scene_id` (uuid, references scenes)
      - `project_id` (uuid, references projects)
      - `summary` (text) - compressed scene recap for context injection
      - `key_facts` (text[]) - extractable facts from the scene
      - `characters_involved` (text[]) - character names in scene
      - `emotional_arc` (text) - emotional trajectory of the scene
      - `created_at` / `updated_at` (timestamptz)
    - `story_bible_entries`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `category` (text) - e.g. character_fact, world_rule, timeline, relationship
      - `subject` (text) - what or who this fact is about
      - `fact` (text) - the canonical fact
      - `source_scene_id` (uuid, nullable) - where this was established
      - `importance` (text) - critical, high, medium, low
      - `tags` (text[]) - for filtering
      - `created_at` / `updated_at` (timestamptz)
    - `style_anchors`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `label` (text) - user-given name for this passage
      - `passage` (text) - the reference writing sample
      - `notes` (text) - what this exemplifies (tone, pacing, dialogue style)
      - `active` (boolean) - whether to include in prompts
      - `created_at` / `updated_at` (timestamptz)
    - `scene_context_tags`
      - `id` (uuid, primary key)
      - `scene_id` (uuid, references scenes)
      - `project_id` (uuid, references projects)
      - `entity_type` (text) - character, place, thing, technology, story_bible_entry
      - `entity_id` (uuid) - the tagged entity's ID
      - `entity_name` (text) - denormalized name for display
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - No policies added (app uses service role or anon with project-level filtering)
*/

-- Scene Summaries
CREATE TABLE IF NOT EXISTS scene_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  key_facts text[] NOT NULL DEFAULT '{}',
  characters_involved text[] NOT NULL DEFAULT '{}',
  emotional_arc text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scene_summaries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_scene_summaries_scene ON scene_summaries(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_summaries_project ON scene_summaries(project_id);

-- Story Bible Entries
CREATE TABLE IF NOT EXISTS story_bible_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL DEFAULT '',
  fact text NOT NULL DEFAULT '',
  source_scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  importance text NOT NULL DEFAULT 'medium',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE story_bible_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_story_bible_project ON story_bible_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_story_bible_category ON story_bible_entries(category);
CREATE INDEX IF NOT EXISTS idx_story_bible_importance ON story_bible_entries(importance);

-- Style Anchors
CREATE TABLE IF NOT EXISTS style_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  passage text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE style_anchors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_style_anchors_project ON style_anchors(project_id);

-- Scene Context Tags (smart context selection)
CREATE TABLE IF NOT EXISTS scene_context_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid NOT NULL,
  entity_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scene_context_tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_scene_context_tags_scene ON scene_context_tags(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_context_tags_project ON scene_context_tags(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_context_tags_unique ON scene_context_tags(scene_id, entity_type, entity_id);