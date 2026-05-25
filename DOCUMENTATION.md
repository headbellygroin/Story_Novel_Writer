# Story Forge — Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Services & Settings](#services--settings)
3. [Writing Tools](#writing-tools)
4. [World & Characters](#world--characters)
5. [Consistency & Quality Checks](#consistency--quality-checks)
6. [Production Pipeline](#production-pipeline)
7. [Audiobook](#audiobook)
8. [Export](#export)
9. [Files & Storage](#files--storage)
10. [End-to-End Workflow](#end-to-end-workflow)

---

## Overview

Story Forge is a self-hosted AI novel writing and production studio. It connects to two services running on your AI machine — LM Studio for text generation and ComfyUI for all media generation — and uses a Supabase database to store your project data. Nothing is sent to any third-party AI cloud.

The application covers the full authoring lifecycle: brainstorming, world-building, outlining, scene-by-scene writing with AI assistance, consistency checking, and then a full production pipeline that turns finished chapters into audiobook-style video content.

### The Two Services

**LM Studio — Text Generation (CPU / System RAM)**
Handles all writing and analysis: generating scene content, summarising scenes, building image prompts, running logic audits, analysing reference images, and powering voice chat. Runs on your AI machine and exposes an OpenAI-compatible API on port 1234. Both models run entirely in system RAM (0 GPU layers) so the GPU stays free for ComfyUI.

**ComfyUI — Media Generation (GPU / VRAM)**
Handles all four media types: scene images (Stable Diffusion), animated GIFs (LTX 2.3 Text2Video), TTS narration audio, and lip-sync video (LTX 2.3 LipSync). All four use the same ComfyUI endpoint with built-in workflows — no workflow files to manage. Story Forge sends each job, polls for completion, and retrieves the output file automatically. ComfyUI has exclusive access to the GPU — it never competes with LM Studio for VRAM.

### Recommended Hardware & Models

**Target Hardware:** Intel i7, NVIDIA RTX 5090 (32 GB VRAM), 196 GB DDR5 RAM

| Role | Model | Runs On | RAM Usage | Speed |
|------|-------|---------|-----------|-------|
| Text (Writing) | Midnight-Miqu-70B-v1.5.Q4_K_M | System RAM (CPU) | ~45 GB | ~3-5 tok/s |
| Vision (Image Analysis) | llava-v1.6-mistral-7b (Q5_K_M or Q6_K) | System RAM (CPU) | ~6 GB | ~15-20 tok/s |
| Media Generation | ComfyUI (all workflows) | GPU (VRAM) | Up to 32 GB | Full GPU speed |

**Total RAM used by LM Studio:** ~51 GB of 196 GB available.

**Why this configuration:**

- **Midnight Miqu 70B** — uncensored creative writing model based on Mistral Medium. Excellent prose quality, strong instruction following, 32K context window. No content refusals. At Q4_K_M quantization it fits comfortably in RAM with room to spare.
- **LLaVA v1.6 Mistral 7B** — uncensored vision model for describing reference images. Small enough to load alongside the writing model without meaningful RAM pressure. Fast on CPU for the short image-description tasks it handles.
- **0 GPU layers for both models** — this is critical. The RTX 5090's full 32 GB VRAM is dedicated exclusively to ComfyUI for image generation, animation, TTS, and lip-sync. LM Studio never touches the GPU.

**LM Studio Load Settings:**
1. Set GPU Offload to 0 layers for both models
2. Set context length to 32768 for Midnight Miqu
3. Set context length to 4096 for LLaVA (short context is sufficient for image analysis)
4. Both models can be loaded simultaneously — LM Studio supports multiple models

### Feature Map

| Group | Features |
|-------|----------|
| Planning | Projects, Dossier, Outline |
| World | World Library (Characters, Places, Things, Technologies), Story Bible, Style Anchors, Prohibited Words |
| Writing | Write (scene editor), Voice Chat |
| Quality | Consistency Tracking, Logic Checks |
| Production | Pipeline (5 stages), Audiobook TTS |
| Output | Export (HTML / Markdown / Text), Save & Load (JSON backup) |

---

## Services & Settings

Both services are assumed to be running on your AI machine before you use Story Forge. Go to **Settings** to enter the endpoints and test the connections. All settings are saved per-project to the database.

### LM Studio

- Start LM Studio on your AI machine, load both models (writing + vision), and enable the local server on port 1234.
- Load **Midnight-Miqu-70B-v1.5.Q4_K_M** as your writing model with 0 GPU layers and 32768 context length.
- Load **llava-v1.6-mistral-7b** as your vision model with 0 GPU layers and 4096 context length.
- In Settings, set the **API Endpoint** to `http://your-ai-machine:1234/v1/chat/completions` and the **Model Name** to `Midnight-Miqu-70B-v1.5.Q4_K_M`.
- Set the **Vision Model Name** to `llava-v1.6-mistral-7b`.
- Click **Test AI Connection** to verify. A green dot means Story Forge can reach the server.

> **Context Length** — defaults to 32768, matching Midnight Miqu's context window. Story Forge uses this value to manage how much context is passed to the model during writing and analysis.

> **GPU Offload = 0** — both models must run entirely in system RAM so ComfyUI has exclusive access to the GPU. With 196 GB DDR5, both models use only ~51 GB combined.

### ComfyUI

- Start ComfyUI on your AI machine. It runs at port 8188 by default.
- In Settings, set the **ComfyUI Endpoint** to `http://your-ai-machine:8188`.
- Click **Test ComfyUI**. A successful test also loads your available checkpoints and queue status.
- Select a **Checkpoint** from the dropdown — this is the Stable Diffusion model used for scene image generation.

> **One endpoint, all workflows.** The same ComfyUI endpoint handles images, animation, TTS, and lip-sync. Story Forge sends built-in workflows for each type — you never need to export or paste workflow JSON. The pipeline runs one job at a time and never submits two jobs simultaneously.

### Generation Settings

Beyond the endpoints, Settings lets you tune:

- **LLM parameters** — Temperature, Max Tokens, Top P, Top K, Repetition Penalty, Presence/Frequency Penalty. Sensible defaults work for most models; lower temperature (0.3–0.5) for analysis tasks, higher (0.7–0.9) for creative writing.
- **System Prompt & Style Guide** — A base persona and per-project writing style instructions injected into every generation request.
- **Style Rules** — Toggle switches for common writing guidance (show don't tell, vary sentence length, avoid filter words, etc.). Active rules are injected automatically.
- **Image orientation** — Portrait / Landscape / Square preset, applied to all scene image generation.
- **Image noise seed** — Random (unique image each run) or Fixed (reproducible output from the same prompt).
- **Positive conditioning prompts** — Background, Foreground, and Characters fields that feed the image generation workflow alongside the AI-generated scene prompt.
- **Art Style Presets** — Named presets that override checkpoint, prompt prefix/suffix, negative prompt, sampler, steps, and CFG for different visual styles. Select a preset per scene during image generation.
- **TTS Speaker & Sample Rate** — The voice/speaker name passed to the TTS model, and the output sample rate (default 24000 Hz).
- **Animation prompt fields** — Background and Foreground motion descriptions passed to the LTX animation workflow.
- **Lip-sync orientation & seed** — Output orientation and noise seed for lip-sync video generation.
- **Voice Chat settings** — Browser TTS voice, speech rate, and pitch for in-app voice chat.

---

## Writing Tools

### Projects

Every piece of content in Story Forge belongs to a project. Create a project with a title, genre, and optional description. The active project is shown in the top-right corner of every page — switch projects from there or from the Projects page. All settings, world data, outlines, scenes, and pipeline output are scoped to the active project.

### Dossier

The Dossier is your pre-writing planning tool. Paste a free-form brain dump of your story idea and a list of genre tropes you want to include, then click Generate. The AI produces a structured story dossier covering premise, themes, tone, major characters, and key plot beats. Edit and save the result. The dossier is included in downstream AI context so the model understands what kind of story you're writing.

### Outline

Build your story structure here. Create one or more outlines (e.g. one per story arc) with a title, synopsis, act structure, and themes. Add chapters to each outline with a summary, key events, POV character, and primary setting. Chapters created here appear as options on the Write page and Pipeline page.

### Write

The scene editor is the core of Story Forge. Select a chapter, then a scene within it. The AI generates scene content using a deep context package that includes:

- Story dossier and outline summary
- Active Style Anchors (reference passages)
- Active Prohibited Words
- Active Style Rules
- World Library entries (characters, places, things, technologies)
- Story Bible facts
- Character States for the current scene
- Story Events tracking
- Referenced scenes (scenes you explicitly tag as context)
- Scene Brief (what should happen in this scene)
- Context tags (custom tags to focus generation)

The right sidebar gives access to: Scene Brief, Context Tags, Scene Summary, Scene Image (attach or generate a ComfyUI image for the scene), Editing Passes (AI-assisted refinement passes like "tighten pacing" or "strengthen dialogue"), and Scene References.

> You can also paste pre-written text directly into the editor. The AI generation features are optional — you can use Story Forge as a structured editor for existing writing and still run the full production pipeline.

### Voice Chat

An interactive voice assistant for discussing your story. Uses browser speech recognition to capture your voice and browser TTS to speak responses. Configure the response voice, rate, and pitch in Settings. The AI has full access to your project context and can answer questions, brainstorm ideas, or help work through plot problems.

---

## World & Characters

### World Library

The central database for everything that exists in your story's world. Divided into four entity types:

**Characters**
Physical description, personality, background, role, relationships, motivations, secrets. Includes Hero's Journey stage tracking (which narrative arc stage each character is in) and personality sliders (introversion/extroversion, chaotic/lawful, etc.) that influence how the AI writes them.

**Places**
Name, type, physical description, history, atmosphere, significance. Used to ground scene generation in the correct setting.

**Things**
Objects, artefacts, weapons, vehicles, and other significant items. Includes properties, origin, and current ownership.

**Technologies**
Magic systems, technologies, scientific concepts, or any other rules-based system. Includes how it works, its limits, and who can use it.

Any entity can have a reference image attached. The image is uploaded to Supabase Storage and can be analysed by the vision model to automatically extract descriptions.

### Story Bible

Canonical facts that the AI must always know and respect. Each fact has a category (Character, World Rule, Timeline, Relationship, Plot Point, General), an importance level (Critical, High, Medium, Low), and optional tags. Active Story Bible entries are injected into every generation prompt. Use this for hard rules: "magic cannot bring the dead back to life", "the war ended in Year 412", "Elena is left-handed".

### Style Anchors

Reference passages that define the writing voice you want. Paste excerpts from your own writing, a published author you're emulating, or AI-generated passages you liked. Mark up to 2–3 anchors as active — they are included in every AI writing prompt so the model matches the style.

### Prohibited Words

A blocklist of words and phrases the AI must not use. Includes a one-click loader for a curated preset of common AI writing tics (e.g. "tapestry of", "in the realm of", "a testament to"), genre clichés, and overused words. Organise entries by category: AI-isms, Clichés, Overused, or Custom. All active prohibited words are injected into every writing prompt.

---

## Consistency & Quality Checks

### Consistency Tracking

Three tools for maintaining continuity across a long story:

**Story Events**
A log of important plot events that have happened, tagged by chapter. The AI can reference these during generation to avoid contradicting established events or repeating them.

**Character States**
Track how a character's physical condition, emotional state, and knowledge change from scene to scene. Each state entry specifies which chapter it applies to. The AI uses the most recent applicable state when writing a character.

**Scene References**
Tag specific earlier scenes that the current scene should be aware of. These scenes are included in full as context when generating the current scene — useful for callbacks, consequences, or continuity-critical moments.

### Logic Checks

An AI-powered audit tool. Select what to audit — Dossier, Outline/Synopsis, a specific Chapter, Characters, or Worldbuilding — and the AI reads the relevant content and produces a detailed report highlighting logical inconsistencies, internal contradictions, plot holes, timeline problems, and character behaviour inconsistencies. Previous audit reports are stored and can be reviewed at any time.

> Logic Checks consume significant context. Use a model with a large context window (32K+) for best results, especially when auditing full chapters.

---

## Production Pipeline

The Pipeline page converts a finished chapter into all the media assets needed for an audiobook-style video. It runs five stages in order. Each stage submits jobs to ComfyUI one at a time, monitors them automatically, and retrieves the output files when they finish. **You watch Story Forge's progress bar — not the ComfyUI UI.**

### How Job Monitoring Works

When Story Forge sends a job to ComfyUI it does the following without any manual input:

1. **Submits the workflow** — sends the built-in workflow JSON (with your prompts, settings, and image/audio references injected) to ComfyUI's `/prompt` endpoint. ComfyUI returns a `prompt_id`.
2. **Polls for completion** — repeatedly queries ComfyUI's `/history/{prompt_id}` endpoint until the job shows `completed: true`. You will see the ComfyUI output panel show the job running and then completing.
3. **Retrieves the output file** — reads the filename from the history response and constructs the `/view?filename=...&type=output` URL. Saves this URL to the database.
4. **Moves to the next item** — submits the next image/chunk and repeats. Only one job is in ComfyUI's queue at any time.

While a stage is running you will see: *"Generating image 3 of 8..."* with a progress bar and a live item counter. When all items are done, the stage button disappears and the next stage's button appears. This is your cue to review and then proceed.

You can optionally watch the ComfyUI output panel on your AI machine to see the actual generation happening in real time — useful for debugging if something stalls or produces bad results. But you do not need to interact with ComfyUI at all during a normal run.

> **If a job stalls:** check the ComfyUI output panel on your AI machine. If ComfyUI shows an error node (red border), the workflow has a problem. Fix it in Settings or restart ComfyUI. Story Forge will surface the error and stop the stage.

---

### Stage 1 — Analyse & Generate Images
**Tool: LM Studio + ComfyUI (NetaYume Lumina workflow)**

**What happens:** The LLM reads your full chapter text and identifies 3–12 key visual moments — dramatic reveals, location introductions, action peaks, emotional beats. For each moment it writes a detailed Stable Diffusion prompt and a short animation description. Then ComfyUI generates the images one at a time using the built-in NetaYume Lumina workflow with your configured checkpoint, orientation, and conditioning prompts.

**Story Forge shows:** *"Analyzing chapter for visual moments..."* then *"Generating image 1 of N..."* through *"Generating image N of N."*

**ComfyUI output panel shows:** Each image job appearing in the queue, rendering progress, then completing. One job at a time.

**When done:** The image grid appears. Review all images. If any are wrong, click **New Run** to start over — this discards the current run's images and begins fresh.

**Review gate:** The Stage 2 button only appears after Stage 1 completes. You decide when to proceed.

---

### Stage 2 — Animate Images *(Optional)*
**Tool: ComfyUI (LTX 2.3 Text2Video workflow)**

**What happens:** Each generated scene image is sent to ComfyUI's LTX 2.3 Text2Video workflow along with the animation description the LLM wrote in Stage 1. ComfyUI produces a short animated GIF (30 fps, 5 seconds) with subtle motion — flickering light, swaying foliage, atmospheric haze, gentle character breathing.

**Story Forge shows:** *"Animating image 1 of N..."* through completion. When done, a **Show animated** toggle appears on the image grid so you can compare the still and animated versions.

**ComfyUI output panel shows:** Each video generation job — these are slower than image jobs (typically 30–90 seconds each depending on your GPU).

**When done:** Toggle the animated view on the image grid to review. This stage is **optional** — if you skip it, the assembly data will use still images instead.

**Review gate:** Stage 3 is available whether or not you run Stage 2. You can proceed directly to TTS from Stage 1's review.

---

### Stage 3 — Generate TTS Audio
**Tool: ComfyUI (built-in TTS workflow)**

**What happens:** The chapter text is split at sentence boundaries into chunks of approximately 1000 characters. Each chunk is sent to ComfyUI's TTS workflow with your configured speaker voice and sample rate. Each chunk produces a separate audio file (wav/mp3/flac). The pipeline tracks which text passage each audio file corresponds to — this mapping is used in the assembly export and lip-sync stage.

**Story Forge shows:** *"Generating TTS chunk 1 of N..."* and a secondary progress bar showing how many chunks have completed out of the total.

**ComfyUI output panel shows:** Each TTS job — typically fast (5–20 seconds per chunk).

**When done:** Listen to the audio chunks in the pipeline interface to check quality. Look for mispronounced character or place names. If needed, edit the phonetic spelling in the chapter text and re-run this stage.

**Review gate:** Stages 4 and 5 both become available once at least one TTS chunk is completed.

---

### Stage 4 — Export Assembly Data
**Tool: Local export — no ComfyUI job**

**What happens:** Story Forge builds a structured JSON file from the data already in the database and triggers a browser download. No ComfyUI job is submitted. The file contains:

- **images array** — each image's URL (animated GIF if available, otherwise still), its order index, and the text anchor phrase that marks where it should appear on screen
- **audio array** — each TTS chunk's URL, its text content, and its order index
- **chapterLabel** — e.g. "Chapter 01"

**How to use it:** Feed this JSON into your video assembly tool. When the narration reaches a text anchor phrase, switch the displayed image to the corresponding one. The audio timeline gives you all the clip URLs in order to concatenate.

**Note:** This button is available any time after Stage 3 is started. You can re-download it at any point.

---

### Stage 5 — Lip-sync Generation
**Tool: ComfyUI (LTX 2.3 LipSync workflow)**

**What happens:** You paste the URL of a character face image (front-facing, ideally from the World Library or a ComfyUI-generated image). Story Forge takes each completed TTS audio chunk and submits a lip-sync job to ComfyUI pairing the character image with that audio. ComfyUI generates a video of the character's mouth moving in sync with the speech.

**Output naming:** Each clip is named sequentially — `ch01_lipsync_001.mp4`, `ch01_lipsync_002.mp4`, etc. These names appear in the Lip-sync Chunks list in the Pipeline UI and in `ComfyUI/output/`. Use this order to stitch clips in your external tool.

**Story Forge shows:** *"Generating lip-sync 1 of N (ch01_lipsync_001.mp4)..."* for each clip.

**ComfyUI output panel shows:** Each lip-sync video job — these are the slowest jobs (60–180 seconds each depending on audio length and GPU).

**When done:** The Lip-sync Chunks list shows all clip URLs in order. Download or copy them and stitch sequentially in your video editor.

**Review gate:** You can re-run lip-sync at any time (e.g. with a different character image) without re-running earlier stages. The previous lip-sync chunks are discarded and replaced.

---

### Pipeline Warnings

> **Never clear ComfyUI/output/ between stages.** Stage 2 reads Stage 1's image files. Stage 5 reads Stage 3's audio files. Deleting anything from the output folder will break those references and the stage will error when it tries to read the missing file.

> **Never run two pipeline stages at the same time.** Story Forge sends one job at a time and waits for each to finish before sending the next. Starting a new stage while one is running will submit conflicting jobs to ComfyUI and corrupt the output.

> **New Run.** The *New Run* button creates a fresh pipeline run for the same chapter, discarding all previous images and lip-sync data. TTS chunks are NOT discarded — they persist and can be reused in the new run's lip-sync stage without re-generating audio.

### Watching ComfyUI During a Run

You do not need to interact with the ComfyUI web UI during a pipeline run — Story Forge handles everything automatically. But keeping a browser tab open to your ComfyUI instance (`http://your-ai-machine:8188`) is useful for:

- **Seeing real-time render progress** — the output panel shows the image forming as it renders, which lets you catch bad outputs early.
- **Spotting stalled jobs** — if Story Forge's progress bar hasn't moved in several minutes, check the ComfyUI queue. If the queue is empty but Story Forge is still "running", a network issue may have caused the poll to hang. Refresh Story Forge to recover.
- **Identifying workflow errors** — if a node shows a red error border in ComfyUI, the workflow failed. Story Forge will surface the error message and stop the stage.
- **Checking queue depth** — the queue status indicator in Settings (after testing the connection) shows how many jobs are pending. This should always be 0 or 1 during a Story Forge run.

> The ComfyUI output panel is read-only during a Story Forge run. Do not queue additional jobs from the ComfyUI UI while a pipeline stage is running, as this can cause Story Forge to retrieve the wrong output file.

---

## Audiobook

The Audiobook page provides standalone TTS generation outside the Pipeline. Select a chapter, and Story Forge splits the text into sentence-boundary chunks and lets you generate audio for each chunk individually or all at once via ComfyUI's TTS workflow.

Each chunk's audio URL is saved to the database once generated. You can preview playback inline. This page is useful for narrating chapters that aren't going through the full production pipeline, or for re-generating specific chunks with different voice settings.

> The same TTS workflow and speaker/sample-rate settings from the Settings page are used here. Change the speaker or sample rate in Settings before generating if you want a different voice.

---

## Export

Export your finished story in three formats:

**HTML**
A styled, self-contained HTML document. Scene images can be embedded as base64 data (no external dependencies) or linked by URL. Suitable for reading in a browser or sharing as a single file.

**Markdown**
Standard Markdown with image references. Compatible with Obsidian, Notion, GitHub, and most writing tools that accept Markdown.

**Plain Text**
Clean text only, no formatting or images. Useful for pasting into publishing platforms or further processing.

All formats let you choose whether to include scene images and scene descriptions/notes. A preview is shown before downloading.

### Save & Load (JSON Backup)

The Save/Load page exports the entire project as a JSON file — all scenes, chapters, characters, world elements, story bible, settings, and dossier. Use this to back up your work, transfer a project between machines, or restore from a previous state. Generated media files (images, audio, video) are not included in the backup, only the text data and URLs.

> Importing a backup creates a new project. It does not overwrite an existing one.

---

## Files & Storage

All media generated by ComfyUI (images, animated GIFs, TTS audio, lip-sync video) is saved to ComfyUI's output directory on your AI machine. Story Forge never copies these files — it stores the URL that points to each file through ComfyUI's HTTP server.

| Content | Location |
|---------|----------|
| Scene images | `ComfyUI/output/` |
| Animated GIFs | `ComfyUI/output/` |
| TTS audio | `ComfyUI/output/` |
| Lip-sync video | `ComfyUI/output/` |
| Entity reference images | Supabase Storage (cloud) |
| All text data | Supabase database (cloud) |

### URL Format

Every ComfyUI-generated file is accessed via ComfyUI's `/view` endpoint:

```
http://your-ai-machine:8188/view?filename=ComfyUI_00001_.png&subfolder=&type=output
```

> **Never clear ComfyUI/output/ mid-pipeline.** The animation, TTS, and lip-sync stages depend on files produced by earlier stages. Deleting output files breaks those references permanently.

> **Keep ComfyUI running while working.** Files are served through ComfyUI's HTTP server. If ComfyUI stops, images and audio will not display in Story Forge — but the files remain on disk and will work again once ComfyUI restarts.

> **Lip-sync filenames.** The Pipeline page tracks the expected output filename for each lip-sync chunk (e.g. `ch01_lipsync_001.mp4`). Use these names to stitch clips together in the correct order in your external video tool.

---

## End-to-End Workflow

Complete walkthrough from a blank project to a finished audiobook video chapter.

### 1 — Project Setup

1. Create a project (Projects page) with title, genre, and description.
2. Go to Settings, enter your LM Studio and ComfyUI endpoints, and test both connections.
3. Select your ComfyUI checkpoint and configure image orientation and conditioning prompts.
4. Set your TTS speaker voice and sample rate.

### 2 — World Building

1. Add your main characters in the World Library with physical descriptions, personalities, and backstory.
2. Add key places, important objects, and any magic/technology systems.
3. Add canonical facts to the Story Bible — rules the AI must never break.
4. Paste reference writing passages into Style Anchors and activate 1–3.
5. Load the prohibited words preset and add any project-specific terms to avoid.

### 3 — Planning

1. Open the Dossier page, paste your story brain dump and genre tropes, and generate the dossier.
2. Build your outline — create chapters with summaries, key events, POV character, and setting.

### 4 — Writing

1. Open the Write page, select a chapter and scene.
2. Fill in the Scene Brief (what needs to happen), then generate content.
3. Edit the generated text directly in the editor.
4. Use the Editing Passes sidebar to run targeted refinement passes (pacing, dialogue, description, etc.).
5. Attach a scene image if desired — either generate one via ComfyUI or upload your own.
6. Update Character States and Story Events on the Consistency page as the story progresses.
7. Repeat for each scene until the chapter is complete.

### 5 — Quality Review

1. Run a Logic Check on the chapter to catch inconsistencies or continuity errors.
2. Fix any identified issues in the Write page.
3. Re-run the check until it passes cleanly.

### 6 — Production Pipeline

1. Open the Pipeline page and select the finished chapter.
2. Stage 1: Generate Images — review all images before continuing.
3. Stage 2: Animate Images — review animations, or skip if you prefer stills.
4. Stage 3: Generate TTS Audio — listen to all chunks for quality.
5. Stage 4: Export Assembly Data — download the JSON for video assembly.
6. Stage 5: Generate Lip-sync — select a character face image, generate all clips.
7. Stitch the lip-sync clips together in filename order using an external video tool.

### 7 — Final Assembly (External)

1. Use the Assembly Data JSON to drive scene image changes in sync with the narration.
2. Place the scene video (images + audio) in a smaller overlay window.
3. Place the stitched lip-sync video in the main frame.
4. Mute the overlay video — the lip-sync carries the same TTS audio.
5. Add chapter title cards, intro/outro, and background music as desired.
6. Export and upload to YouTube.

---

### Using Pre-Written Stories

You can run the full production pipeline on an existing story without using the AI writing tools:

1. Create a project and an outline with chapters matching your story's structure.
2. On the Write page, paste your existing text into each scene's content field.
3. Run the Pipeline — the LLM analyses your text exactly as it would for AI-written content.
