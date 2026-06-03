/*
  # Expand character_states table for pipeline integration

  1. Modified Tables
    - `character_states`
      - `book_number` (integer) - which book this state was extracted from
      - `beliefs` (text) - what the character currently believes
      - `promises_made` (text) - commitments made to others
      - `unresolved_conflicts` (text) - open tensions and disputes
      - `role_in_next_book` (text) - AI assessment of function going forward
      - `extraction_source` (text) - 'manual' or 'pipeline' to distinguish origin
      - `location` (text) - where the character is at this point

  2. Purpose
    - Enable automated Character State Extraction after each book completes
    - Provide structured memory for anti-regression in multi-book pipeline
    - Distinguish manually-entered states from pipeline-extracted states
    - Track book_number so latest state per character per book can be queried

  3. Notes
    - Existing rows default to extraction_source='manual', book_number=NULL
    - Pipeline will populate these fields automatically after Level 6 assembly
    - The Write page already queries this table, so pipeline-extracted states
      will automatically benefit individual scene generation too
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'book_number'
  ) THEN
    ALTER TABLE character_states ADD COLUMN book_number integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'beliefs'
  ) THEN
    ALTER TABLE character_states ADD COLUMN beliefs text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'promises_made'
  ) THEN
    ALTER TABLE character_states ADD COLUMN promises_made text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'unresolved_conflicts'
  ) THEN
    ALTER TABLE character_states ADD COLUMN unresolved_conflicts text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'role_in_next_book'
  ) THEN
    ALTER TABLE character_states ADD COLUMN role_in_next_book text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'extraction_source'
  ) THEN
    ALTER TABLE character_states ADD COLUMN extraction_source text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_states' AND column_name = 'location'
  ) THEN
    ALTER TABLE character_states ADD COLUMN location text DEFAULT '';
  END IF;
END $$;

-- Index for efficient pipeline lookups: latest state per character per book
CREATE INDEX IF NOT EXISTS idx_character_states_book_number ON character_states(project_id, character_id, book_number);
CREATE INDEX IF NOT EXISTS idx_character_states_extraction_source ON character_states(extraction_source);