# Generation Rules

## System Architecture for Multi-Pass Series Generation

This document contains system instructions for the AI generation pipeline.
These rules govern HOW content is generated, not WHAT the story contains.

Story truth belongs in the Story Bible.
Generation behavior belongs here.

---

## Generation Order

1. Series Architect
2. Book Architect
3. Chapter Architect
4. Scene Architect
5. Scene Writer
6. Assembly

Broad planning happens first.
Detail increases as scope decreases.
No book should be generated without knowledge of the full series roadmap.
Reveal progression must be tracked across all books.
Future books must never reveal information reserved for later books.

---

## Series Architect Rules

Purpose: Create the full series roadmap before any prose begins.

Input:
- Manifesto
- Series premise
- Genre/tone
- Ending state
- Major lore
- Reveal timeline
- Existing world library

Output per book:
- Book title
- Core theme
- Beginning state
- Ending state
- Main conflict
- Major reveal
- Character arc focus
- Relationship movement
- Mystery/truth progression
- Setup for next book
- High-level book outline

Rules:
- Generate all selected books in one pass
- Keep each book compact enough to avoid truncation
- Do not generate detailed chapter briefs
- Do not generate scenes
- Do not generate prose

---

## Book Architect Rules

Purpose: Expand each book outline into chapters.

Process:
- Book 1 chapter outline first
- Book 2 with knowledge of Book 1
- Book 3 with knowledge of Books 1-2
- Continue sequentially

Each book gets:
- 10-15 chapters
- Chapter title
- POV character
- Location
- Emotional arc
- Plot function
- Relationship movement
- Reveal/mystery movement
- Ending hook

---

## Chapter Architect Rules

Purpose: Generate chapter design briefs from outlines.

Process through every book sequentially:
- Book 1 Chapter 1 brief through final chapter
- Then Book 2 Chapter 1 through final chapter
- Continue through all books

Each brief includes:
- Chapter purpose
- Emotional goal
- Character goals
- Conflict structure
- Theme goals
- Worldbuilding allowed
- Reveal restrictions
- Continuity requirements
- Scene-by-scene blueprint

After each brief:
- Save immediately
- Update reveal tracking if new reveals are planned
- Update consistency tracker with planned continuity facts
- Mark the chapter as ready for scene generation

---

## Scene Architect Rules

Purpose: Generate scene cards from chapter briefs.

For each chapter:
- Generate 3-5 scene cards
- Save into scene records automatically

Each scene card includes:
- Scene title
- POV
- Characters present
- Setting
- Opening beat
- Conflict/tension
- Key dialogue beats
- Emotional turn
- Worldbuilding allowed
- Reveal restrictions
- Closing beat
- Transition to next scene

---

## Scene Writer Rules

Purpose: Write one scene at a time from the saved blueprint.

Before each scene, inject:
- Series outline
- Current book outline
- Current chapter brief
- Current scene blueprint
- Previous scene ending
- POV character voice
- Relevant character summaries
- Setting description
- Relevant story bible facts
- Reveal restrictions
- Consistency tracker facts

After each scene:
- Save scene prose
- Verify save
- Generate scene summary
- Extract character state changes
- Extract reveal progress
- Extract new worldbuilding candidates
- Update consistency tracker
- Queue Story Bible suggestions for approval

---

## Assembly Rules

After all scenes in a chapter are written:
- Assemble chapter
- Preserve scene breaks
- Generate chapter summary
- Update chapter word count
- Update character states
- Update reveal timeline progress

After all chapters in a book are assembled:
- Assemble book manuscript
- Generate title page
- Generate table of contents
- Calculate total word count
- Mark book as drafted

---

## Continuity Loading Rules

Every generation layer must update:
- Character States
- Relationship States
- Reveal Progress
- Story Bible Extractions
- World State
- Known Historical Facts

Before generating any book, chapter, or scene the system must load:
- Series Roadmap
- Prior Book Summaries
- Character States
- Reveal Timeline Progress
- Relationship Tracker
- Story Bible Facts

The system must always know where it has been and where it is going.

---

## Accelerated Full-Series Mode

Unattended workflow:
1. Generate full series outline
2. Generate chapter outlines for all books
3. Generate chapter design briefs for all books
4. Generate scene blueprints for all books
5. Write Book 1 scenes
6. Assemble Book 1
7. Update reveals, consistency, character states, Story Bible queue
8. Write Book 2 with Book 1 continuity available
9. Continue through final book

Key: The system creates the full saga structure first, then writes each book in order while updating continuity between books.

---

## Guided Mode

Author approves after each layer:
1. Approve full series outline
2. Approve book chapter outlines
3. Approve chapter design briefs
4. Approve scene blueprints
5. Approve prose
6. Approve assembled book

---

## Context Budget Strategy

Each level gets scoped context to prevent bleed:

| Level | Context Injected |
|-------|-----------------|
| Series Architect | Manifesto, premise, ending state, world library, reveal timeline |
| Book Architect | Series plan + all prior book outlines |
| Chapter Architect | Series plan + current book outline + prior chapter briefs |
| Scene Architect | Current chapter brief + character summaries + setting |
| Scene Writer | Scene blueprint + previous scene ending + POV voice + consistency facts |
| Assembly | No AI needed (concatenation + metadata extraction) |

Each level gets less but more relevant context. That is the quality safeguard.
