/*
  # Add animation user-input fields to generation_settings

  Adds the following columns to support the "Animate Image" feature:
    - `animation_describe_prompt` — "Describe the image" field, sent with prefix
    - `animation_action_prompt`   — "What needs to be animated" field, sent with prefix
    - `animation_orientation`     — portrait / landscape / square (same as image generation)
    - `animation_noise_mode`      — random or fixed seed
    - `animation_noise_seed`      — fixed seed value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'animation_describe_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN animation_describe_prompt text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'animation_action_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN animation_action_prompt text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'animation_orientation'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN animation_orientation text DEFAULT 'portrait';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'animation_noise_mode'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN animation_noise_mode text DEFAULT 'random';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'animation_noise_seed'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN animation_noise_seed bigint DEFAULT 42;
  END IF;
END $$;
