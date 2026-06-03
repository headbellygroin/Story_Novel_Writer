import { supabase } from '../lib/supabase';
import { generateScene, GenerationSettings } from './aiService';
import { resolveSettingsForTask } from './taskPresetResolver';

// ====== TYPES ======

export interface BookOwnershipRule {
  bookNumber: number;
  requiredOwner: string;
  requiredTheme: string;
  ownershipBeats: string[];
}

export interface RevealEntry {
  id: string;
  title: string;
  description: string;
  target_book: number | null;
  target_chapter: number | null;
  reveal_type?: string;
}

export interface WorldContext {
  characters: string[];
  places: string[];
  technologies: string[];
  factions: string[];
  things: string[];
  storyBible: string[];
}

export type GateStatus = 'passed' | 'warning' | 'failed' | 'needs_review';
export type MSUSeverity = 'minor' | 'major';
export type SceneDepthMode = 'fast_draft' | 'standard_draft' | 'novel_draft' | 'publisher_draft';

export interface OwnershipCheckResult {
  passed: boolean;
  score: number;
  failures: string[];
}

export interface MSUCheckResult {
  status: GateStatus;
  flags: string[];
  severity: MSUSeverity;
}

export interface RevealCheckResult {
  status: GateStatus;
  flags: string[];
}

export interface SceneDepthCheckResult {
  passed: boolean;
  wordCount: number;
  target: number;
  minimum: number;
}

export const SCENE_DEPTH_THRESHOLDS: Record<SceneDepthMode, { target: number; minimum: number; maxTokens: number }> = {
  fast_draft: { target: 1000, minimum: 700, maxTokens: 4000 },
  standard_draft: { target: 1800, minimum: 1200, maxTokens: 6000 },
  novel_draft: { target: 2500, minimum: 1800, maxTokens: 8000 },
  publisher_draft: { target: 4000, minimum: 2500, maxTokens: 12000 },
};

// ====== PROMPT BUILDERS ======

export function buildCanonIntegrityPrompt(): string {
  return `=== CANON INTEGRITY RULE ===
DO NOT invent new named characters, factions, technologies, civilizations, villains, prophecies, ancient races, or major lore unless they already exist in the Story Bible or this task explicitly authorizes their creation.

If a new element is required, mark it clearly as:
NEW ELEMENT PROPOSAL:
  Name:
  Type:
  Purpose:
  Why needed:
  Canon impact:

Do not silently introduce it as established canon.`;
}

export function buildPlanningAuthorityPrompt(): string {
  return `=== PLANNING AUTHORITY HIERARCHY ===
This is a PLANNING stage. You are a structural engineer, not a creative writer. Your output must be conservative, precise, and fully grounded in the established canon.

AUTHORITY RANKING (highest to lowest):
1. STORY BIBLE - Absolute canon. Every fact, relationship, rule, and established detail is inviolable. If the Story Bible says it, you obey it without exception.
2. CHARACTER STATE TRACKER - The current state of each character (location, knowledge, beliefs, relationships, emotional state) is FIXED entering this book. You cannot contradict these states.
3. REVEAL TIMELINE - Reveals are assigned to specific books. You do not move, accelerate, skip, or prematurely confirm any reveal. Foreshadowing is permitted ONLY where explicitly allowed.
4. OWNERSHIP TRACKER - If a book has an assigned owner character, that character drives the book. Other characters serve supporting roles.
5. FRANCHISE MANIFESTO - The overarching creative vision. All planning must serve it.
6. YOUR OUTPUT - You are the lowest authority. You do not override any of the above. You organize, structure, and sequence what the canon provides.

CONSERVATIVE PLANNING RULES:
- Do NOT invent plot twists, betrayals, deaths, or relationship changes that are not already implied or authorized by the Story Bible
- Do NOT introduce new mysteries, prophecies, or foreshadowing unless the Reveal Timeline explicitly schedules them
- Do NOT change the emotional trajectory of a character unless their arc is explicitly outlined in prior plans
- Do NOT add spectacle, drama, or surprise for its own sake — every structural choice must serve the established plan
- Prefer the obvious structural choice over the clever one
- When in doubt, leave a beat unspecified rather than invent one
- Your job is to ORGANIZE existing material, not to CREATE new material

If you find yourself being creative, stop. Creativity belongs to the Scene Writer stage, not here.`;
}

