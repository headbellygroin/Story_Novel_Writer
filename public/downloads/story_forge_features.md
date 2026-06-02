# Story Forge - Complete Feature Reference

Story Forge is an AI-assisted series development studio that turns a story idea into a complete writing blueprint before a single chapter is written.

Write with uncensored local models, generate illustrations, create audiobook narration, and produce YouTube-ready litRPG content -- all from one workspace.

---

## Prerequisites

Story Forge assumes two services are already running on your AI machine:

1. **LM Studio** -- must be running with your writing model loaded (and optionally the vision model). Without LM Studio, no text generation works: no writing, no planning, no analysis, no voice chat.
2. **ComfyUI** -- must be running for any media generation: scene images, animation, TTS audio, lip-sync video. If you only need text features (writing, planning, consistency checks), ComfyUI is not required.

Both services must be reachable at the endpoints configured on the Settings page. If either is unreachable, features that depend on it will fail with a connection error.

---

## The Expected Workflow: World-Building First

Story Forge produces its best results when the author has done upfront world-building. The AI writing tools are context-driven -- the more world data you feed them, the richer and more consistent the output becomes.

**Before you start writing scenes, build your world:**

1. **Create a Project** -- give it a name, genre, and description.
2. **Write your Franchise Manifesto** -- the non-negotiable truths of your series (themes, tone rules, character philosophy).
3. **Populate the World Library** -- add characters with personalities, backgrounds, and relationships. Add places, things, and technologies with descriptions. Generate reference images for key entities using ComfyUI.
4. **Talk to the AI** -- use Voice Chat or the Dossier to brainstorm with the AI. Bounce ideas, test directions, get feedback on story structure.
5. **Fill the Story Bible** -- capture critical facts, rules, and lore that the AI must respect during generation.
6. **Run the Series Wizard** -- once you have characters, places, and a general direction, use Quick Start to generate your series backbone in one run.

**Why this order matters:**
Every generation request in Story Forge pulls context from your world data. Characters, places, story bible facts, the manifesto -- all of this gets injected into the AI prompt. If those are empty, the AI has nothing to work with and produces generic output. The more complete your world, the more specific, consistent, and on-brand the AI's writing becomes.

The tools are designed for this flow: world-build first (write entries, generate images, chat with the AI for ideas), then plan (Series Wizard, Outline), then write (scene-by-scene with full context injection).

---

## Core Architecture

- **Frontend:** React + TypeScript + Tailwind CSS (Vite)
- **Database:** Supabase (PostgreSQL with RLS)
- **AI Backend:** Any OpenAI-compatible API (LM Studio, Ollama, etc.)
- **Image Generation:** ComfyUI (local or remote)
- **TTS:** Kokoro TTS via ComfyUI workflow
- **Deployment:** Single-page app, designed for single-user desktop use
- **Network:** Supports local, remote, and Tailscale-based hybrid setups

---

## Project Management

- Create multiple writing projects (title, description, genre)
- Switch between projects; all tools scope to the active project
- Full project backup/restore as JSON
- Import creates a new project (non-destructive)

---

## World Library (Worldbuilding)

Four entity types, each with images, canon status, and an optional "emergent character" flag (marks entities that have agency in the narrative).

### Characters
| Field | Description |
|-------|-------------|
| Name, Role, Description | Basic identity |
| Personality, Background, Goals | Motivations and history |
| Dialogue Style | How they speak |
| Notes | Freeform author notes |
| Image + Image Description | Visual reference |
| Canon Status | Draft, Canon, Deprecated, Alternate |
| Emergent Character | Whether entity has narrative agency |
| Book/Chapter/Scene Introduced | Controls visibility -- prevents future cast from contaminating early scenes |

**Personality Sliders (15 dimensions, -10 to +10):**
Stress/Calm, Fear/Courage, Suspicion/Trust, Callous/Empathic, Impulsivity/Self-Control, Dominance/Submission, Pessimism/Optimism, Introversion/Extroversion, Gut/Logic, Detail/Big-Picture, Cautious/Risk Taker, Seriousness/Humor, Deception/Honesty, Stability/Sensitivity, Shame/Self-Worth

**Infrastructure Sliders (9 dimensions, also available on places/things/tech):**
Redundancy, Adaptability, Efficiency, Survivability, Comfort Prioritization, Repairability, Crew Familiarity Drift, Environmental Warmth, Emergency Preservation Bias

