/*
  # Add Canonical Confidence Status to All Entity Tables

  1. Modified Tables
    - `characters` - adds `canon_status` (text, default 'draft')
    - `places` - adds `canon_status` (text, default 'draft')
    - `things` - adds `canon_status` (text, default 'draft')
    - `technologies` - adds `canon_status` (text, default 'draft')
    - `story_bible_entries` - adds `canon_status` (text, default 'draft')

  2. Purpose
    - Allows writers to tag each world entry with a confidence level:
      - 'canon' = immutable, locked-in lore
      - 'stable' = likely permanent, but could adjust
      - 'draft' = actively evolving
      - 'experimental' = brainstorming, may be discarded
      - 'deprecated' = old lore, no longer active
    - The AI context system uses this to weight entries appropriately
      (canon/stable entries take priority over draft/experimental)
    - Prevents accidentally writing against brainstorm-tier lore as if it were fact

  3. Notes
    - Default is 'draft' so existing entries start in the safest state
    - No data loss -- purely additive change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'canon_status'
  ) THEN
    ALTER TABLE characters ADD COLUMN canon_status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'canon_status'
  ) THEN
    ALTER TABLE places ADD COLUMN canon_status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'things' AND column_name = 'canon_status'
  ) THEN
    ALTER TABLE things ADD COLUMN canon_status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technologies' AND column_name = 'canon_status'
  ) THEN
    ALTER TABLE technologies ADD COLUMN canon_status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'story_bible_entries' AND column_name = 'canon_status'
  ) THEN
    ALTER TABLE story_bible_entries ADD COLUMN canon_status text DEFAULT 'draft';
  END IF;
END $$;