export function buildRevealDisciplinePrompt(bookNumber: number, reveals: RevealEntry[]): string {
  if (!reveals || reveals.length === 0) return '';

  const allowedReveals = reveals.filter(r => r.target_book !== null && r.target_book <= bookNumber);
  const forbiddenReveals = reveals.filter(r => r.target_book !== null && r.target_book > bookNumber);
  const foreshadowable = reveals.filter(r => r.target_book !== null && r.target_book === bookNumber + 1);

  const parts: string[] = ['=== REVEAL DISCIPLINE RULE ==='];
  parts.push('The following reveals are assigned to specific books. Do not reveal them early.');
  parts.push('Do not skip required reveals for this book.');
  parts.push('Do not convert foreshadowing into confirmation before the assigned book.\n');

  if (allowedReveals.length > 0) {
    parts.push(`For Book ${bookNumber}, you MAY reveal:`);
    allowedReveals.forEach(r => parts.push(`  - ${r.title}: ${r.description || ''}`));
    parts.push('');
  }

  if (forbiddenReveals.length > 0) {
    parts.push('You may NOT reveal (these belong to later books):');
    forbiddenReveals.slice(0, 20).forEach(r => parts.push(`  - [Book ${r.target_book}] ${r.title}: ${r.description || ''}`));
    parts.push('');
  }

  if (foreshadowable.length > 0) {
    parts.push('You may FORESHADOW (but NOT confirm):');
    foreshadowable.forEach(r => parts.push(`  - ${r.title}`));
  }

  return parts.join('\n');
}

export function buildOwnershipPrompt(rule: BookOwnershipRule): string {
  if (!rule || !rule.requiredOwner) return '';

  const parts: string[] = [
    `=== BOOK OWNERSHIP RULE (NON-NEGOTIABLE) ===`,
    `This is ${rule.requiredOwner}'s book. ${rule.requiredOwner} is the emotional center.`,
    `Theme: ${rule.requiredTheme || 'character transformation'}`,
    '',
    `IMPORTANT: Ownership does NOT mean POV dominance.`,
    `Ownership means ${rule.requiredOwner}:`,
    `- Experiences the largest internal change in this book`,
    `- Faces the central thematic conflict: "${rule.requiredTheme || 'their personal transformation'}"`,
    `- Drives the book's resolution through their choices`,
    `- Appears in the climax as the decision-maker`,
    '',
    `Other characters may carry POV scenes. Multiple POV characters are encouraged for pacing and perspective.`,
    `But the THEMATIC WEIGHT of the book belongs to ${rule.requiredOwner}. Their arc is the spine.`,
    `Other characters serve as mirrors, catalysts, or witnesses to ${rule.requiredOwner}'s transformation.`,
  ];

  if (rule.ownershipBeats && rule.ownershipBeats.length > 0) {
    parts.push('');
    parts.push('Required beats (non-negotiable):');
    rule.ownershipBeats.forEach((beat, i) => parts.push(`  ${i + 1}. ${beat}`));
  }

  return parts.join('\n');
}

export function buildSceneDepthPrompt(mode: SceneDepthMode): string {
  const { target, minimum } = SCENE_DEPTH_THRESHOLDS[mode];
  return `=== SCENE LENGTH REQUIREMENT ===
Target length: ${target} words (${mode.replace('_', ' ')} mode)
Minimum acceptable: ${minimum} words

Do not summarize the scene.
Do not end early.
Write a complete prose scene at the target length.
Use sensory detail, internal thought, action beats, dialogue turns, escalation, complication, and resolution.
If the scene feels complete before the target length, deepen character interiority, setting texture, conflict, and relationship beats.`;
}

// ====== CHECK FUNCTIONS ======

