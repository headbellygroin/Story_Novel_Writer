/*
  # Create Franchise Manifesto Table

  1. New Tables
    - `franchise_manifesto`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `content` (text, the manifesto content)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Stores immutable franchise-level truths that sit above all other guidance
    - Single source of truth that prevents drift across Story Bible, System Prompt, Style Guide, and Tropes

  3. Security
    - Enable RLS on `franchise_manifesto` table
    - Add policy for anon access (matching existing project patterns)
*/

CREATE TABLE IF NOT EXISTS franchise_manifesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE franchise_manifesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on franchise_manifesto"
  ON franchise_manifesto
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on franchise_manifesto"
  ON franchise_manifesto
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on franchise_manifesto"
  ON franchise_manifesto
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on franchise_manifesto"
  ON franchise_manifesto
  FOR DELETE
  TO anon
  USING (true);