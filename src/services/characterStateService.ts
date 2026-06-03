import { supabase } from '../lib/supabase';
import { generateScene, GenerationSettings } from './aiService';
import { resolveSettingsForTask } from './taskPresetResolver';

export interface CharacterStateSnapshot {
  character_id: string;
  character_name: string;
  location: string;
  physical_state: string;
  emotional_state: string;
  knowledge: string;
  beliefs: string;
  possessions: string;
  relationships_changed: string;
  promises_made: string;
  unresolved_conflicts: string;
  role_in_next_book: string;
}

export interface CharacterStateRecord {
  id: string;
  project_id: string;
  character_id: string;
  book_number: number | null;
  location: string;
  physical_state: string;
  emotional_state: string;
  knowledge: string;
  beliefs: string;
  possessions: string;
  relationships_changed: string;
  promises_made: string;
  unresolved_conflicts: string;
  role_in_next_book: string;
  extraction_source: string;
  created_at: string;
}

const EXTRACTION_PROMPT = `You are a Character State Extractor. Given the assembled content of a completed book, extract the current state of each listed character AT THE END of this book.

=== CHARACTERS TO EXTRACT ===
{{CHARACTERS}}

=== BOOK CONTENT (summaries or full text) ===
{{CONTENT}}

For EACH character who appears meaningfully in this book, provide their state in this EXACT format:

CHARACTER: [exact character name]
- Location: [where they physically are at book end]
- Physical State: [injuries, appearance changes, health]
- Emotional State: [how they feel at book end]
- Knowledge: [key things they now know that they didn't before this book]
- Beliefs: [what they believe about the world, themselves, others - especially changed beliefs]
- Possessions: [important items gained or lost]
- Relationships Changed: [how their relationships with others shifted - be specific about with whom]
- Promises Made: [commitments they made to others during this book]
- Unresolved Conflicts: [tensions, grudges, or disputes that carry forward]
- Role in Next Book: [your assessment of their narrative function going forward]

RULES:
- Base extraction ONLY on what actually happened in the text, not on plans or outlines
- Be specific: name names, cite events, reference actual scenes
- If a character did not appear or had no meaningful changes, write "No significant changes" for each field
- Do NOT invent events that did not occur in the provided text
- Do NOT speculate beyond what the text supports
- Keep each field to 1-3 sentences maximum`;

export async function extractCharacterStatesFromBook(
  projectId: string,
  bookNumber: number,
  onLog?: (msg: string) => void,
): Promise<CharacterStateSnapshot[]> {
  const log = onLog || (() => {});

  const settings = await loadExtractionSettings(projectId);

  const { data: characters } = await supabase
    .from('characters')
    .select('id, name, description')
    .eq('project_id', projectId);

  if (!characters || characters.length === 0) {
    log('No characters found for extraction.');
    return [];
  }

  const bookContent = await getBookContentForExtraction(projectId, bookNumber);
  if (!bookContent) {
    log(`No assembled content found for Book ${bookNumber}.`);
    return [];
  }

  const characterList = characters.map(c => `- ${c.name}: ${c.description || 'No description'}`).join('\n');

  const prompt = EXTRACTION_PROMPT
    .replace('{{CHARACTERS}}', characterList)
    .replace('{{CONTENT}}', bookContent);

  log(`Extracting character states from Book ${bookNumber} (${characters.length} characters)...`);

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'deep_analysis',
    contextMode: 'minimal',
    context: {},
    settings,
  });

  const snapshots = parseExtractionResult(result, characters);
  log(`Extracted states for ${snapshots.length} characters.`);

  await saveCharacterStates(projectId, bookNumber, snapshots);
  log(`Saved ${snapshots.length} character state snapshots for Book ${bookNumber}.`);

  return snapshots;
}