**Hero's Journey Tracking (12 stages):**
Ordinary World, Call to Adventure, Refusal of Call, Meeting the Mentor, Crossing Threshold, Tests/Allies/Enemies, Approach to Innermost Cave, The Ordeal, Reward, Road Back, Resurrection, Return with Elixir

**Character Dossier (19-section deep profile):**
Core Role, Function/Occupation, Public Appearance, Internal Appearance, Protagonist's Perspective, Personality Traits, Emotional Function Within Group, Relationship With Setting, Relationship With Protagonist, Key Relationships, Personal Fear, Personal Flaw, Quiet Human Moments, Comedy Dynamics, Symbolic Theme, Character Arc, Book/Act Focus, Relationship To The Wider World, Legacy/Post-Crisis

- Can load a guided template or write freeform
- AI "Generate Writeup" button: sends all character data to configured LLM, streams back a narrative-style dossier directly into the field
- Section completion tracking (X/19 filled)

### Places
| Field | Description |
|-------|-------------|
| Name, Type, Description | Identity |
| History, Significance, Notes | Context |
| Image + Image Description | Visual |
| Canon Status, Emergent Character | Metadata |
| Infrastructure Sliders | System characteristics |

### Things
| Field | Description |
|-------|-------------|
| Name, Type, Description | Identity |
| Properties, History, Notes | Detail |
| Image + Image Description | Visual |
| Canon Status, Emergent Character | Metadata |
| Infrastructure Sliders | System characteristics |

### Technologies
| Field | Description |
|-------|-------------|
| Name, Type, Description | Identity |
| Rules, Applications, Notes | Detail |
| Image + Image Description | Visual |
| Canon Status, Emergent Character | Metadata |
| Infrastructure Sliders | System characteristics |

### Entity Exports
- Export each type as a zip package containing a comprehensive markdown reference file plus all entity images
- Things export includes: type, description, properties, history, notes, canon status
- Technologies export includes: type, description, rules, applications, notes, canon status

---

## Outline & Structure

### Series Planning Wizard

The Series Wizard generates your complete story backbone so you can start with structure rather than staring at a blank page.

**Quick Start Mode (recommended for new projects):**
Answer 3 questions, press one button, and the AI generates your full series structure in a single automated run:

1. How many books? (default: 7)
2. What kind of story? (genre/tone)
3. What must happen by the end? (series endpoint)

Pressing "Build My Series" chains 6 generation steps automatically:
- Step 1: Series Map -- high-level arc for all books
- Step 2: Book 1 Major Events -- turning points (inciting incident, midpoint, climax, etc.)
- Step 3: Book 1 Outline -- detailed structural outline with act breaks
- Step 4: Book 1 Chapter List -- 20-30 chapters with POV, location, events, tone
- Step 5: Book 1 Chapter Briefs -- detailed planning for first 5 chapters (scene-by-scene breakdown)
- Step 6: Book 1 Scene Breakdown -- individual scene cards for Chapter 1

Each section appears progressively as it generates. Each has a Regenerate button. When all 6 complete:
- **Series At A Glance** summary dashboard appears (dark themed):
  - Series structure grid showing all books with parsed themes
  - Statistics: books planned, Book 1 chapter count, estimated total chapters, estimated word count
  - Characters mentioned (extracted from generated output)
  - Primary themes (parsed from series map and outline)
- "Save All to Project" stores everything to the database AND creates Book 1 > Chapter 1 > Scene 1 with starter prose so you can immediately test Write, TTS, and Pipeline features
- "Edit in Step-by-Step Mode" transfers all output into the Advanced panel for fine-tuning

**Step-by-Step Mode (advanced / mid-revision):**
Full manual control over each of the 6 steps. Add custom author notes per step, select which book/chapter to generate for, review and save individually. Use this to plan Books 2-7 after Quick Start builds Book 1, or to regenerate individual steps with specific guidance.

The Quick Start results feed directly into Step-by-Step mode -- the power user gets full control without losing the initial generation.

### Outlines

- Multiple outlines per project
- Outline fields: Title, Synopsis, Act Structure, Themes, Notes
- Chapters within outlines: Title, Summary, Key Events, Notes, Order Index
- Chapter ordering determines scene flow
- Active outline selection scopes the Write page

---

## Writing (Scene Editor)

### Scene Management
- Scenes organized by chapter
- Full-width editor with collapsible sidebar panels