async function loadGateSettings(projectId: string): Promise<GenerationSettings> {
  const { data, error } = await supabase
    .from('generation_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !data) throw new Error('Generation settings not configured.');
  const global = data as GenerationSettings;
  return await resolveSettingsForTask(projectId, 'quality_gate', global);
}

export async function checkBookOwnership(
  projectId: string,
  _bookNumber: number,
  rawOutline: string,
  ownershipRule: BookOwnershipRule,
): Promise<OwnershipCheckResult> {
  const settings = await loadGateSettings(projectId);

  const prompt = `You are a quality gate reviewer. Analyze the following book outline and score it against ownership requirements.

=== OWNERSHIP RULE ===
Book Owner: ${ownershipRule.requiredOwner}
Theme: ${ownershipRule.requiredTheme}
Required Beats: ${ownershipRule.ownershipBeats.join('; ')}

=== BOOK OUTLINE ===
${rawOutline.slice(0, 8000)}

=== SCORING CRITERIA ===
1. Is ${ownershipRule.requiredOwner} the POV character in at least 40% of chapters? (count chapters with their POV)
2. Does the climax resolve ${ownershipRule.requiredOwner}'s personal theme ("${ownershipRule.requiredTheme}")?
3. Is ${ownershipRule.requiredOwner} the emotional center of the book (strongest arc)?
4. Are all required beats present?
5. Is ${ownershipRule.requiredOwner} NOT replaced by generic plot events in the climax?

Respond in EXACTLY this format:
SCORE: [0-100]
PASSED: [YES/NO]
FAILURES:
- [list each failure, or "none"]`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'deep_analysis',
    contextMode: 'minimal',
    context: {},
    settings: { ...settings, max_tokens: 1000 },
  });

  const score = parseInt(result.match(/SCORE:\s*(\d+)/i)?.[1] || '0');
  const passed = /PASSED:\s*YES/i.test(result);
  const failureSection = result.match(/FAILURES:\s*\n([\s\S]*?)$/i)?.[1] || '';
  const failures = failureSection
    .split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(l => l.length > 0 && !/^none$/i.test(l));

  return { passed: passed && score >= 70, score, failures };
}

export async function checkMSU(
  projectId: string,
  generatedText: string,
  _stage: 'series_architect' | 'book_architect' | 'chapter_architect_batch' | 'scene_architect',
  worldContext: WorldContext,
): Promise<MSUCheckResult> {
  const settings = await loadGateSettings(projectId);

  const approvedElements = [
    ...worldContext.characters.map(c => `Character: ${c}`),
    ...worldContext.places.map(p => `Place: ${p}`),
    ...worldContext.technologies.map(t => `Technology: ${t}`),
    ...worldContext.things.map(t => `Thing/Artifact: ${t}`),
    ...worldContext.factions.map(f => `Faction/Org: ${f}`),
  ].join('\n');

  const prompt = `You are a canon integrity checker. Identify any UNAPPROVED elements in the generated text that do not exist in the approved world library.

=== APPROVED WORLD ELEMENTS ===
${approvedElements.slice(0, 4000)}

=== STORY BIBLE FACTS ===
${worldContext.storyBible.slice(0, 20).join('\n')}

=== GENERATED TEXT TO CHECK ===
${generatedText.slice(0, 8000)}

=== WHAT COUNTS AS MSU (Making Stuff Up) ===
MAJOR (must be flagged):
- New NAMED characters not in the character list
- New factions or organizations
- New antagonist forces
- New technologies
- New civilizations or ancient races
- New historical claims or prophecies
- New major locations
- Any new element that changes the plot

MINOR (log as warning only):
- Unnamed background NPCs (dock worker, shopkeeper)
- Generic crowds or environmental flavor
- Generic locations (a corridor, a dock, a tavern)

Respond in EXACTLY this format:
STATUS: [PASSED/WARNING/FAILED]
SEVERITY: [minor/major]
FLAGS:
- [element name]: [type] - [reason it's unapproved]
- (or "none")`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'deep_analysis',
    contextMode: 'minimal',
    context: {},
    settings: { ...settings, max_tokens: 1500 },
  });

  const statusMatch = result.match(/STATUS:\s*(PASSED|WARNING|FAILED)/i);
  const severityMatch = result.match(/SEVERITY:\s*(minor|major)/i);
  const flagSection = result.match(/FLAGS:\s*\n([\s\S]*?)$/i)?.[1] || '';
  const flags = flagSection
    .split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(l => l.length > 0 && !/^none$/i.test(l) && !/^\(or/i.test(l));

  const status: GateStatus = statusMatch?.[1]?.toUpperCase() === 'PASSED' ? 'passed'
    : statusMatch?.[1]?.toUpperCase() === 'WARNING' ? 'warning'
    : 'failed';
  const severity: MSUSeverity = severityMatch?.[1]?.toLowerCase() === 'major' ? 'major' : 'minor';

  return { status, flags, severity };
}

