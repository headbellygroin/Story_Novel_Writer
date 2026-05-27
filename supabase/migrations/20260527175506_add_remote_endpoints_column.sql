/*
  # Add remote endpoints for multi-machine access

  1. Modified Tables
    - `generation_settings`
      - `remote_api_endpoint` (text) - Tailscale/remote IP version of the LM Studio endpoint
      - `remote_comfyui_endpoint` (text) - Tailscale/remote IP version of the ComfyUI endpoint

  2. Purpose
    - Allows storing both local (127.0.0.1/localhost) and remote (Tailscale IP) endpoints
    - App auto-detects which to use based on network reachability
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'remote_api_endpoint'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN remote_api_endpoint text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generation_settings' AND column_name = 'remote_comfyui_endpoint'
  ) THEN
    ALTER TABLE generation_settings ADD COLUMN remote_comfyui_endpoint text DEFAULT '';
  END IF;
END $$;
