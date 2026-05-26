/*
  # Add emergent character flag and infrastructure sliders to all entity types

  Adds a boolean toggle and infrastructure personality sliders to all entity tables.
  This supports entities that start as pure settings (a ship, a station, a vehicle)
  but can evolve into characters with their own emergent personality over the course
  of the narrative.

  1. Modified Tables
    - `characters` - add `emergent_character` (boolean, default false)
    - `places` - add `emergent_character` (boolean, default false), `infrastructure_sliders` (jsonb)
    - `things` - add `emergent_character` (boolean, default false), `infrastructure_sliders` (jsonb)
    - `technologies` - add `emergent_character` (boolean, default false), `infrastructure_sliders` (jsonb)

  2. Notes
    - When emergent_character is true, the AI treats the entity as having agency and personality
    - When false, infrastructure sliders inform atmosphere/environment only
    - Characters table already has infrastructure_sliders from a prior migration
    - The Wayward Naught will have emergent_character set to true
*/

-- characters: add emergent_character flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'emergent_character'
  ) THEN
    ALTER TABLE characters ADD COLUMN emergent_character boolean DEFAULT false;
  END IF;
END $$;

-- places: add emergent_character and infrastructure_sliders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'emergent_character'
  ) THEN
    ALTER TABLE places ADD COLUMN emergent_character boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'infrastructure_sliders'
  ) THEN
    ALTER TABLE places ADD COLUMN infrastructure_sliders jsonb;
  END IF;
END $$;

-- things: add emergent_character and infrastructure_sliders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'things' AND column_name = 'emergent_character'
  ) THEN
    ALTER TABLE things ADD COLUMN emergent_character boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'things' AND column_name = 'infrastructure_sliders'
  ) THEN
    ALTER TABLE things ADD COLUMN infrastructure_sliders jsonb;
  END IF;
END $$;

-- technologies: add emergent_character and infrastructure_sliders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technologies' AND column_name = 'emergent_character'
  ) THEN
    ALTER TABLE technologies ADD COLUMN emergent_character boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technologies' AND column_name = 'infrastructure_sliders'
  ) THEN
    ALTER TABLE technologies ADD COLUMN infrastructure_sliders jsonb;
  END IF;
END $$;

-- Set The Wayward Naught as emergent character
UPDATE characters SET emergent_character = true WHERE name = 'The Wayward Naught';
