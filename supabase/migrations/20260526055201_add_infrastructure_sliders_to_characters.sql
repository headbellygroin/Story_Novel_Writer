/*
  # Add infrastructure sliders to characters

  Adds an optional JSON column for infrastructure trait sliders.
  Used for entities that are both characters and settings (e.g., ships)
  to track traits like Redundancy, Adaptability, Crew Familiarity Drift, etc.

  1. Modified Tables
    - `characters`
      - `infrastructure_sliders` (jsonb, nullable) - stores ship/setting infrastructure personality values

  2. Notes
    - Only relevant for ship-type or setting-type characters
    - Standard characters will leave this null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'infrastructure_sliders'
  ) THEN
    ALTER TABLE characters ADD COLUMN infrastructure_sliders jsonb;
  END IF;
END $$;