### Sidebar Panels
1. **Scenes Tab:** Navigate all scenes in chapter
2. **Scene Brief:** 10-field structured brief (POV, function, beats, characters, setting, conflict, tone, symbolism, continuity, notes) -- AI-generated or manual
3. **Context Tags:** Tag specific entities to include in this scene's AI context (overrides default inclusion)
4. **Chapter Context Tags:** Persistent tags that apply to all scenes in a chapter
5. **Scene Summary:** 4-field summary (text, key facts, characters involved, emotional arc) -- used as efficient distant context
6. **Scene Image:** Generate header image via ComfyUI with auto-generated or manual prompts
7. **Prompt Report:** Shows the full context package assembled for the last generation
8. **Recommended Tags:** AI-suggested context tags based on scene content
9. **Editing Pass:** Two-step revision (improvement plan then implementation)

### AI Scene Generation
- Streaming text generation (real-time output)
- **Three Generation Modes:**
  - Scene (default) -- produces prose with dialogue and detail
  - Design Brief -- produces structured planning documents (no prose)
  - Outline -- produces chapter-level structural plans
- Full context injected into every prompt:
  - Franchise Manifesto (highest priority -- absolute rules)
  - All characters (with personality sliders, dossier, dialogue style)
  - All places, things, technologies
  - Previous scenes (full text for recent, summaries for older)
  - Character states (physical, emotional, knowledge)
  - Story events and plot points
  - Story Bible facts (weighted by importance)
  - Active style anchors
  - Prohibited words list
  - Style rules (9 enforceable rules)
  - System prompt and style guide
  - Scene Brief (structured scene planning)
  - Context Tags (entity focus filter)
  - Scene References (explicitly tagged callback scenes)

### Editing Passes
- **Improvement Plan:** AI analyzes a scene for pacing, dialogue, emotion, description, character authenticity, plot consistency
- **Implement Edits:** AI rewrites the scene based on the improvement plan
- Multiple editing passes tracked per scene

---

## Story Bible

- Track canonical facts and rules
- Categories: Character Facts, World Rules, Timeline, Relationships, Plot Points, Emotional Anchors, General (plus custom)
- Importance levels: Critical, High, Medium, Low (color-coded)
- Canon Status per entry
- AI Generation Relevant toggle (exclude entries from AI context without deleting them)
- Search and filter
- AI references all active bible facts during generation
- Emotional Anchors category specifically for running jokes, found family moments, rituals, and traditions

---

## Style Anchors

- Store exemplary prose passages that define the story's voice
- Fields: Label, Passage (example text), Notes, Active toggle
- AI uses active anchors as style references during all generation
- Enable/disable individual anchors without deleting them

---

## Prohibited Words

- Categories: AI-isms, Cliches, Overused, Custom
- Load default list of ~46 curated entries covering AI-isms, cliches, and overused phrases
- Add custom words per project
- AI avoids all listed words in every generation pass

---

## Consistency Tracking

### Story Events
- Log important plot points with: Title, Description, Book/Act, Importance
- Continuity reference for AI generation

### Character States
- Track character progression scene-by-scene
- Fields: Character, Scene, Physical State, Emotional State, Knowledge
- AI references states to maintain continuity

### Character Arc (Personality Evolution)
- AI-tracked personality slider evolution based on accepted arc events
- Computes how sliders change across the story
- References accepted arc events during generation
- Proposed vs Accepted status for author control

### Scene References
- Tag scenes the AI should specifically reference during generation
- 6 reference types: Foreshadowing, Callback, Continuity, Character Arc, World Building, Plot Thread
- Color-coded by type
- Toggle active/inactive per reference

---

## Reveal Timeline

- Plan information disclosure strategy across the story
- Fields: Entity Type, Entity Name, Fact to Reveal, Book Number, Act, Reveal Method, Notes
- Reveal Methods: Direct, Implied, Foreshadowed, Discovered, Character Reveals
- Filter by book/act
- Color-coded by reveal method
- Strategic pacing tool for plot disclosure

---

## Franchise Manifesto

- Single highest-authority guidance document per project
- Stores immutable truths about your series that must never drift or contradict
- Written as plain text: rules, truths, philosophical anchors, tone guidelines
- Injected at Priority 13 (highest priority in the context assembly system)
- Appears in AI prompts under "ABSOLUTE RULES - OVERRIDE ALL OTHER GUIDANCE"
- Always included in full before any other context section
- Guidance hierarchy: Manifesto > System Prompt > Style Guide > Story Bible > Characters > Outline > Scene

**What to put here:**
- Core themes that define the series
- Tone rules that must never change
- Character treatment rules
- Reader experience goals
- Any truth that, if contradicted, would break the story

---

## Story Dossier (Project-Level)

