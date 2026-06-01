/*
  # Add Character Visibility Fields

  1. Modified Tables
    - `characters`
      - `book_introduced` (integer, default 1) - Which book/volume the character first appears in
      - `chapter_introduced` (integer, nullable) - Which chapter order_index the character is introduced
      - `scene_introduced` (integer, nullable) - Which scene order_index within chapter the character first appears

  2. Purpose
    - Controls character visibility during generation to prevent future cast from contaminating early scenes
    - Design Brief and Scene modes filter characters by introduction point
    - Deep Analysis mode ignores visibility and sees all characters
    - Characters default to book 1 (immediately available) unless explicitly set otherwise

  3. Important Notes
    - Existing characters default to book_introduced=1 so they remain visible
    - NULL chapter/scene_introduced means "available from start of book"
    - Filtering logic uses: if character.book_introduced > current_book OR
      (same book AND chapter_introduced > current_chapter), character is hidden
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'book_introduced'
  ) THEN
    ALTER TABLE characters ADD COLUMN book_introduced integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'chapter_introduced'
  ) THEN
    ALTER TABLE characters ADD COLUMN chapter_introduced integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'scene_introduced'
  ) THEN
    ALTER TABLE characters ADD COLUMN scene_introduced integer;
  END IF;
END $$;
