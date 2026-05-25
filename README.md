# Story Forge

AI-powered novel writing and production studio. Write with uncensored local models, generate illustrations, create audiobook narration, and produce YouTube-ready litRPG content -- all from one workspace.

## What It Does

Story Forge is a self-hosted creative writing platform that connects to LM Studio (text generation) and ComfyUI (media generation) running on your local machine. Nothing is sent to cloud AI services.

**Writing** -- Build your world, outline chapters, and write scene-by-scene with context-aware AI that understands your characters, settings, plot rules, and writing style.

**Production** -- Convert finished chapters into audiobook-style video content through a 5-stage pipeline: scene image generation, image animation, TTS narration, audio assembly, and lip-sync video.

## Architecture

```
Story Forge (browser)
    |
    |--- LM Studio (CPU / System RAM)
    |       Writing model: Midnight-Miqu-70B-v1.5.Q4_K_M (~45 GB)
    |       Vision model:  llava-v1.6-mistral-7b (~6 GB)
    |
    |--- ComfyUI (GPU / VRAM)
    |       Images:     NetaYume Lumina / Flux
    |       Animation:  LTX 2.3 Text2Video
    |       TTS:        Kokoro TTS
    |       Lip-sync:   LTX 2.3 LipSync Portrait
    |
    |--- Supabase (database + file storage)
```

LM Studio runs entirely in system RAM (0 GPU layers). ComfyUI has exclusive access to the GPU.

## Target Hardware

- Intel i7 (or equivalent)
- NVIDIA RTX 5090 (32 GB VRAM)
- 196 GB DDR5 RAM

LM Studio uses ~51 GB RAM total. The remaining 145 GB is available for the OS and other applications.

## Features

### Writing Suite
- Project management with per-project settings
- World Library (characters with 15 personality sliders + Hero's Journey tracking, places, things, technologies)
- Entity image upload with AI vision analysis
- Story Bible (canonical facts with importance-based priority)
- Story Dossier (AI-generated story planning)
- Outline builder (outlines, chapters, POV/setting assignment)
- Scene editor with AI generation using deep context (12+ data sources)
- Context Tags (tag which entities are relevant per scene)
- Scene Briefs (10-field structured planning)
- Editing Passes (AI improvement plan + implementation)
- Scene Summaries (efficient distant context)
- Style Anchors (reference writing passages)
- Style Rules (7 toggleable writing rules)
- Prohibited Words (46 default AI-isms/cliches + custom)
- Voice Chat (speech I/O for brainstorming)

### Consistency & Quality
- Story Events (importance-ranked, character-linked)
- Character States (5 dimensions per scene)
- Scene References (6 reference types, color-coded)
- Logic Checks (AI audits for dossier, outline, chapter, character, worldbuilding)

### Production Pipeline
- Stage 1: LLM-driven visual moment analysis + ComfyUI image generation
- Stage 2: Image animation via LTX 2.3 Text2Video (optional)
- Stage 3: TTS narration via Kokoro (sentence-boundary chunking)
- Stage 4: Audio assembly (Web Audio API concatenation) + video manifest export
- Stage 5: Lip-sync video via LTX 2.3 LipSync Portrait

### Audiobook (Standalone)
- Chapter-based TTS generation outside the pipeline
- 10 Kokoro voice profiles, adjustable speed
- Per-chunk generate/redo, Play All, Download All

### Export
- HTML (styled, self-contained with optional embedded images)
- Markdown (GitHub-flavored)
- Plain Text
- JSON backup/restore (full project with ID remapping)

## Prerequisites

1. **LM Studio** -- running on your AI machine with both models loaded and local server enabled on port 1234
2. **ComfyUI** -- running on your AI machine on port 8188 with required models/nodes installed
3. **Supabase** -- database provisioned (connection details in `.env`)

## Getting Started

```bash
npm install
npm run dev
```

1. Open the app in your browser
2. Go to Settings, enter your LM Studio and ComfyUI endpoints
3. Test both connections (green dots confirm connectivity)
4. Create a project and start writing

See `DOCUMENTATION.md` for the full setup guide and feature documentation.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Supabase (database + storage)
- React Router v6

## Project Structure

```
src/
  pages/          -- 18 page components (one per route)
  components/     -- Reusable UI components
    consistency/  -- Story events, character states, scene references
    pipeline/     -- Image grid, lip-sync chunks, stage indicator
    write/        -- Scene brief, context tags, editing pass, image, summary panels
  services/       -- API integrations (AI, ComfyUI, vision, TTS, pipeline, export, backup)
  store/          -- Zustand global state (active project/outline)
  lib/            -- Constants (style rules, personality sliders, art presets, prohibited words)
  workflows/      -- ComfyUI workflow JSON files
supabase/
  migrations/     -- Database schema migrations
  functions/      -- Edge functions (image analysis proxy)
```
