/*
  # Add style rules column to generation settings

  1. Modified Tables
    - `generation_settings`
      - `style_rules` (jsonb) - Stores togglable style rules as key-value pairs (rule_id -> boolean)
        Example: {"avoid_adverbs": true, "show_dont_tell": false}

  2. Notes
    - Uses JSONB for flexible rule storage without schema changes for new rules
    - Defaults to empty object so no rules are active by default
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'style_rules'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN style_rules jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
