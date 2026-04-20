/*
  # Add Animation and Lip-sync Workflow Settings

  Adds new columns to `generation_settings` for:
  1. ComfyUI animation workflow (for animating still images)
  2. ComfyUI lip-sync workflow (for generating lip-sync videos)

  ## Modified Tables
  - `generation_settings`
    - `comfyui_animation_workflow` (jsonb) - ComfyUI API-format workflow for image animation
    - `comfyui_lipsync_workflow` (jsonb) - ComfyUI API-format workflow for lip-sync generation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_animation_workflow'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_animation_workflow jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_lipsync_workflow'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_lipsync_workflow jsonb;
  END IF;
END $$;
