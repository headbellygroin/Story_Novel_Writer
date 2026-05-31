/*
  # Add notes column to model_presets and support additional task modes

  1. Modified Tables
    - `model_presets`
      - Add `notes` (text) - reminder text about what this preset is for
  
  2. Notes
    - Adds a notes/reminder field so users can annotate why a preset uses specific settings
    - The task_mode values now include: design_brief, tag_recommendation, outline, scene, rewrite, utility, vision, vision_quick
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_presets' AND column_name = 'notes'
  ) THEN
    ALTER TABLE model_presets ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;
END $$;
