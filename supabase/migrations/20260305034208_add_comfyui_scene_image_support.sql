/*
  # Add ComfyUI Scene-to-Image Support

  1. Modified Tables
    - `scenes`
      - `generated_image_url` (text) - URL/path of the generated scene image
      - `image_prompt` (text) - The prompt used to generate the image
    - `generation_settings`
      - `comfyui_endpoint` (text) - ComfyUI server URL (default http://127.0.0.1:8188)
      - `comfyui_workflow` (jsonb) - Custom ComfyUI workflow JSON (API format)
      - `comfyui_checkpoint` (text) - Stable Diffusion checkpoint model name
      - `image_width` (integer) - Generated image width (default 768)
      - `image_height` (integer) - Generated image height (default 512)
      - `image_steps` (integer) - Sampling steps (default 25)
      - `image_cfg_scale` (numeric) - CFG scale for guidance (default 7.0)
      - `image_sampler` (text) - Sampler name (default euler_ancestral)
      - `image_negative_prompt` (text) - Default negative prompt

  2. Security
    - No RLS changes needed (existing policies cover these tables)

  3. Notes
    - Scene images are stored as base64 data or fetched from ComfyUI output
    - ComfyUI workflow JSON allows users to paste their own exported workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'generated_image_url'
  ) THEN
    ALTER TABLE scenes ADD COLUMN generated_image_url text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'image_prompt'
  ) THEN
    ALTER TABLE scenes ADD COLUMN image_prompt text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_endpoint'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_endpoint text DEFAULT 'http://127.0.0.1:8188';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_workflow'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_workflow jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'comfyui_checkpoint'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN comfyui_checkpoint text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_width'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_width integer DEFAULT 768;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_height'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_height integer DEFAULT 512;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_steps'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_steps integer DEFAULT 25;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_cfg_scale'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_cfg_scale numeric DEFAULT 7.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_sampler'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_sampler text DEFAULT 'euler_ancestral';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'image_negative_prompt'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN image_negative_prompt text DEFAULT 'text, watermark, signature, blurry, low quality, deformed, ugly, bad anatomy, extra limbs';
  END IF;
END $$;
