/*
  # Add Advanced Generation Settings

  ## Overview
  Add advanced parameters for uncensored local models to generation_settings table.

  ## Modifications

  ### Update `generation_settings` table
  - Add `top_p` (nucleus sampling)
  - Add `top_k` (top-k sampling)
  - Add `repetition_penalty` (prevent repetition)
  - Add `presence_penalty` (encourage new topics)
  - Add `frequency_penalty` (reduce word frequency)
  - Add `context_length` (max context window)
  - Add `stop_sequences` (custom stop sequences)

  ## Notes
  - These parameters give fine control over uncensored local models
  - Helpful for creative writing where default settings may be too conservative
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'top_p'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN top_p numeric DEFAULT 0.9;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'top_k'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN top_k integer DEFAULT 40;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'repetition_penalty'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN repetition_penalty numeric DEFAULT 1.1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'presence_penalty'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN presence_penalty numeric DEFAULT 0.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'frequency_penalty'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN frequency_penalty numeric DEFAULT 0.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'context_length'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN context_length integer DEFAULT 4096;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'stop_sequences'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN stop_sequences text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;