async function loadExtractionSettings(projectId: string): Promise<GenerationSettings> {
  const { data, error } = await supabase
    .from('generation_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !data) throw new Error('Generation settings not configured.');
  const global = data as GenerationSettings;

  const resolved = await resolveSettingsForTask(projectId, 'quality_gate', global);
  return resolved;
}

async function getBookContentForExtraction(projectId: string, bookNumber: number): Promise<string | null> {
  const { data: plan } = await supabase
    .from('series_plans')
    .select('outline_id')
    .eq('project_id', projectId)
    .eq('book_number', bookNumber)
    .maybeSingle();

  if (!plan?.outline_id) return null;

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title, summary, order_index')
    .eq('outline_id', plan.outline_id)
    .order('order_index', { ascending: true });

  if (!chapters || chapters.length === 0) return null;

  const parts: string[] = [];

  for (const chapter of chapters) {
    const { data: assembly } = await supabase
      .from('chapter_assemblies')
      .select('content')
      .eq('chapter_id', chapter.id)
      .eq('status', 'assembled')
      .maybeSingle();

    if (assembly?.content) {
      const truncated = assembly.content.length > 8000
        ? assembly.content.slice(0, 4000) + '\n...[middle truncated]...\n' + assembly.content.slice(-4000)
        : assembly.content;
      parts.push(`--- Chapter ${chapter.order_index + 1}: ${chapter.title} ---\n${truncated}`);
    } else if (chapter.summary) {
      parts.push(`--- Chapter ${chapter.order_index + 1}: ${chapter.title} ---\n[Summary only] ${chapter.summary}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function parseExtractionResult(
  text: string,
  characters: Array<{ id: string; name: string }>,
): CharacterStateSnapshot[] {
  const snapshots: CharacterStateSnapshot[] = [];
  const sections = text.split(/CHARACTER:\s*/i).filter(s => s.trim().length > 0);

  for (const section of sections) {
    const nameMatch = section.match(/^(.+?)(?:\n|$)/);
    if (!nameMatch) continue;

    const extractedName = nameMatch[1].trim();
    const matched = characters.find(c =>
      c.name.toLowerCase() === extractedName.toLowerCase() ||
      c.name.toLowerCase().includes(extractedName.toLowerCase()) ||
      extractedName.toLowerCase().includes(c.name.toLowerCase())
    );

    if (!matched) continue;

    const noChanges = /no significant changes/i.test(section) && section.split(/no significant changes/i).length > 5;
    if (noChanges) continue;

    snapshots.push({
      character_id: matched.id,
      character_name: matched.name,
      location: extractStateField(section, 'location'),
      physical_state: extractStateField(section, 'physical state'),
      emotional_state: extractStateField(section, 'emotional state'),
      knowledge: extractStateField(section, 'knowledge'),
      beliefs: extractStateField(section, 'beliefs'),
      possessions: extractStateField(section, 'possessions'),
      relationships_changed: extractStateField(section, 'relationships changed'),
      promises_made: extractStateField(section, 'promises made'),
      unresolved_conflicts: extractStateField(section, 'unresolved conflicts'),
      role_in_next_book: extractStateField(section, 'role in next book'),
    });
  }

  return snapshots;
}

function extractStateField(section: string, fieldName: string): string {
  const regex = new RegExp(`[-*]\\s*${fieldName}\\s*:\\s*(.+?)(?=\\n[-*]|\\n\\n|$)`, 'is');
  const match = section.match(regex);
  return match ? match[1].trim() : '';
}

async function saveCharacterStates(
  projectId: string,
  bookNumber: number,
  snapshots: CharacterStateSnapshot[],
): Promise<void> {
  for (const snap of snapshots) {
    await supabase.from('character_states').insert({
      project_id: projectId,
      character_id: snap.character_id,
      book_number: bookNumber,
      location: snap.location,
      physical_state: snap.physical_state,
      emotional_state: snap.emotional_state,
      knowledge: snap.knowledge,
      beliefs: snap.beliefs,
      possessions: snap.possessions,
      relationships_changed: snap.relationships_changed,
      promises_made: snap.promises_made,
      unresolved_conflicts: snap.unresolved_conflicts,
      role_in_next_book: snap.role_in_next_book,
      extraction_source: 'pipeline',
    });
  }
}

// ====== CHARACTER STATE PROMPT BUILDER ======

export async function getLatestCharacterStates(
  projectId: string,
  beforeBookNumber: number,
): Promise<CharacterStateRecord[]> {
  const { data } = await supabase
    .from('character_states')
    .select('*')
    .eq('project_id', projectId)
    .lt('book_number', beforeBookNumber)
    .order('book_number', { ascending: false });

  if (!data || data.length === 0) return [];

  const latestPerCharacter = new Map<string, CharacterStateRecord>();
  for (const row of data as CharacterStateRecord[]) {
    if (!latestPerCharacter.has(row.character_id)) {
      latestPerCharacter.set(row.character_id, row);
    }
  }

  return Array.from(latestPerCharacter.values());
}

export function buildCharacterStatePrompt(states: CharacterStateRecord[], bookNumber: number): string {
  if (states.length === 0) return '';

  const header = `=== CHARACTER STATE ENTERING BOOK ${bookNumber} ===
ANTI-REGRESSION RULE: Characters enter this book in the states listed below. These states are CANON from completed prior books. You MUST NOT:
- Revert characters to earlier emotional states
- Reset relationships that have already changed
- Undo injuries, alliances, losses, or knowledge gains
- Treat former enemies as neutral if they became allies
- Treat former allies as friends if they became enemies
- Ignore promises, debts, or unresolved conflicts from prior books

Characters may ONLY change from these states through NEW events in THIS book. Their entry state is fixed.\n`;

  const entries = states.map(s => {
    const lines = [`CHARACTER: ${getCharacterNameFromState(s)}`];
    if (s.location) lines.push(`  Location: ${s.location}`);
    if (s.physical_state) lines.push(`  Physical: ${s.physical_state}`);
    if (s.emotional_state) lines.push(`  Emotional: ${s.emotional_state}`);
    if (s.knowledge) lines.push(`  Knows: ${s.knowledge}`);
    if (s.beliefs) lines.push(`  Believes: ${s.beliefs}`);
    if (s.relationships_changed) lines.push(`  Relationships: ${s.relationships_changed}`);
    if (s.promises_made) lines.push(`  Promises: ${s.promises_made}`);
    if (s.unresolved_conflicts) lines.push(`  Unresolved: ${s.unresolved_conflicts}`);
    if (s.role_in_next_book) lines.push(`  Role: ${s.role_in_next_book}`);
    return lines.join('\n');
  });

  return header + entries.join('\n\n');
}

function getCharacterNameFromState(state: CharacterStateRecord): string {
  return (state as any).character_name || state.character_id;
}

export async function buildCharacterStatePromptForBook(
  projectId: string,
  bookNumber: number,
): Promise<string> {
  if (bookNumber <= 1) return '';

  const states = await getLatestCharacterStates(projectId, bookNumber);
  if (states.length === 0) return '';

  const { data: characters } = await supabase
    .from('characters')
    .select('id, name')
    .eq('project_id', projectId);

  const charMap = new Map((characters || []).map(c => [c.id, c.name]));
  const enriched = states.map(s => ({
    ...s,
    character_name: charMap.get(s.character_id) || s.character_id,
  }));

  return buildCharacterStatePrompt(enriched, bookNumber);
}
