# Story Forge -- Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Hardware & Model Configuration](#hardware--model-configuration)
3. [Services & Settings](#services--settings)
4. [Writing Tools](#writing-tools)
5. [World & Characters](#world--characters)
6. [Consistency & Quality Checks](#consistency--quality-checks)
7. [Production Pipeline](#production-pipeline)
8. [Audiobook](#audiobook)
9. [Export](#export)
10. [Files & Storage](#files--storage)
11. [End-to-End Workflow](#end-to-end-workflow)
12. [Context Assembly Architecture](#context-assembly-architecture)

---

## Overview

Story Forge is a self-hosted AI novel writing and production studio. It connects to two services running on your AI machine -- LM Studio for text generation and ComfyUI for all media generation -- and uses a Supabase database to store your project data. Nothing is sent to any third-party AI cloud.

The application covers the full authoring lifecycle: brainstorming, world-building, outlining, scene-by-scene writing with AI assistance, consistency checking, and then a full production pipeline that turns finished chapters into audiobook-style video content suitable for YouTube upload.

### Architecture: CPU vs GPU Split

Story Forge separates workloads by hardware:

- **LM Studio (CPU / System RAM)** -- All text generation runs in system RAM with 0 GPU layers. This includes writing, scene analysis, image prompt generation, logic audits, image description, and voice chat.
- **ComfyUI (GPU / VRAM)** -- All media generation runs on the GPU exclusively. This includes scene images, animated GIFs, TTS narration audio, and lip-sync video.

This separation means both services run simultaneously without competing for resources.

### The Two Services

**LM Studio -- Text Generation (CPU / System RAM)**
Handles all writing and analysis: generating scene content, summarising scenes, building image prompts, running logic audits, analysing reference images, and powering voice chat. Runs on your AI machine and exposes an OpenAI-compatible API on port 1234. Both models run entirely in system RAM (0 GPU layers) so the GPU stays free for ComfyUI.

**ComfyUI -- Media Generation (GPU / VRAM)**
Handles all four media types: scene images (NetaYume Lumina / Flux workflow), animated GIFs (LTX 2.3 Text2Video), TTS narration audio (Kokoro TTS), and lip-sync video (LTX 2.3 LipSync Portrait). All four use the same ComfyUI endpoint with built-in workflows -- no workflow files to manage. Story Forge sends each job, polls for completion, and retrieves the output file automatically. ComfyUI has exclusive access to the GPU.

### Feature Map

| Group | Features |
|-------|----------|
| Planning | Projects, Franchise Manifesto, Dossier, Outline |
| World | World Library (Characters, Places, Things, Technologies), Story Bible, Style Anchors, Prohibited Words |
| Writing | Write (scene editor), Voice Chat |
| Quality | Consistency Tracking (Story Events, Character States, Character Arc, Scene References), Logic Checks, Reveal Timeline |
| Production | Pipeline (5 stages: Images, Animation, TTS, Assembly, Lip-sync), Audiobook TTS |
| Output | Export (HTML / Markdown / Text), Save & Load (JSON backup) |

---

## Hardware & Model Configuration

### Target Hardware

- **CPU:** Intel i7 (or equivalent)
- **GPU:** NVIDIA RTX 5090 (32 GB VRAM)
- **RAM:** 196 GB DDR5

### Model Assignment

| Role | Model | Runs On | RAM Usage | Speed | Context |
|------|-------|---------|-----------|-------|---------|
| Text (Writing) | Midnight-Miqu-70B-v1.5.Q4_K_M | System RAM (CPU) | ~45 GB | ~3-5 tok/s | 32,768 |
| Vision (Image Analysis) | llava-v1.6-mistral-7b (Q5_K_M) | System RAM (CPU) | ~6 GB | ~15-20 tok/s | 4,096 |
| Image Generation | NetaYume Lumina / Flux | GPU (VRAM) | Up to 32 GB | Full GPU speed | -- |
| TTS Audio | Kokoro TTS | GPU (VRAM) | Shared | Fast | -- |
| Animation | LTX 2.3 Text2Video | GPU (VRAM) | Shared | ~30-90s/clip | -- |
| Lip-sync | LTX 2.3 LipSync Portrait | GPU (VRAM) | Shared | ~60-180s/clip | -- |

**Total LM Studio RAM:** ~51 GB of 196 GB available.

### Why These Models

- **Midnight Miqu 70B** -- Uncensored creative writing model based on Mistral Medium. Produces high-quality prose with no content refusals. Strong instruction following, large 32K context window for full-chapter generation with rich world context. At Q4_K_M quantization it fits comfortably in RAM.
- **LLaVA v1.6 Mistral 7B** -- Uncensored vision model for describing reference images. Small enough to load alongside the writing model. Fast on CPU for the short image-description tasks it handles (typically 50-200 tokens per image).

### LM Studio Load Settings

1. Load both models in LM Studio
2. Set **GPU Offload = 0 layers** for both models (critical -- GPU stays free for ComfyUI)
3. Set context length to **32768** for Midnight Miqu
4. Set context length to **4096** for LLaVA (short context is sufficient for image analysis)
5. Enable the local server on port **1234**
6. Both models can be loaded simultaneously -- LM Studio supports multiple models

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

> **Context Length** -- defaults to 32768, matching Midnight Miqu's context window. Story Forge uses this value to manage how much context is passed to the model during writing and analysis. The AI service uses priority-based context stacking: it calculates available token budget, then includes sections (story bible, style anchors, events, characters, etc.) by priority until the budget is full.

> **GPU Offload = 0** -- both models must run entirely in system RAM so ComfyUI has exclusive access to the GPU. With 196 GB DDR5, both models use only ~51 GB combined.

### ComfyUI

- Start ComfyUI on your AI machine. It runs at port 8188 by default.
- In Settings, set the **ComfyUI Endpoint** to `http://your-ai-machine:8188`.
- Click **Test ComfyUI**. A successful test shows connection status and queue state.

> **One endpoint, all workflows.** The same ComfyUI endpoint handles images, animation, TTS, and lip-sync. Story Forge sends built-in workflows for each type -- you never need to export or paste workflow JSON. The pipeline runs one job at a time and never submits two jobs simultaneously.

### Generation Settings

Beyond the endpoints, Settings lets you tune:

- **LLM parameters** -- Temperature, Max Tokens, Top P, Top K, Repetition Penalty, Presence/Frequency Penalty. Sensible defaults work for most models; lower temperature (0.3-0.5) for analysis tasks, higher (0.7-0.9) for creative writing.
- **System Prompt & Style Guide** -- A base persona and per-project writing style instructions injected into every generation request.
- **Style Rules** -- 9 toggle switches for common writing guidance:
  1. Avoid Adverbs (prefer precise verbs)
  2. Kill Leading "The" (dynamic sentence openings)
  3. Eliminate Linking Verbs (replace was/were/seemed with action)
  4. Show, Don't Tell (emotion through action/dialogue)
  5. Prefer Active Voice (subject performs action)
  6. Minimal Dialogue Tags (use "said" only)
  7. Cut Filter Words (remove felt/saw/heard/seemed)
  8. Preserve Emotional Anchors (never contradict or diminish Story Bible entries marked as Emotional Anchors -- running jokes, found family moments, traditions, rituals)
  9. Emergent Culture (communities create their own traditions, songs, stories, and folklore independent of protagonist actions)
- **Image orientation** -- Portrait (768x1344) / Landscape (1344x768) / Square (1024x1024) preset.
- **Image noise seed** -- Random (unique each run) or Fixed (reproducible output).
- **Positive conditioning prompts** -- Background, Foreground, and Characters fields that feed the image generation workflow alongside the AI-generated scene prompt.
- **TTS Speaker & Sample Rate** -- The Kokoro voice/speaker name (e.g. `af_sarah`) and output sample rate (default 24000 Hz).
- **Animation prompt fields** -- "Describe the image" and "What needs to be animated" fields for LTX 2.3 Text2Video.
- **Animation orientation & seed** -- Portrait / Landscape / Square and random/fixed seed for animation.
- **Lip-sync orientation & seed** -- Output orientation and noise seed for lip-sync video generation.
- **Lip-sync prompt fields** -- Background Setting and Character Description for the LTX 2.3 LipSync workflow.
- **Voice Chat settings** -- Browser TTS voice, speech rate, and pitch for in-app voice chat.

---

## Writing Tools

### Projects

Every piece of content in Story Forge belongs to a project. Create a project with a title, genre, and optional description. The active project is shown in the top-right corner of every page -- switch projects from there or from the Projects page. All settings, world data, outlines, scenes, and pipeline output are scoped to the active project.

Projects display as cards showing title, genre, description, and last updated date. The currently active project is visually highlighted.

### Franchise Manifesto

The Franchise Manifesto is the highest-authority guidance document in Story Forge. It stores immutable truths about your series that must never drift, contradict, or be diluted across other documents.

**Purpose:**
Story guidance previously lived in multiple places (Brain Dump, Tropes, System Prompt, Style Guide, Story Bible, Emotional Anchors). Core concepts like "Home is People" or "People vs Systems" could appear in several of these simultaneously. When one gets updated, the others may not, causing drift. The Franchise Manifesto solves this by providing a single source of truth that sits above all other guidance.

**How it works:**
- Written as plain text -- rules, truths, philosophical anchors, tone guidelines
- Injected at Priority 13 (the highest priority in the context assembly system)
- Appears in the AI prompt under the header "ABSOLUTE RULES - OVERRIDE ALL OTHER GUIDANCE"
- Always included in full before any other context section
- One manifesto per project

**What to put here:**
- Core themes that define the series
- Tone rules that must never change
- Philosophical positions the story takes
- Character treatment rules (e.g. "No character is purely evil")
- Reader experience goals (e.g. "The reader should always feel comfortable in the crew's company")
- Any truth that, if contradicted, would break the story

**What NOT to put here:**
- Plot details (use Story Bible)
- Character specifics (use World Library)
- Style preferences (use Style Guide or Style Anchors)
- Scene-level instructions (use Scene Brief)

**Guidance Hierarchy (displayed on the Manifesto page):**
Franchise Manifesto > System Prompt > Style Guide > Story Bible > Characters > Outline > Scene

The Write page Context tab now shows a "Generation Sources" panel listing all guidance layers flowing into each generation, with active/inactive indicators.

### Dossier

The Dossier is your pre-writing planning tool. Paste a free-form brain dump of your story idea and a list of genre tropes you want to include, then click Generate. The AI produces a structured story dossier covering premise, themes, tone, major characters, and key plot beats. Edit and save the result. The dossier is included in downstream AI context so the model understands what kind of story you're writing.

### Outline

Build your story structure here. Create one or more outlines (e.g. one per story arc) with a title, synopsis, act structure, and themes. Add chapters to each outline with:

- Title and summary
- Key events
- POV character (selected from World Library characters)
- Primary setting (selected from World Library places)
- Order index (determines chapter sequence)

Chapters created here appear as options on the Write page and Pipeline page.

### Write

The scene editor is the core of Story Forge. Select a chapter, then a scene within it. The editor has a main content area and a collapsible right sidebar with multiple panels.

**AI Generation Context Package:**
When you click Generate, the AI receives a deep context package assembled from 13+ database queries:

- Franchise Manifesto (absolute franchise-level rules)
- Story dossier and outline summary
- Active Style Anchors (reference passages)
- Active Prohibited Words
- Active Style Rules (9 available rules)
- World Library entries (characters, places, things, technologies) -- filtered by `generation_relevant` flag
- Story Bible facts (sorted by importance: critical > high > medium > low, filtered by generation_relevant)
- Character States for the current scene
- Story Events tracking
- Scene References (full text of referenced scenes)
- Scene Brief (what should happen)
- Context Tags (entity tags to focus generation)
- Previous scene summaries (for continuity)

The AI service uses **priority-based context stacking** -- it calculates available token budget (context_length minus max_tokens minus overhead), then includes sections by priority until the budget is full. This ensures the most important context always fits, even with a 32K window.

**Context Filtering Rules:**
- If **Context Tags** are set on a scene: only tagged entities are injected (explicit inclusion)
- If **no Context Tags** are set: all entities with `generation_relevant = true` are injected (entities marked as author-reference-only are excluded)
- Entities with Canon Status "Deprecated" are always excluded
- Entities with Canon Status "Experimental" are tagged as such in the prompt so the AI treats them cautiously

**Information Ownership:**
When a character has a filled dossier, the dossier is the primary context for that character. The raw personality/background fields are NOT also injected -- this prevents redundant token usage. Characters without a dossier fall back to their individual fields as context.

**Sidebar Panels:**

1. **Scene Brief Panel** -- 10-field structured brief (POV character, scene function, plot beats, characters in scene, setting details, conflict, tone/style notes, symbolism/themes, continuity notes, other notes). Can be AI-generated from chapter outline + world data. Shows progress indicator (X/10 fields filled).

2. **Context Tags Panel** -- Tag specific entities (characters, places, things, technologies, story bible entries) to include in this scene's generation context. 5-type tabbed interface. Only tagged items are sent to the AI. Color-coded by entity type.

3. **Scene Summary Panel** -- 4-field summary (summary text, key facts, characters involved, emotional arc). Used as efficient distant context for other scenes instead of sending full scene text.

4. **Scene Image Panel** -- Generate a header image for the scene via ComfyUI. Auto-generates a prompt from scene content + world data, or allows manual prompt editing. Displays the generated image inline.

5. **Editing Pass Panel** -- Two-step editing workflow:
   - Step 1: Generate an improvement plan (line-by-line analysis of what can be better)
   - Step 2: Implement edits (apply improvements to create refined version)
   - Can apply the edited version back to the main scene content
   - Uses style rules, prohibited words, and previous chapter context

> You can also paste pre-written text directly into the editor. The AI generation features are optional -- you can use Story Forge as a structured editor for existing writing and still run the full production pipeline.

### Generation Modes

The Write page includes a **Generation Mode** toggle that changes what the AI produces. This affects the final instruction sent to the AI while keeping all context injection (manifesto, bible, characters, places, etc.) identical.

**Three modes available:**

| Mode | Button Label | Final Instruction | Output Type |
|------|-------------|-------------------|-------------|
| **Scene** | Generate Scene | "Write this scene with vivid detail, engaging dialogue, and strong character voice..." | Prose (default) |
| **Design Brief** | Generate Brief | "Generate a structured Design Brief document... Do NOT write prose, dialogue, or scenes..." | Structured planning document |
| **Outline** | Generate Outline | "Generate a structured chapter-by-chapter outline... Do NOT write prose..." | Chapter-level planning document |

**How to use each mode:**

**Scene Mode (default):**
The standard mode. Write a short scene description ("Benjamin arrives at the Gull & Lantern") and the AI generates prose.

**Design Brief Mode:**
For pre-writing planning. The scene description becomes a set of design instructions. Paste detailed instructions specifying:
- What questions the brief should answer (emotional purpose, theme goals, worldbuilding goals)
- What sections the output should contain (POV character, location, ending beat, reveal restrictions)
- What constraints apply (what must NOT be introduced yet, which reveals are delayed)
- What format to use (structured headings, bullet points, not prose)

The AI receives the full context package (manifesto, bible, characters, style guide, etc.) alongside your instructions, then produces a structured planning document instead of prose. This is ideal for generating Chapter Objectives, Act Breakdowns, or Scene Design Briefs before writing.

**Outline Mode:**
For generating multi-chapter structural plans. The scene description becomes outline-generation instructions specifying scope (which chapters), focus (which themes), and format requirements. The AI produces a structured outline with chapter titles, POV characters, locations, beats, and theme advancement.

**Workflow Example -- Chapter 1 Design Brief:**

1. Go to Write page
2. Select a chapter (or create a placeholder)
3. Create a scene titled "Chapter 1 Design Brief"
4. Switch mode to **Design Brief**
5. In the Scene Description, paste your brief-generation instructions (what emotional purpose, what relationships, what themes, what must NOT appear yet, etc.)
6. Optionally set **Context Tags** to limit injection to Book 1-relevant entities only
7. Click **Generate Brief**
8. The AI produces a structured Design Brief document in the editor
9. Switch mode back to **Scene** when ready to write actual prose

**Important:** The generation mode is stored in the scene's `context_data` metadata so you can always see which mode produced a given output.

**Mode Selection Persistence:**
The mode toggle is session-level. It resets to Scene when the page reloads. This prevents accidental brief generation when you intend to write prose.

**Token Budget Note:**
Design Brief and Outline modes benefit from larger `max_tokens` output settings since structured documents tend to be longer than individual scenes. Consider temporarily increasing max_tokens in Settings when generating briefs or outlines.

### Voice Chat

An interactive voice assistant for discussing your story. Uses browser speech recognition to capture your voice and browser TTS to speak responses.

Features:
- Voice selector (all system voices available)
- Adjustable speech rate and pitch
- Auto-listen mode (continuous conversation loop)
- Manual text input option
- Full message history display
- Stop Speaking button during synthesis
- Clear Conversation button

The AI has full access to your project context via the configured system prompt and can answer questions, brainstorm ideas, or help work through plot problems.

---

## World & Characters

### World Library

The central database for everything that exists in your story's world. Divided into four entity types with full CRUD operations:

**All Entity Types share these features:**
- **Canon Status** -- 5 certainty levels:
  - **Canon** -- Immutable, locked-in lore (green)
  - **Stable** -- Likely permanent, rarely changed (blue)
  - **Draft** -- Actively evolving, subject to change (amber)
  - **Experimental** -- Brainstorming, may be discarded entirely (rose)
  - **Deprecated** -- Old lore, no longer active, excluded from AI context (gray)
- **AI Generation Relevant** toggle -- Controls whether this entity is injected into AI context during scene generation. When disabled (Author Reference Only), the entity is stored for your reference but never sent to the AI. Useful for background notes, favorite foods, trivia, and other data that doesn't need to consume AI token budget. Default: enabled.
- **Emergent Character** toggle -- Marks non-character entities (ships, stations, buildings, institutions) as having their own personality and agency. Enables Infrastructure Sliders for that entity.
- **Entity Images** -- Upload reference images to any entity. The vision model (llava-v1.6-mistral-7b) can auto-generate detailed visual descriptions (2-3 paragraphs) stored with the entity and used during generation.
- **Export** -- ZIP download per entity type (markdown reference document + all images).

**Characters**
- Physical description, personality, background, role, relationships, motivations, dialogue style, notes
- **Hero's Journey Tracking** -- 12 stages (Ordinary World through Return with Elixir) with text descriptions for each stage
- **Personality Sliders** -- 15 dimensions on a -10 to +10 scale:
  1. Stress / Calm
  2. Fear / Courage
  3. Suspicion / Trust
  4. Callous / Empathic
  5. Impulsivity / Self-Control
  6. Dominance / Submission
  7. Pessimism / Optimism
  8. Introverted / Extroverted
  9. Gut / Logic
  10. Detail / Big-Picture
  11. Cautious / Risk Taker
  12. Seriousness / Humor
  13. Deception / Honesty
  14. Stability / Sensitivity
  15. Shame / Self-Worth

  Each slider has descriptive text at 5 levels. Slider values are formatted into the AI prompt to influence how the model writes each character. Sliders evolve over time via Character Arc Events.

- **Character Dossier** -- Deep character development profile with two generation modes:
  - **Structured Mode** -- Produces organized markdown with ## headers for each section (Core Role, Function/Occupation, Public Appearance, Internal Appearance, Personality Traits, Emotional Function, Relationship With Setting, Key Relationships, Personal Fear, Personal Flaw, Quiet Human Moments, Comedy Dynamics, Symbolic Theme, Character Arc, Relationship To The Wider World, Legacy/Post-Crisis)
  - **Narrative Mode** -- Produces flowing prose with no headers. Reads like a personnel file or character essay. Better for direct franchise documentation.
  - Can also be filled manually via the Load Template button or freeform text.
  - When a dossier is filled, it becomes the primary context source for that character during generation (personality/background fields are not redundantly injected).

**Places**
Name, type, physical description, history, atmosphere, significance. Used to ground scene generation in the correct setting.

**Things**
Objects, artefacts, weapons, vehicles, and other significant items. Includes properties, origin, and current ownership.

**Technologies**
Magic systems, technologies, scientific concepts, or any other rules-based system. Includes how it works, its limits, and who can use it.

**Infrastructure Sliders** (visible when Emergent Character is enabled on any entity type):
9 dimensions for entities with agency -- ships, stations, buildings, institutions:
1. Redundancy
2. Adaptability
3. Efficiency
4. Survivability
5. Comfort Prioritization
6. Repairability
7. Crew Familiarity Drift
8. Environmental Warmth
9. Emergency Preservation Bias

### Story Bible

Canonical facts that the AI must always know and respect. Each fact has:
- **Category** -- Character Facts, World Rules, Timeline, Relationships, Plot Points, Emotional Anchors, General (plus any custom category)
- **Importance** -- Critical, High, Medium, Low (affects priority in context stacking)
- **Subject** -- The entity or topic the fact is about
- **Fact** -- The canonical statement
- **Tags** -- Optional categorization tags
- **Canon Status** -- Canon, Stable, Draft, Experimental, Deprecated
- **AI Generation Relevant** toggle -- When disabled, the entry is stored for author reference but excluded from AI context. Shown with an "Author Only" badge in the entry list.

Active Story Bible entries (with generation_relevant enabled and canon_status not deprecated) are injected into every generation prompt, sorted by importance. Use this for hard rules: "magic cannot bring the dead back to life", "the war ended in Year 412", "Elena is left-handed".

**Emotional Anchors** category is specifically for elements that build long-term reader attachment:
- Running jokes
- Found family moments
- Community rituals and traditions
- Recurring songs or sayings
- Symbolic objects with emotional resonance

When the "Preserve Emotional Anchors" style rule is active, the AI is instructed to never contradict, diminish, or retire these elements unless explicitly told to.

Category filter tabs show counts per category. Search/filter field for finding specific entries. Download as Markdown button exports all entries grouped by category.

### Style Anchors

Reference passages that define the writing voice you want. Each anchor has a label, passage text, and optional notes. Mark anchors as active -- active anchors are included in every AI writing prompt so the model matches the style.

A warning appears if more than 3 anchors are active (high context usage).

### Prohibited Words

A blocklist of words and phrases the AI must not use. Features:
- Add individual words/phrases with a category selector
- **Load Defaults** button -- one-click loader for ~46 curated entries covering:
  - AI-isms (24 items): delve, tapestry, resonate, nuanced, paradigm, etc.
  - Cliches (7 items): sent shivers down, heart skipped a beat, blood ran cold, etc.
  - Overused (15 items): let out a breath, dark chuckle, steeled himself, etc.
- Category filter (All, AI-isms, Cliches, Overused, Custom)
- Duplicate prevention (case-insensitive)

All active prohibited words are injected into every writing prompt and editing pass.

---

## Consistency & Quality Checks

### Consistency Tracking

Four-tab interface for maintaining continuity across a long story:

**Story Events**
A log of important plot events. Each event has:
- Description text
- Importance level (low, medium, high, critical) -- color-coded
- Linked scene and chapter
- Affected characters (multi-select)
- World state impact flag

Events are referenced by the AI during generation to avoid contradicting established events or repeating them.

**Character States**
Track how a character changes from scene to scene. Each state entry tracks 5 dimensions:
- Physical state (injuries, appearance changes)
- Emotional state (feelings, mindset)
- Knowledge (what the character now knows)
- Possessions (items carried/lost)
- Notes (additional context)

Filter by character. The AI uses the most recent applicable state when writing a character.

**Character Arc**
Tracks how personality sliders evolve over the course of the story via Arc Events. Each arc event represents a significant experience that shifts a character's personality:
- Linked to a specific character
- Specifies which personality slider(s) change and by how much
- Includes a description of what caused the shift
- Status: Proposed (AI-suggested) or Accepted (confirmed by author)

Only Accepted arc events affect the character's active personality sliders during generation. The AI service computes evolved slider values by applying all accepted events chronologically to the character's baseline sliders.

**Scene References**
Tag specific earlier scenes that the current scene should be aware of. 6 reference types:
- Foreshadowing
- Callback
- Continuity
- Character Arc
- World Building
- Plot Thread

Each type is color-coded. Active references are included in full as context when generating the current scene. Toggle active/inactive status per reference.

### Logic Checks

An AI-powered audit tool. Select what to audit:
- **Dossier** -- checks the story dossier for internal contradictions
- **Outline** -- checks outline/synopsis coherence
- **Chapter** -- checks a specific chapter for continuity errors
- **Character** -- checks character consistency across the story
- **Worldbuilding** -- checks world rules and technology/magic consistency

The AI reads the relevant content and produces a detailed report highlighting logical inconsistencies, internal contradictions, plot holes, timeline problems, and character behaviour inconsistencies.

Previous audit reports are stored and can be reviewed/deleted at any time. Uses low temperature (0.3) for deterministic, focused analysis.

> Logic Checks consume significant context. The 32K context window of Midnight Miqu handles this well, especially for full-chapter audits.

### Reveal Timeline

Tracks when information is revealed to the reader across multiple books and acts. Essential for managing mystery reveals, foreshadowing payoffs, and gradual worldbuilding disclosure in long-running series.

Each reveal entry has:
- **Book Number** -- which book/volume the reveal occurs in
- **Act/Section** -- where within the book
- **Reveal Method** -- how the information is disclosed:
  - Direct (stated explicitly)
  - Implied (hinted at through context)
  - Foreshadowed (seeded earlier, confirmed later)
  - Discovered (character or reader figures it out)
  - Character Reveals (one character tells another)
- **Entity Type** -- what kind of thing is being revealed (character, place, thing, technology, world rule)
- **Entity Name** -- the specific entity involved
- **Fact** -- the actual information being revealed
- **Notes** -- additional context about the reveal

Filter by book number to see all reveals per volume. Timeline layout groups entries by book with visual headers.

Use this system to prevent accidentally revealing information too early, to track which mysteries are still unresolved, and to plan when payoffs should land.

---

### Information Ownership Conventions

Story Forge follows ownership conventions to prevent context duplication and contradictions:

| Information Type | Primary Owner | Referenced By | Not Stored In |
|-----------------|---------------|---------------|---------------|
| Franchise-Level Truths | Franchise Manifesto | All generation | Story Bible, System Prompt, Brain Dump |
| Character Personality/Background | Character Record (or Dossier if filled) | Scene generation | Story Bible (redundant) |
| Character Arc Progression | Hero's Journey + Arc Events | Dossier, Generation | Story Bible |
| World Rules | Story Bible | Everything | Character fields |
| Reveal Information | Reveal Timeline | Outline | Story Bible (use reveals) |
| Emotional Anchors | Story Bible (emotional_anchor category) | Style Rules | Character fields |
| Scene-specific States | Character States | Scene generation | Dossier |
| Setting Details | Places record | Scene generation | Story Bible (redundant) |

**Practical effect:** When a character has a filled dossier, the dossier replaces the raw personality/background/goals fields in AI context. This prevents sending the same information twice and saves token budget for other context.

---

## Production Pipeline

The Pipeline page converts a finished chapter into all the media assets needed for an audiobook-style video. It runs five stages in order. Each stage submits jobs to ComfyUI one at a time, monitors them automatically, and retrieves the output files when they finish.

The **Stage Indicator** shows visual progress through all stages with color-coded states: completed (green), current/running (pulsing), paused/review (amber), error (red).

### How Job Monitoring Works

When Story Forge sends a job to ComfyUI it does the following without any manual input:

1. **Submits the workflow** -- sends the built-in workflow JSON (with prompts, settings, and image/audio references injected) to ComfyUI's `/prompt` endpoint. ComfyUI returns a `prompt_id`.
2. **Monitors via WebSocket** -- connects to ComfyUI's WebSocket (`/ws?clientId=...`) for real-time completion notifications. Falls back to HTTP polling of `/history/{prompt_id}` if WebSocket fails.
3. **Retrieves the output file** -- reads the filename from the history response and constructs the `/view?filename=...&type=output` URL. Saves this URL to the database.
4. **Uploads to Supabase Storage** -- optionally copies the file to Supabase Storage for persistence (with graceful fallback to ComfyUI URL if upload fails).
5. **Moves to the next item** -- submits the next image/chunk and repeats. Only one job is in ComfyUI's queue at any time.

While a stage is running you see a progress bar with message and item counter (e.g. "Generating image 3 of 8..."). When all items are done, the stage completes and the next stage becomes available.

---

### Stage 1 -- Analyse & Generate Images
**Tool: LM Studio (analysis) + ComfyUI (image generation)**

**What happens:**
1. The LLM reads your full chapter text (first ~12K characters) and identifies 3-12 key visual moments -- dramatic reveals, location introductions, action peaks, emotional beats.
2. For each moment it writes: a **text anchor** (the passage it corresponds to), a detailed **image prompt** (Stable Diffusion format), and an **animation prompt** (motion description for Stage 2).
3. ComfyUI generates the images one at a time using the built-in NetaYume Lumina workflow with your configured orientation, seed, and conditioning prompts.

**Image Prompt Generation:**
The `imagePromptService` converts scene context into Stable Diffusion prompts by:
- Inferring art style from genre (fantasy = epic fantasy illustration, sci-fi = futuristic concept art, etc.)
- Scanning scene content for visual keywords (colors, lighting, actions, objects)
- Including top 3 characters + top 2 things
- Appending quality tags ("cinematic lighting, detailed, high quality, 8k")
- Capping prompt length at 500 characters

**Story Forge shows:** "Analyzing chapter for visual moments..." then "Generating image 1 of N..." through completion.

**When done:** The Image Review Grid appears showing all images with their order index, text anchor, image prompt, and animation prompt. For each image you can:
1. **Review** -- see the generated image alongside its prompt and text anchor
2. **Edit prompt** -- click the prompt text to enter edit mode. Adjust the wording to fix composition, add details, or change the scene
3. **Regenerate** -- click the orange Regenerate button to re-send just that one image to ComfyUI with the updated prompt. The new image replaces the old one in the same position -- no need to regenerate all images

If the entire set is wrong, click **New Run** to discard everything and start fresh.

---

### Stage 2 -- Animate Images (Optional)
**Tool: ComfyUI (LTX 2.3 Text2Video workflow)**

**What happens:** Each generated scene image is sent to ComfyUI's LTX 2.3 Text2Video workflow along with the animation description. ComfyUI produces a short animated video (30 fps, 5 seconds) with subtle motion -- flickering light, swaying foliage, atmospheric haze, gentle character breathing.

**Technical details:**
- Image is loaded via LoadImage node
- Orientation presets: Portrait (768x1344), Landscape (1344x768), Square (1024x1024)
- 10-minute timeout per clip (video encoding is slow)
- Dual seed node injection for reproducibility

**When done:** A "Show animated" toggle appears on the image grid to compare still vs animated versions. This stage is optional -- skip it to use still images in the final assembly.

---

### Stage 3 -- Generate TTS Audio
**Tool: ComfyUI (Kokoro TTS workflow)**

**What happens:** The chapter text is split at sentence boundaries into chunks of approximately 800-1000 characters. Each chunk is sent to ComfyUI's Kokoro TTS workflow with your configured speaker voice and speed. Each chunk produces a separate audio file.

**Kokoro TTS details:**
- Speaker profiles: e.g. `af_sarah`, `en_speaker_0`
- Speed control: adjustable (default 1.0)
- Finds KokoroSpeaker and KokoroGenerator nodes by class_type
- 5-minute timeout per chunk (typically 5-20 seconds)

**Story Forge shows:** "Generating TTS chunk 1 of N..." with progress bar.

**When done:** The TTS Chunk Review list appears below the progress bar. For each chunk you can:
1. **Play** -- click the play button to listen to that specific chunk's audio
2. **Edit** -- click the text to enter edit mode. Fix mispronounced words by spelling them phonetically (e.g. "Aerith" becomes "Air-ith")
3. **Regenerate** -- click the orange Regenerate button to re-send the edited text to TTS. The new audio replaces the old one in the same position in the sequence.

This workflow lets you fix pronunciation issues one chunk at a time without re-generating the entire chapter. The edited text and new audio are saved to the database -- downstream stages (audio assembly, lip-sync) will automatically use the corrected version.

---

### Stage 4 -- Audio Assembly & Export
**Tool: Browser Web Audio API + local export (no ComfyUI job)**

**What happens:** Two things occur at this stage:

1. **Audio Assembly** -- Story Forge uses the browser's Web Audio API to decode all TTS chunks, concatenate them into a single continuous WAV file (44-byte header + PCM sample data), and upload the result to Supabase Storage. This gives you a single chapter audio file.

2. **Video Assembly Manifest** -- Story Forge builds a structured JSON file containing:
   - **images array** -- each image's URL (animated GIF if available, otherwise still), order index, and text anchor phrase
   - **audio array** -- each TTS chunk's URL, text content, and order index
   - **chapterLabel** -- e.g. "Chapter 01"
   - **timing data** -- for syncing image changes to narration

**How to use the manifest:** Feed this JSON into your video assembly tool. When the narration reaches a text anchor phrase, switch the displayed image to the corresponding one.

---

### Stage 5 -- Lip-sync Generation
**Tool: ComfyUI (LTX 2.3 LipSync Portrait workflow)**

**What happens:** You provide a character face image URL (front-facing, ideally from World Library or ComfyUI-generated). Story Forge takes each TTS audio chunk and submits a lip-sync job pairing the character image with that audio.

**Technical details:**
- Image and audio are pre-uploaded to ComfyUI's `/input` folder via `/upload/image` endpoint
- Audio duration is extracted via Web Audio API and injected into the Duration node
- Fixed frame rate: 30 FPS
- Resolution: up to 1080x1920 (portrait)
- 20-minute timeout per clip (longest timeout -- high resolution + AI upsampling)
- Scene prompt (background + character description) is injected for visual consistency

**Output naming:** Sequential -- `ch01_lipsync_001.mp4`, `ch01_lipsync_002.mp4`, etc.

**When done:** The Lip-sync Chunks list shows all clip URLs in order with status badges. Download or copy them and stitch sequentially in your video editor.

---

### Pipeline Controls

- **New Run** -- Creates a fresh pipeline run for the same chapter, discarding previous images and lip-sync data. TTS chunks persist and can be reused.
- **Review Gates** -- Each stage must complete before the next becomes available. You decide when to proceed.
- **Error Recovery** -- Individual item failures are marked as errors but don't stop the entire stage. Errors are surfaced in the UI.

### Pipeline Warnings

> **Never clear ComfyUI/output/ between stages.** Stage 2 reads Stage 1's image files. Stage 5 reads Stage 3's audio files. Deleting anything from the output folder breaks those references.

> **Never run two pipeline stages at the same time.** Story Forge sends one job at a time. Starting a new stage while one is running will submit conflicting jobs.

> **Keep ComfyUI running while working.** Files are served through ComfyUI's HTTP server. If ComfyUI stops, images and audio will not display in Story Forge.

### Watching ComfyUI During a Run

Keeping a browser tab open to your ComfyUI instance (`http://your-ai-machine:8188`) is useful for:
- Seeing real-time render progress
- Spotting stalled jobs (if progress hasn't moved in several minutes)
- Identifying workflow errors (red error borders on nodes)
- Checking queue depth (should always be 0 or 1 during a run)

---

## Audiobook

The Audiobook page provides standalone TTS generation outside the Pipeline. Features:

- **Chapter selector** -- choose which chapter to narrate
- **Voice selector** -- 10 Kokoro voice profiles available
- **Speed slider** -- 0.5x to 2.0x
- **Prepare Chunks** -- splits chapter text into ~800 character segments at sentence boundaries
- **Generate All / Resume** -- generates all chunks sequentially, skipping completed ones on resume
- **Per-chunk controls** -- individual Generate/Redo buttons, Play/Stop buttons
- **Play All** -- sequential playback with auto-advance between chunks
- **Download All** -- fetches and saves all chunk audio files

Each chunk shows: text preview, status badge (pending/generating/uploading/completed/error), character count, and audio controls.

Generated audio is uploaded to Supabase Storage (`audiobook-audio` bucket) for persistence.

> Uses the same Kokoro TTS workflow and speaker settings. Change the speaker in Settings before generating if you want a different voice.

---

## Export

Export your finished story in three formats:

**HTML**
A styled, self-contained HTML document using Playfair Display + Merriweather fonts. Features drop caps, ornamental separators, and responsive/print-friendly design. Scene images can be embedded as base64 data (no external dependencies) or linked by URL.

**Markdown**
Standard GitHub-flavored Markdown with image references. Compatible with Obsidian, Notion, GitHub, and most writing tools.

**Plain Text**
Clean text only, no formatting or images. Useful for pasting into publishing platforms or further processing.

All formats offer options:
- Include/exclude scene images
- Embed images as base64 (HTML only)
- Include/exclude scene notes and descriptions

A preview is shown before downloading. Copy to Clipboard is also available.

### Save & Load (JSON Backup)

The Save/Load page exports the entire project as a JSON file covering all tables:
- Projects, outlines, chapters, scenes
- Characters, places, things, technologies
- Story events, character states, scene references, scene summaries
- Story bible entries, style anchors, scene context tags
- Story dossiers, scene briefs, editing passes, logic checks
- Prohibited words, generation settings
- Franchise manifesto

**Export features:**
- Image URL fields are stripped for portability
- Downloads as timestamped JSON file

**Import features:**
- File validation and structure checking
- Preview showing project metadata and table row counts
- Full ID remapping (old IDs replaced with new UUIDs)
- Foreign key remapping across all tables
- Ordered table loading (respects dependencies)
- Progress tracking per table
- Creates a new project (never overwrites existing)
- Sets imported project as active upon success

---

## Files & Storage

All media generated by ComfyUI (images, animated videos, TTS audio, lip-sync video) is saved to ComfyUI's output directory on your AI machine. Story Forge stores the URL that points to each file.

| Content | Location |
|---------|----------|
| Scene images | `ComfyUI/output/` (served via ComfyUI HTTP) |
| Animated GIFs/videos | `ComfyUI/output/` (served via ComfyUI HTTP) |
| TTS audio chunks | `ComfyUI/output/` + Supabase Storage (backup) |
| Assembled chapter audio | Supabase Storage (`pipeline-audio` bucket) |
| Lip-sync video clips | `ComfyUI/output/` (served via ComfyUI HTTP) |
| Entity reference images | Supabase Storage (`entity-images` bucket) |
| Audiobook audio | Supabase Storage (`audiobook-audio` bucket) |
| All text data | Supabase database |

### Supabase Storage Buckets

- `entity-images` -- uploaded reference images for world entities
- `pipeline-images` -- backed-up scene images
- `pipeline-animations` -- backed-up animation files
- `pipeline-audio` -- assembled chapter audio files
- `pipeline-lipsync` -- backed-up lip-sync videos
- `pipeline-video` -- assembled video files
- `audiobook-audio` -- standalone audiobook TTS chunks

### URL Format

ComfyUI-generated files are accessed via ComfyUI's `/view` endpoint:

```
http://your-ai-machine:8188/view?filename=ComfyUI_00001_.png&subfolder=&type=output
```

The `storageService` handles uploading files from ComfyUI URLs to Supabase Storage with:
- MIME type detection from file extension
- Query parameter parsing for ComfyUI URLs
- Graceful fallback (returns original ComfyUI URL if Supabase upload fails)

---

## End-to-End Workflow

Complete walkthrough from a blank project to a finished audiobook video chapter.

### 1 -- Project Setup

1. Create a project (Projects page) with title, genre, and description.
2. Go to Settings, verify the Model Name is `Midnight-Miqu-70B-v1.5.Q4_K_M` and Context Length is 32768.
3. Set the ComfyUI endpoint to `http://your-ai-machine:8188`.
4. Test both connections (green dots confirm connectivity).
5. Configure image orientation and TTS speaker voice.

### 2 -- World Building

1. Write the Franchise Manifesto (Manifesto page) -- core truths, tone rules, and philosophical positions that define the series. This is the single source of truth for franchise-level guidance.
2. Add main characters in the World Library with physical descriptions, personalities, backstory, and personality slider positions.
3. Upload reference images for key characters -- the vision model will auto-generate detailed descriptions.
4. Map each character's Hero's Journey stage.
5. Add key places, important objects, and any magic/technology systems.
6. Add canonical facts to the Story Bible -- rules the AI must never break. Set importance levels (critical facts are always included in context).
7. Paste reference writing passages into Style Anchors and activate 1-3.
8. Load the prohibited words preset and add any project-specific terms to avoid.

### 3 -- Planning

1. Open the Dossier page, paste your story brain dump and genre tropes, and generate the dossier.
2. Build your outline -- create outlines with synopsis/act structure/themes, then add chapters with summaries, key events, POV character (from World Library), and setting (from World Library).

### 4 -- Writing

1. Open the Write page, select a chapter and scene (or create a new scene).
2. Use the Context Tags panel to tag which entities are relevant to this scene.
3. Fill in the Scene Brief (10 fields -- can be AI-generated from outline data).
4. Click Generate -- the AI produces scene content using the full context package.
5. Edit the generated text directly in the editor.
6. Use the Editing Pass panel for targeted refinement (generates improvement plan, then implements edits).
7. Generate a Scene Summary for efficient distant context.
8. Optionally generate a Scene Image via ComfyUI.
9. Update Character States and Story Events on the Consistency page as the story progresses.
10. Repeat for each scene until the chapter is complete.

### 5 -- Quality Review

1. Run a Logic Check on the chapter (or dossier, outline, characters, worldbuilding).
2. Review the detailed audit report.
3. Fix any identified issues in the Write page.
4. Re-run the check until it passes cleanly.

### 6 -- Production Pipeline

1. Open the Pipeline page and select the finished chapter.
2. **Stage 1:** Analyze & Generate Images -- review all images in the grid before continuing.
3. **Stage 2:** Animate Images (optional) -- review animations via the toggle, or skip for still images.
4. **Stage 3:** Generate TTS Audio -- listen to all chunks for quality.
5. **Stage 4:** Audio Assembly & Export -- download the assembled audio and/or video assembly manifest JSON.
6. **Stage 5:** Generate Lip-sync -- select a character face image, generate all clips.
7. Lip-sync clips are named sequentially -- stitch in filename order using an external video tool.

### 7 -- Final Assembly (External)

1. Use the Video Assembly Manifest JSON to drive scene image changes in sync with the narration.
2. Place the scene video (animated images + audio) in a smaller overlay window.
3. Place the stitched lip-sync video in the main frame.
4. Mute the overlay video -- the lip-sync carries the same TTS audio.
5. Add chapter title cards, intro/outro, and background music as desired.
6. Export and upload to YouTube.

---

### Using Pre-Written Stories

You can run the full production pipeline on an existing story without using the AI writing tools:

1. Create a project and an outline with chapters matching your story's structure.
2. On the Write page, paste your existing text into each scene's content field.
3. Run the Pipeline -- the LLM analyses your text exactly as it would for AI-written content.

---

### Standalone Audiobook (Without Pipeline)

If you only want narrated audio without images/animation/lip-sync:

1. Write or paste your chapter content.
2. Go to the Audiobook page.
3. Select the chapter, choose a Kokoro voice and speed.
4. Click Prepare Chunks, then Generate All.
5. Use Play All to preview, Download All to save.

---

## Context Assembly Architecture

This section documents how Story Forge decides what information to send to the AI during scene generation.

### Priority System

The AI service assembles context sections sorted by priority (highest first) and includes them until the token budget is full:

| Priority | Section | Content |
|----------|---------|---------|
| 13 | Franchise Manifesto | Absolute franchise-level rules that override all other guidance |
| 12 | Style Anchors | Reference passages defining target voice/tone |
| 11 | Story Bible Facts | Canonical facts sorted by importance (critical > high > medium > low) |
| 10 | Previous Scene Summaries | Compressed history of earlier scenes in this chapter |
| 10 | Previous Scenes | Full text of 1-2 immediately prior scenes |
| 9 | Referenced Scenes | Full text of explicitly tagged reference scenes |
| 8 | Story Events | Plot events sorted by importance |
| 7 | Character States | Most recent physical/emotional/knowledge state per character |
| 6 | Chapter Summary | Current chapter's summary text |
| 5 | Story Synopsis | Overall outline synopsis |
| 4 | Characters | Name, role, personality (or dossier), dialogue style, sliders |
| 3 | Places/Setting | Name, type, description, infrastructure traits |
| 2 | Things | Significant objects |
| 2 | Technologies | Magic/tech systems |

Additionally, the following are always injected outside the priority system:
- System Prompt (base persona)
- Style Guide (project-specific writing instructions)
- Active Style Rules (9 available rules as strict directives)
- Prohibited Words (blocklist)
- Scene Description (user instructions -- labeled dynamically based on generation mode)
- Generation Mode Instruction (final directive that tells the AI what to produce: prose, design brief, or outline)

> **Note:** The Franchise Manifesto is injected WITHIN the priority system at the highest priority (13), not outside it. This means it competes for token budget like other context sections -- but because it has the highest priority, it is always included first and in full before anything else.

### Filtering Rules

**Context Tags (scene-specific):**
When context tags are set on a scene, ONLY the tagged entities are included. This is the strongest filter and overrides all other logic. Use context tags to focus the AI on exactly what matters for a specific scene.

**Generation Relevant flag:**
When no context tags are set, entities with `generation_relevant = false` are excluded. This prevents author-reference-only data (favorite foods, minor trivia, background notes) from consuming token budget.

**Canon Status filtering:**
- Deprecated entities are always excluded from context
- Experimental entities are included but tagged with `[EXPERIMENTAL]` so the AI treats them cautiously
- All other statuses are included normally

**Dossier Ownership:**
When a character has a filled dossier, only the dossier (plus dialogue style and sliders) is injected. The raw personality, background, and goals fields are NOT also sent -- the dossier already contains this information in richer form. Characters without a dossier fall back to individual fields.

### Token Budget Calculation

```
Available Budget = Context Length - Max Tokens (output) - 300 (prompt frame overhead)
```

Sections are added in priority order. When a section won't fit in full, it's truncated to the remaining budget. Lower-priority sections may be dropped entirely if budget is exhausted.

### Style Rules in Context

Active style rules are injected as a `=== ENFORCED STYLE RULES ===` block between the system prompt and the main context. Each rule is a strict directive (e.g., "STRICT RULE: Do NOT use adverbs..."). The 9 available rules:

1. Avoid Adverbs
2. Kill Leading "The"
3. Eliminate Linking Verbs
4. Show, Don't Tell
5. Prefer Active Voice
6. Minimal Dialogue Tags
7. Cut Filter Words
8. Preserve Emotional Anchors
9. Emergent Culture
