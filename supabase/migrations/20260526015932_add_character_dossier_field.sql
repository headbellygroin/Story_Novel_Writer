/*
  # Add Character Dossier Field

  1. Modified Tables
    - `characters`
      - `dossier` (text) - Rich structured text field for deep character development.
        Contains a template-based character profile covering core role, appearance layers,
        personality, emotional function, relationships, fears, flaws, quiet moments,
        comedy dynamics, symbolic themes, and character arc.

  2. Notes
    - This is a universal character development system stored as structured markdown
    - The AI context system reads this field to deeply understand characters during generation
    - Writers fill in relevant sections and leave others blank as needed per project
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'dossier'
  ) THEN
    ALTER TABLE characters ADD COLUMN dossier text DEFAULT '';
  END IF;
END $$;