- Braindump: Author's notes, themes, tone goals, creative direction
- Genre Tropes: Common tropes to embrace or subvert
- AI generates comprehensive project guidebook from braindump
- Streaming generation with progress tracking
- AI references project dossier during all scene generation

---

## Logic Checks

- AI-powered consistency and plausibility checking
- Target options: Story Dossier, Outline/Synopsis, Chapter, Character, Worldbuilding
- AI analyzes for: contradictions, plausibility gaps, character inconsistency, timeline issues, world rule violations
- Results stored with timestamps
- View history of all past checks

---

## Voice Chat

- Conversational AI assistant for writing help via voice
- Browser-native speech recognition (continuous mode)
- Voice synthesis for AI responses
- Full project context loaded automatically:
  - Project title, genre, description
  - All characters, places, things, technologies
  - All outlines and chapters
  - Top 50 story bible entries
  - Style anchors
- Chat memory within session
- Configurable voice selection, speech rate, pitch

---

## Audiobook Generation

- Chapter-by-chapter TTS narration
- Auto-chunks long chapters for processing
- 10+ preset Kokoro TTS voices
- Speed control (0.5x to 2x)
- Per-chunk status tracking: Pending, Generating, Uploading, Completed, Error
- Play/preview individual chunks
- Batch generation with abort capability
- Audio stored in database with URLs
- Full chapter audio assembly

---

## Production Pipeline (YouTube litRPG)

A 5-stage automated production pipeline with review gates at each step:

| Stage | Description |
|-------|-------------|
| 1. Analyse & Generate Images | LLM extracts visual moments, then ComfyUI generates images (with per-image prompt editing and regeneration) |
| 2. Animate Images | Adds subtle motion via LTX 2.3 Text2Video (optional -- skip for stills) |
| 3. Generate TTS Audio | Kokoro TTS narration with per-chunk editing and regeneration for pronunciation fixes |
| 4. Audio Assembly & Export | Browser-based WAV assembly + video manifest JSON for external editors |
| 5. Lip-sync Generation | LTX 2.3 LipSync Portrait -- character face + TTS audio = talking-head video |

- One job at a time (never concurrent)
- Per-item regeneration without restarting the stage
- Sequential file naming for assembly
- Stage Indicator shows visual progress (green/pulsing/amber/red)
- Review gates ensure quality control before proceeding

---

## Production-Scale Novel Generation

Full-book autonomous writing system designed for "set it and walk away" operation.

### Auto-Write Book
- Generates prose for every scene sequentially (Chapter 1 Scene 1 through Chapter N Scene N)
- Assembles each chapter when all its scenes complete
- Assembles full book manuscript when all chapters complete
- Saves after every single scene (crash-safe)
- Resume from exact position after interruption, browser refresh, or reboot
- Creates scene scaffolds automatically for chapters that have none
- Designed for 8-12 hour unattended runs

### Draft Quality Profiles
| Profile | Words/Scene | Use Case |
|---------|-------------|----------|
| Fast Draft | 500-800 | Quick testing, structure validation |
| Standard Draft | 1000-1500 | First pass, iteration |
| Novel Draft | 1500-2500 | Production writing (default) |
| Publisher Draft | 2500-4000 | Final quality, publication-ready |

### Context Continuity
Before each scene, the AI automatically receives:
- Series manifesto and themes
- Book outline synopsis
- Chapter summary and POV character
- Previous scene ending (continuity bridge)
- Character voice profile
- Setting description
- Relevant Story Bible entries
- Full character cast summaries

### Chapter Assembly
- Combines all scenes into single chapter document
- Preserves scene breaks (asterisk separators)
- Auto-generates chapter summary
- Tracks word count per chapter
- One-click re-assembly after edits

### Book Assembly
- Collects all assembled chapters in order
- Generates title page
- Generates table of contents with per-chapter word counts
- Calculates total manuscript word count
- Marks completion status (draft vs assembled)

### Character Voice Tracking
- Per-character voice profiles stored in database
- Speaking style, vocabulary, personality traits
- Emotional tendencies, relationship dynamics
- Sample dialogue for reference
- Auto-injected into every scene generation

### Living Story Bible Updates
- Post-generation extraction of new world elements
- Detects: characters, locations, technologies, organizations, events
- Approval queue (approve to add to Story Bible, reject to discard)
- World grows automatically as books are written

### Production Dashboard
- Books assembled / Chapters done / Scenes written / Total words
- Current generation step and activity
- Progress bar with estimated time remaining
- Run status (idle/running/paused/completed/failed)
- Error messages with resume capability