export async function checkRevealTimeline(
  projectId: string,
  bookNumber: number,
  generatedText: string,
  revealTimeline: RevealEntry[],
  _stage: 'book_architect' | 'chapter_architect_batch' | 'scene_architect',
): Promise<RevealCheckResult> {
  if (!revealTimeline || revealTimeline.length === 0) {
    return { status: 'passed', flags: [] };
  }

  const settings = await loadGateSettings(projectId);

  const revealMap = revealTimeline.map(r =>
    `[Book ${r.target_book || '?'}] "${r.title}": ${r.description || 'no description'}`
  ).join('\n');

  const prompt = `You are a reveal timeline guardian. Check if this generated content respects the reveal schedule.

=== REVEAL TIMELINE ===
${revealMap}

=== CURRENT BOOK NUMBER: ${bookNumber} ===

=== GENERATED TEXT ===
${generatedText.slice(0, 8000)}

=== CHECK FOR ===
1. Does this text reveal information that belongs to a LATER book (book > ${bookNumber})? If so, flag it.
2. Does it skip a REQUIRED reveal for Book ${bookNumber}? (Only flag if a reveal explicitly targets this book and the text contradicts or omits it entirely.)
3. Does it contradict any prior reveal (from books 1 to ${bookNumber - 1})?
4. Does it convert foreshadowing into full confirmation before the assigned book?

Respond in EXACTLY this format:
STATUS: [PASSED/WARNING/FAILED]
FLAGS:
- [reveal title]: [violation type: early_reveal/skipped_reveal/contradicts_prior/premature_confirmation] - [explanation]
- (or "none")`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'deep_analysis',
    contextMode: 'minimal',
    context: {},
    settings: { ...settings, max_tokens: 1500 },
  });

  const statusMatch = result.match(/STATUS:\s*(PASSED|WARNING|FAILED)/i);
  const flagSection = result.match(/FLAGS:\s*\n([\s\S]*?)$/i)?.[1] || '';
  const flags = flagSection
    .split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(l => l.length > 0 && !/^none$/i.test(l) && !/^\(or/i.test(l));

  const status: GateStatus = statusMatch?.[1]?.toUpperCase() === 'PASSED' ? 'passed'
    : statusMatch?.[1]?.toUpperCase() === 'WARNING' ? 'warning'
    : 'failed';

  return { status, flags };
}

// ====== REPAIR FUNCTIONS ======

export async function repairBookOutline(
  projectId: string,
  _bookNumber: number,
  originalOutline: string,
  ownershipRule: BookOwnershipRule,
  failures: string[],
): Promise<string> {
  const settings = await loadGateSettings(projectId);

  const prompt = `You are a Story Doctor. This book outline failed ownership requirements. Rewrite it to fix the failures while preserving continuity.

=== FAILURES ===
${failures.map(f => `- ${f}`).join('\n')}

=== OWNERSHIP RULE ===
Book Owner: ${ownershipRule.requiredOwner}
Theme: ${ownershipRule.requiredTheme}
Required Beats: ${ownershipRule.ownershipBeats.join('; ')}

=== ORIGINAL OUTLINE ===
${originalOutline}

=== INSTRUCTIONS ===
- Keep the same number of chapters
- Keep the same chapter format (Chapter N: Title + fields)
- Ensure ${ownershipRule.requiredOwner} is POV in at least 40% of chapters
- Ensure the climax resolves ${ownershipRule.requiredOwner}'s theme
- Ensure all required beats are present
- Do NOT add new characters, factions, or lore not in the original
- Preserve continuity with prior/next books

Return the COMPLETE corrected outline in the same format.`;

  return await generateScene({
    sceneDescription: prompt,
    generationMode: 'outline',
    contextMode: 'minimal',
    context: {},
    settings,
  });
}

