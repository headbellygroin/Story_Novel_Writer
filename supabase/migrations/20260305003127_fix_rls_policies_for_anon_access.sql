/*
  # Fix RLS Policies for Anonymous Access

  The app uses the Supabase anon key (no auth), so all existing policies
  that target `authenticated` are inaccessible. This migration adds
  policies for the `anon` role on every table so the app can read and write data.

  1. Changes
    - Add SELECT, INSERT, UPDATE, DELETE policies for `anon` on all existing tables
    - Add SELECT, INSERT, UPDATE, DELETE policies for `anon` on new tables:
      scene_summaries, story_bible_entries, style_anchors, scene_context_tags

  2. Security Note
    - These policies allow full anon access because the app has no authentication.
    - When auth is added later, these should be replaced with user-scoped policies.
*/

-- projects
CREATE POLICY "Anon can view projects" ON projects FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create projects" ON projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update projects" ON projects FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete projects" ON projects FOR DELETE TO anon USING (true);

-- characters
CREATE POLICY "Anon can view characters" ON characters FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create characters" ON characters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update characters" ON characters FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete characters" ON characters FOR DELETE TO anon USING (true);

-- places
CREATE POLICY "Anon can view places" ON places FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create places" ON places FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update places" ON places FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete places" ON places FOR DELETE TO anon USING (true);

-- things
CREATE POLICY "Anon can view things" ON things FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create things" ON things FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update things" ON things FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete things" ON things FOR DELETE TO anon USING (true);

-- technologies
CREATE POLICY "Anon can view technologies" ON technologies FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create technologies" ON technologies FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update technologies" ON technologies FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete technologies" ON technologies FOR DELETE TO anon USING (true);

-- outlines
CREATE POLICY "Anon can view outlines" ON outlines FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create outlines" ON outlines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update outlines" ON outlines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete outlines" ON outlines FOR DELETE TO anon USING (true);

-- chapters
CREATE POLICY "Anon can view chapters" ON chapters FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create chapters" ON chapters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update chapters" ON chapters FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete chapters" ON chapters FOR DELETE TO anon USING (true);

-- scenes
CREATE POLICY "Anon can view scenes" ON scenes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create scenes" ON scenes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update scenes" ON scenes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete scenes" ON scenes FOR DELETE TO anon USING (true);

-- generation_settings
CREATE POLICY "Anon can view generation_settings" ON generation_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create generation_settings" ON generation_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update generation_settings" ON generation_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete generation_settings" ON generation_settings FOR DELETE TO anon USING (true);

-- story_events
CREATE POLICY "Anon can view story_events" ON story_events FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create story_events" ON story_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update story_events" ON story_events FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete story_events" ON story_events FOR DELETE TO anon USING (true);

-- character_states
CREATE POLICY "Anon can view character_states" ON character_states FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create character_states" ON character_states FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update character_states" ON character_states FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete character_states" ON character_states FOR DELETE TO anon USING (true);

-- scene_references
CREATE POLICY "Anon can view scene_references" ON scene_references FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create scene_references" ON scene_references FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update scene_references" ON scene_references FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete scene_references" ON scene_references FOR DELETE TO anon USING (true);

-- scene_summaries
CREATE POLICY "Anon can view scene_summaries" ON scene_summaries FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create scene_summaries" ON scene_summaries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update scene_summaries" ON scene_summaries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete scene_summaries" ON scene_summaries FOR DELETE TO anon USING (true);

-- story_bible_entries
CREATE POLICY "Anon can view story_bible_entries" ON story_bible_entries FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create story_bible_entries" ON story_bible_entries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update story_bible_entries" ON story_bible_entries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete story_bible_entries" ON story_bible_entries FOR DELETE TO anon USING (true);

-- style_anchors
CREATE POLICY "Anon can view style_anchors" ON style_anchors FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create style_anchors" ON style_anchors FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update style_anchors" ON style_anchors FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete style_anchors" ON style_anchors FOR DELETE TO anon USING (true);

-- scene_context_tags
CREATE POLICY "Anon can view scene_context_tags" ON scene_context_tags FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can create scene_context_tags" ON scene_context_tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update scene_context_tags" ON scene_context_tags FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete scene_context_tags" ON scene_context_tags FOR DELETE TO anon USING (true);