### Data Safety & Reliability
- Scene saves retry once on failure, then verify via readback
- Chapter assembly refuses to overwrite with shorter content (protects against partial loads)
- Book assembly refuses to downgrade a completed manuscript
- All operations save state to database for crash recovery
- Never repeats completed work on resume

---

## Settings & Configuration

### AI Model
- Model name, API endpoint (OpenAI-compatible)
- Temperature, Max Tokens, Top P, Top K
- Repetition Penalty, Presence Penalty, Frequency Penalty
- Context Length, System Prompt, Style Guide
- Stop Sequences
- Connection test with status indicator

### Model Presets (Multi-Model Routing)
- Define separate model configurations per task type
- Task modes: design_brief, outline, scene, rewrite, brainstorm, vision, utility
- Each preset: model name, endpoint, context length, max tokens, temperature, sampling params
- Active preset auto-routes generation to the right model
- Falls back to default settings when no preset exists
- Allows running different models for different jobs (e.g., small model for summaries, large for prose)

### Vision Model
- Separate model for image analysis
- Vision model name + endpoint
- Used for analyzing uploaded images and scene illustrations

### Image Generation (ComfyUI)
- ComfyUI endpoint (local or remote)
- Checkpoint selection
- Custom workflow upload
- Dimensions (width/height)
- Steps, CFG Scale, Sampler
- Negative prompt template
- Queue status display

### Text-to-Speech
- TTS workflow configuration
- Speaker selection
- Sample rate

### Lipsync
- Dimension configuration
- Orientation and noise mode

### Network Architecture
- Local mode: LM Studio + ComfyUI on desktop
- Remote mode: Remote API endpoints
- Hybrid mode: Mix of local and remote services
- Tailscale support for secure remote access
- Auto-detection and proxy routing (edge function proxies for remote, direct fetch for local)

---

## Data Export Capabilities

### Novel Export
- HTML (with embedded images, ideal for YouTube prep)
- Markdown (.md)
- Plain Text (.txt)
- Options: include/exclude images, embed images, include scene descriptions
- Preview before download
- Copy to clipboard

### Entity Packages (zip)
- Characters: name, role, personality, background, goals, dialogue style, image
- Places: name, type, description, history, significance, images
- Things: name, type, description, properties, history, notes, images
- Technologies: name, type, description, rules, applications, notes, images

### Project Backup
- Complete JSON export of entire project
- All entities, scenes, outlines, bible entries, settings
- Import to create new project (non-destructive)

---

## Style & Quality Control Systems

1. **Style Anchors:** Example passages AI emulates
2. **Style Rules:** Enforceable writing rules per project
3. **Prohibited Words:** Words AI must avoid
4. **System Prompt:** Global behavior instructions for AI
5. **Style Guide:** Prose style instructions
6. **Personality Sliders:** Quantified character voice dimensions
7. **Canon Status:** Control which entities are active/referenced
8. **Story Bible:** Enforced canonical facts
9. **Character States:** Ensure physical/emotional continuity
10. **Editing Passes:** Structured revision with AI assistance

---

## Key Design Principles

- **Blueprint before prose:** Story Forge is built on the premise that great series come from complete development blueprints. The tools guide authors through world-building, planning, and structural design before a single chapter is written.
- **World-building first:** The app is designed around the assumption that authors build their world (characters, places, manifesto, story bible) before using the writing tools. Rich world data produces rich AI output; empty world data produces generic output.
- **Set it and walk away:** Production-scale generation is designed for autonomous long-run operation. Every step saves immediately, resumes from interruption, and never loses completed work.
- **Context-first generation:** AI always sees the full relevant project state
- **Quick Start to Power User:** The Quick Start wizard removes writer's block by generating a full backbone from 3 inputs. The results feed into the advanced editor for fine-tuning, so casual users get momentum and power users get control.
- **Series At A Glance:** After Quick Start completes, a bird's-eye summary shows the full scope of the generated series (book list, chapter count, word estimate, characters, themes) before the author commits.
- **Immediate testability:** Saving Quick Start output auto-creates scenes for ALL chapters with starter content in Chapter 1, so the user can test TTS, Pipeline, and Write features without any additional setup.
- **Review gates:** Human approval required at every production stage
- **Non-destructive:** Backups, canon statuses, downgrade protection, and version tracking prevent data loss
- **Local-first:** Runs against local models for privacy and uncensored output
- **Single responsibility views:** Each page handles one concern
- **Progressive disclosure:** Advanced features (sliders, dossier, hero's journey) are collapsible
- **Streaming responses:** Real-time feedback during AI generation
