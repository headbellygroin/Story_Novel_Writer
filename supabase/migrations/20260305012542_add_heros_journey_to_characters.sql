/*
  # Add Hero's Journey fields to characters

  1. Modified Tables
    - `characters`
      - `ordinary_world` (text) - Character's life before the story begins, their normal state
      - `call_to_adventure` (text) - The inciting event or challenge that disrupts the ordinary world
      - `refusal_of_call` (text) - Initial hesitation, fear, or reason the character resists the call
      - `meeting_the_mentor` (text) - The guide, ally, or force that prepares them for the journey
      - `crossing_threshold` (text) - The point of no return where the character commits to the journey
      - `tests_allies_enemies` (text) - Challenges faced, alliances formed, and adversaries encountered
      - `approach_innermost_cave` (text) - Preparation for the central ordeal, deepest fears confronted
      - `ordeal` (text) - The major crisis or central conflict the character must face
      - `reward` (text) - What the character gains from surviving the ordeal
      - `road_back` (text) - Complications on the return journey, pursuit or consequences
      - `resurrection` (text) - The final test where everything is at stake, transformation completed
      - `return_with_elixir` (text) - How the character returns changed and what they bring back to their world

  2. Important Notes
    - All fields are optional text columns with empty string defaults
    - No data loss -- only adding new columns
    - No security changes needed, existing RLS policies cover these columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'ordinary_world'
  ) THEN
    ALTER TABLE characters ADD COLUMN ordinary_world text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'call_to_adventure'
  ) THEN
    ALTER TABLE characters ADD COLUMN call_to_adventure text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'refusal_of_call'
  ) THEN
    ALTER TABLE characters ADD COLUMN refusal_of_call text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'meeting_the_mentor'
  ) THEN
    ALTER TABLE characters ADD COLUMN meeting_the_mentor text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'crossing_threshold'
  ) THEN
    ALTER TABLE characters ADD COLUMN crossing_threshold text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'tests_allies_enemies'
  ) THEN
    ALTER TABLE characters ADD COLUMN tests_allies_enemies text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'approach_innermost_cave'
  ) THEN
    ALTER TABLE characters ADD COLUMN approach_innermost_cave text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'ordeal'
  ) THEN
    ALTER TABLE characters ADD COLUMN ordeal text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'reward'
  ) THEN
    ALTER TABLE characters ADD COLUMN reward text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'road_back'
  ) THEN
    ALTER TABLE characters ADD COLUMN road_back text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'resurrection'
  ) THEN
    ALTER TABLE characters ADD COLUMN resurrection text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'return_with_elixir'
  ) THEN
    ALTER TABLE characters ADD COLUMN return_with_elixir text NOT NULL DEFAULT '';
  END IF;
END $$;