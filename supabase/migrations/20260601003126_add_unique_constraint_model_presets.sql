/*
  # Add unique constraint to model_presets

  1. Changes
    - Adds a unique constraint on (project_id, task_mode) to prevent duplicate presets
    - This ensures only one preset per task mode per project can exist

  2. Important Notes
    - Duplicate rows were previously possible due to missing constraint
    - The "Load Default Presets" function now deletes before re-inserting
*/

CREATE UNIQUE INDEX IF NOT EXISTS model_presets_project_task_unique
  ON model_presets (project_id, task_mode);