export async function repairMSU(
  projectId: string,
  originalText: string,
  flags: string[],
  worldContext: WorldContext,
  stage: string,
): Promise<string> {
  const settings = await loadGateSettings(projectId);

  const approvedElements = [
    ...worldContext.characters.map(c => `Character: ${c}`),
    ...worldContext.places.map(p => `Place: ${p}`),
    ...worldContext.technologies.map(t => `Technology: ${t}`),
    ...worldContext.things.map(t => `Thing: ${t}`),
    ...worldContext.factions.map(f => `Faction: ${f}`),
  ].join('\n');

  const prompt = `You are a canon repair specialist. Remove or replace all unapproved elements from this text.

=== UNAPPROVED ELEMENTS FLAGGED ===
${flags.map(f => `- ${f}`).join('\n')}

=== APPROVED WORLD ELEMENTS ===
${approvedElements.slice(0, 3000)}

=== ORIGINAL TEXT ===
${originalText}

=== REPAIR RULES ===
- Remove every unapproved named character, faction, technology, civilization, or lore claim
- Replace them with EXISTING approved elements where possible
- If no suitable replacement exists, restructure the passage without the unapproved element
- Do NOT invent new replacements
- Maintain the same structure and format as the original
- Keep all chapter/scene numbers and formatting intact

Return the COMPLETE repaired text.`;

  return await generateScene({
    sceneDescription: prompt,
    generationMode: stage === 'book_architect' ? 'outline' : 'design_brief',
    contextMode: 'minimal',
    context: {},
    settings,
  });
}

export async function repairReveal(
  projectId: string,
  bookNumber: number,
  originalText: string,
  revealFlags: string[],
  revealTimeline: RevealEntry[],
): Promise<string> {
  const settings = await loadGateSettings(projectId);

  const revealMap = revealTimeline.map(r =>
    `[Book ${r.target_book || '?'}] "${r.title}": ${r.description || ''}`
  ).join('\n');

  const prompt = `You are a reveal timeline repair specialist. Fix reveal timing violations in this text.

=== VIOLATIONS ===
${revealFlags.map(f => `- ${f}`).join('\n')}

=== REVEAL TIMELINE ===
${revealMap}

=== CURRENT BOOK: ${bookNumber} ===

=== ORIGINAL TEXT ===
${originalText}

=== REPAIR RULES ===
- Remove or obscure any information that belongs to books AFTER Book ${bookNumber}
- Convert premature confirmations back to foreshadowing or mystery
- If a required reveal for Book ${bookNumber} is missing, add a natural reference to it
- Do NOT change the structure or chapter count
- Do NOT add new characters or lore
- Maintain the same format as the original

Return the COMPLETE repaired text.`;

  return await generateScene({
    sceneDescription: prompt,
    generationMode: 'outline',
    contextMode: 'minimal',
    context: {},
    settings,
  });
}

export async function expandScene(
  projectId: string,
  originalContent: string,
  blueprintContext: string,
  briefContext: string,
  targetWords: number,
): Promise<string> {
  const settings = await loadGateSettings(projectId);

  const prompt = `This scene is under target length. Expand it without changing canon, plot outcome, POV, or ending.

=== SCENE BLUEPRINT ===
${blueprintContext}

=== CHAPTER BRIEF ===
${briefContext}

=== CURRENT SCENE (needs expansion) ===
${originalContent}

=== TARGET: ${targetWords} words ===

Add:
- More grounded physical action
- More sensory detail
- More dialogue turns
- More internal conflict
- More character-specific reactions
- Stronger emotional progression
- More environmental texture
- More tension before resolution

Do not add new plot events.
Do not add new named characters.
Do not change the scene ending.
Do not introduce new lore.

Return the expanded scene only.`;

  return await generateScene({
    sceneDescription: prompt,
    generationMode: 'scene',
    contextMode: 'minimal',
    context: {},
    settings: { ...settings, max_tokens: SCENE_DEPTH_THRESHOLDS.publisher_draft.maxTokens },
  });
}

// ====== UTILITY ======

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function buildWorldContextFromData(world: {
  characters: Array<{ name: string }>;
  places: Array<{ name: string }>;
  things: Array<{ name: string }>;
  technologies: Array<{ name: string }>;
  bibleFacts: Array<{ subject: string; fact: string; category?: string }>;
}): WorldContext {
  const factions: string[] = [];
  const storyBible: string[] = [];

  for (const fact of world.bibleFacts) {
    storyBible.push(`[${fact.category || 'general'}] ${fact.subject}: ${fact.fact}`);
    if (fact.category === 'faction' || fact.category === 'organization') {
      factions.push(fact.subject);
    }
  }

  return {
    characters: world.characters.map(c => c.name),
    places: world.places.map(p => p.name),
    technologies: world.technologies.map(t => t.name),
    things: world.things.map(t => t.name),
    factions,
    storyBible,
  };
}
