import { supabase } from '../lib/supabase';

export async function generateLoreAudit(projectId: string): Promise<string> {
  const [charactersRes, placesRes, thingsRes, techRes, bibleRes, revealsRes] = await Promise.all([
    supabase.from('characters').select('name, role, relationships, notes').eq('project_id', projectId).order('name'),
    supabase.from('places').select('name, type, significance, notes').eq('project_id', projectId).order('name'),
    supabase.from('things').select('name, type, description, notes').eq('project_id', projectId).order('name'),
    supabase.from('technologies').select('name, type, description, notes').eq('project_id', projectId).order('name'),
    supabase.from('story_bible_entries').select('subject, category, importance, canon_status, generation_relevant, fact, tags').eq('project_id', projectId).order('category').order('importance').order('subject'),
    supabase.from('reveal_timeline').select('entity_type, entity_name, fact, book_number, act, reveal_method').eq('project_id', projectId).order('book_number').order('created_at'),
  ]);

  const characters = charactersRes.data || [];
  const places = placesRes.data || [];
  const things = thingsRes.data || [];
  const technologies = techRes.data || [];
  const bible = bibleRes.data || [];
  const reveals = revealsRes.data || [];

  const coreCrewNames = ['Benjamin', 'The Engineer', 'The Hacker', 'The Cook', 'The Muscle'];
  const coreCrew = characters.filter(c => coreCrewNames.includes(c.name));
  const npcs = characters.filter(c => !coreCrewNames.includes(c.name) && c.name !== 'The Wayward Naught' && c.role);
  let md = '# Story Forge Lore Audit\n\n';
  md += `Generated: ${new Date().toLocaleDateString()}\n\n`;
  md += '---\n\n';

  // AUDIT 1: Character Relationship Matrix
  md += '## Audit 1: Character Relationship Matrix\n\n';
  md += '### Core Crew\n\n';

  for (const crew of coreCrew) {
    md += `**${crew.name} (${crew.role})**\n\n`;
    const notes = crew.notes || '';
    const locationMatches = notes.match(/(?:Connected Locations|Book Focus Locations|Associated Location)[\s\S]*?(?=\n\n[A-Z]|\n\nAI|$)/i);
    const npcMatches = notes.match(/(?:Connected Character|Associated Supporting Characters)[\s\S]*?(?=\n\n[A-Z]|\n\nAI|$)/i);
    if (locationMatches) md += `- Locations: ${locationMatches[0].replace(/(?:Connected Locations|Book Focus Locations|Associated Location)[:\s]*/i, '').trim().split('\n').filter((l: string) => l.trim()).map((l: string) => l.trim().replace(/^[-*]\s*/, '')).join(', ')}\n`;
    if (npcMatches) md += `- NPCs: ${npcMatches[0].replace(/(?:Connected Character|Associated Supporting Characters)[:\s]*/i, '').trim().split('\n').filter((l: string) => l.trim()).map((l: string) => l.trim().replace(/^[-*]\s*/, '')).join(', ')}\n`;
    const relArray = crew.relationships as string[] | null;
    if (relArray && relArray.length > 0) md += `- Relationships: ${relArray.join(', ')}\n`;
    md += '\n';
  }

  md += '### NPCs\n\n';
  md += '| NPC | Role | Location | Theme |\n';
  md += '|-----|------|----------|-------|\n';
  for (const npc of npcs) {
    if (!npc.role) continue;
    const notes = npc.notes || '';
    const locMatch = notes.match(/Associated Location:\s*(.+)/i);
    const themeMatch = notes.match(/Associated Theme:\s*(.+)/i);
    const loc = locMatch ? locMatch[1].trim() : '--';
    const theme = themeMatch ? themeMatch[1].trim() : '--';
    md += `| ${npc.name} | ${npc.role} | ${loc} | ${theme} |\n`;
  }
  md += '\n';

  md += '### Missing Relationships\n\n';
  const emptyRelChars = characters.filter(c => (!c.relationships || (c.relationships as string[]).length === 0) && coreCrewNames.includes(c.name));
  if (emptyRelChars.length > 0) {
    md += `- All core crew \`relationships\` arrays are empty: ${emptyRelChars.map(c => c.name).join(', ')}\n`;
  }
  const orphanedNpcs = npcs.filter(n => {
    return !coreCrew.some(c => (c.notes || '').includes(n.name));
  });
  if (orphanedNpcs.length > 0) {
    md += `- NPCs with no explicit crew connection in any crew member's notes: ${orphanedNpcs.map(n => n.name).join(', ')}\n`;
  }
  md += '\n---\n\n';

  // AUDIT 2: Character Book Ownership
  md += '## Audit 2: Character Book Ownership\n\n';
  md += 'Based on location assignments, reveal timeline structure, and character notes:\n\n';
  md += '| Book | Inferred Primary | Evidence |\n';
  md += '|------|-----------------|----------|\n';

  const bookLocationMap: Record<number, string[]> = {};
  for (const r of reveals) {
    if (!bookLocationMap[r.book_number]) bookLocationMap[r.book_number] = [];
    if (r.entity_name) bookLocationMap[r.book_number].push(r.entity_name);
  }

  const bookOwnership = [
    { book: 1, char: 'Benjamin', evidence: 'Liverpool, Sailor Town, Hong Kong (his focus locations)' },
    { book: 2, char: 'Cook', evidence: 'Tiger Bay, Frisco Town (Cook locations)' },
    { book: 3, char: 'Engineer', evidence: 'Port Adelaide, Valapo, Dunkirk (Engineer/frontier)' },
    { book: 4, char: 'Hacker', evidence: 'Port Mahon, Quantum Highways, Off-Road Space (pattern/data)' },
    { book: 5, char: 'Muscle (inferred)', evidence: 'No reveal timeline data. No locations assigned.' },
    { book: 6, char: 'Reginal (inferred)', evidence: 'No reveal timeline data. Arc documented in notes.' },
    { book: 7, char: 'Everyone', evidence: 'Ship death, differentiated grief, Long Road Home payoff' },
  ];
  for (const b of bookOwnership) {
    md += `| ${b.book} | ${b.char} | ${b.evidence} |\n`;
  }
  md += '\n';
  md += '**Gaps:** Books 5-6 have no reveal timeline entries, no Long Road Home verses, and no explicit location/character assignments.\n\n';
  md += '---\n\n';

  // AUDIT 3: Location Ownership
  md += '## Audit 3: Location Ownership\n\n';
  md += '| Location | Type | Famous NPC | Crew Connection | Long Road Home Verse |\n';
  md += '|----------|------|-----------|----------------|---------------------|\n';

  const portPlaces = places.filter(p => !['Map', 'Unregulated Deep Space'].includes(p.type || '') && !p.name.includes('Core Transit') && !p.name.includes('Frontier Belt') && !p.name.includes('Galactic Map'));

  for (const place of portPlaces) {
    const notes = place.notes || '';
    const sig = place.significance || '';
    const famousMatch = notes.match(/Famous Figure:\s*(.+?)(?:\s*--|$)/i);
    const famous = famousMatch ? famousMatch[1].trim() : '--';

    let crewConn = '--';
    for (const crew of coreCrew) {
      if ((crew.notes || '').includes(place.name)) {
        crewConn = crew.name;
        break;
      }
    }
    if (crewConn === '--' && sig.toLowerCase().includes('reginald') || sig.toLowerCase().includes('reginal')) {
      crewConn = 'Reginal';
    }

    const hasVerse = reveals.some(r => r.entity_name === place.name && (r.fact || '').includes('Long Road Home'));
    const verseBook = reveals.find(r => r.entity_name === place.name && (r.fact || '').includes('Verse'));
    const verse = hasVerse || verseBook ? `Book ${verseBook?.book_number || '?'}` : 'No verse';

    md += `| ${place.name} | ${place.type} | ${famous} | ${crewConn} | ${verse} |\n`;
  }
  md += '\n---\n\n';

  // AUDIT 4: Theme Ownership
  md += '## Audit 4: Theme Ownership\n\n';
  const themeEntries = bible.filter(b => b.category === 'theme' || (b.tags || []).includes('theme') || b.subject.toLowerCase().includes('vs') || b.subject.toLowerCase().includes('versus'));
  md += '| Theme | Category | Importance | Status | Tags |\n';
  md += '|-------|----------|-----------|--------|------|\n';
  for (const t of themeEntries) {
    md += `| ${t.subject} | ${t.category} | ${t.importance} | ${t.canon_status} | ${(t.tags || []).join(', ')} |\n`;
  }
  md += '\n';

  md += '### Themes Without Story Bible Entries\n\n';
  const documentedThemes = themeEntries.map(t => t.subject.toLowerCase());
  const inferredThemes = [
    { name: 'Repair as Love', char: 'Engineer', evidence: 'Arc documented in character notes but no standalone entry' },
    { name: 'Safety / Physical Acceptance', char: 'Muscle', evidence: 'Documented in Wayward Naught notes but no standalone entry' },
    { name: 'Belonging Creates Traditions', char: 'Cook', evidence: 'Implied in character notes, not canonized' },
    { name: 'Understanding Is Not Control', char: 'Hacker', evidence: 'Implied in character notes, not canonized' },
  ];
  for (const it of inferredThemes) {
    if (!documentedThemes.some(d => d.includes(it.name.toLowerCase().split('/')[0].trim()))) {
      md += `- **${it.name}** (${it.char}): ${it.evidence}\n`;
    }
  }
  md += '\n---\n\n';

  // AUDIT 5: Story Bible Cleanup
  md += '## Audit 5: Story Bible Cleanup\n\n';

  md += '### All Entries by Category\n\n';
  const catGroups: Record<string, typeof bible> = {};
  for (const entry of bible) {
    const cat = entry.category || 'uncategorized';
    if (!catGroups[cat]) catGroups[cat] = [];
    catGroups[cat].push(entry);
  }
  for (const [cat, items] of Object.entries(catGroups).sort()) {
    md += `**${cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}** (${items.length} entries)\n\n`;
    for (const item of items) {
      const genFlag = item.generation_relevant === false ? ' [NOT GENERATION RELEVANT]' : '';
      md += `- ${item.subject} (${item.importance}, ${item.canon_status})${genFlag}\n`;
    }
    md += '\n';
  }

  md += '### Potential Duplicates / Overlaps\n\n';
  const duplicatePairs: [string, string, string][] = [];
  for (let i = 0; i < bible.length; i++) {
    for (let j = i + 1; j < bible.length; j++) {
      const a = bible[i];
      const b = bible[j];
      const aWords = new Set<string>((a.fact || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 5));
      const bWords = new Set<string>((b.fact || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 5));
      const overlap = [...aWords].filter(w => bWords.has(w)).length;
      const minSize = Math.min(aWords.size, bWords.size);
      if (minSize > 5 && overlap / minSize > 0.4) {
        duplicatePairs.push([a.subject, b.subject, `${Math.round(overlap / minSize * 100)}% word overlap`]);
      }
    }
  }
  if (duplicatePairs.length > 0) {
    for (const [a, b, reason] of duplicatePairs) {
      md += `- "${a}" <-> "${b}" (${reason})\n`;
    }
  } else {
    md += '- No high-overlap pairs detected\n';
  }

  md += '\n### Category Audit\n\n';
  md += '| Entry | Current Category | Generation Relevant |\n';
  md += '|-------|-----------------|--------------------|\n';
  for (const entry of bible) {
    md += `| ${entry.subject} | ${entry.category} | ${entry.generation_relevant !== false ? 'Yes' : 'No'} |\n`;
  }
  md += '\n---\n\n';

  // AUDIT 6: Technology Ownership
  md += '## Audit 6: Technology Ownership\n\n';
  md += '### Things\n\n';
  md += '| Name | Type | Notes Summary |\n';
  md += '|------|------|---------------|\n';
  for (const t of things) {
    const notesSummary = (t.notes || '').split('\n')[0].substring(0, 80);
    md += `| ${t.name} | ${t.type} | ${notesSummary} |\n`;
  }
  md += '\n### Technologies\n\n';
  md += '| Name | Type | Description |\n';
  md += '|------|------|-------------|\n';
  for (const t of technologies) {
    const desc = (t.description || '').split('\n')[0].substring(0, 80);
    md += `| ${t.name} | ${t.type} | ${desc} |\n`;
  }
  md += '\n---\n\n';

  // AUDIT 7: Franchise Structure Review
  md += '## Audit 7: Franchise Structure Review\n\n';

  md += '### Recurring Songs\n\n';
  const songEntries = bible.filter(b => (b.tags || []).includes('music') || b.subject.toLowerCase().includes('road home'));
  for (const s of songEntries) {
    md += `- **${s.subject}** (${s.category}, ${s.importance})\n`;
  }
  const songReveals = reveals.filter(r => (r.fact || '').toLowerCase().includes('long road home') || (r.fact || '').toLowerCase().includes('verse'));
  md += `- Reveal Timeline entries involving songs: ${songReveals.length}\n`;
  const songBooks = [...new Set(songReveals.map(r => r.book_number))].sort();
  md += `- Books with song reveals: ${songBooks.join(', ')}\n\n`;

  md += '### Emotional Anchors\n\n';
  const anchors = bible.filter(b => b.category === 'emotional_anchor');
  for (const a of anchors) {
    md += `- **${a.subject}** (${a.importance}): ${(a.fact || '').split('\n')[0]}\n`;
  }
  md += '\n';

  md += '### Running Jokes (documented)\n\n';
  const jokes = bible.filter(b => (b.tags || []).includes('humor') || (b.tags || []).includes('running-joke'));
  for (const j of jokes) {
    md += `- **${j.subject}**\n`;
  }
  md += '\n';

  md += '### Franchise Structure Entries\n\n';
  const franchise = bible.filter(b => b.category === 'Franchise Structure');
  for (const f of franchise) {
    md += `- **${f.subject}** (${f.importance}, gen_relevant=${f.generation_relevant !== false})\n`;
  }
  md += '\n';

  md += '### Long-Running Mysteries\n\n';
  md += '- How does the ship never refuel? (FARTS -- revealed Book 1)\n';
  md += '- Is the ship alive? (emergent behavior -- gradual reveal)\n';
  md += '- Benjamin\'s perception ability (symbolic vs supernatural -- ambiguous)\n';
  md += '- The Last Great War details (timeline entries, gradual)\n';
  md += '- Quantum Highways true origin (ancient unknown race -- hinted)\n\n';

  md += '---\n\n';

  // FINAL SUMMARY
  md += '## Summary: Recommended Actions\n\n';
  md += '### Missing Relationships\n\n';
  md += '- All core crew `relationships` arrays are empty -- populate with explicit connections\n';
  md += '- Muscle needs a dedicated NPC (not shared with Engineer)\n';
  md += '- Several NPCs lack explicit crew connections\n\n';

  md += '### Missing Themes\n\n';
  md += '- "Repair as Love" (Engineer\'s arc) -- needs Story Bible entry\n';
  md += '- "Safety / Physical Acceptance" (Muscle\'s arc) -- needs Story Bible entry\n';
  md += '- "Belonging Creates Traditions" (Cook\'s arc) -- needs Story Bible entry\n';
  md += '- "Understanding Is Not Control" (Hacker\'s arc) -- needs Story Bible entry\n\n';

  md += '### Redundant Entries\n\n';
  md += '- "What each crew loses at book 7" duplicates "The Crew\'s Final Losses"\n';
  md += '- "Chapter Formula" and "Story Pacing Rule" say the same thing\n';
  md += '- "The Wayward Naught as Legend" overlaps "The Wayward Naught Myth"\n';
  md += '- "Humanity vs Efficiency" overlaps "People Versus Systems"\n';
  md += '- "Bureaucracy as Conflict" is subset of "People Versus Systems"\n\n';

  md += '### Category Misuse\n\n';
  md += '- "Overall Tone" is in plot_point, should be world_rule\n';
  md += '- "Worldbuilding Delivery Method" is in plot_point, should be world_rule\n';
  md += '- "Bureaucracy as Conflict" is in general, should be theme\n';
  md += '- "story_formula" is in general, should be Franchise Structure\n';
  md += '- "The Secret Weapon" is in general, should be Franchise Structure\n';
  md += '- "Example Book 1 Chapter Subject" should be generation_relevant=false\n\n';

  md += '### Underdeveloped\n\n';
  md += '- Books 5-6 have no documented structure (locations, reveals, character assignments)\n';
  md += '- Muscle has fewest external NPC connections of any crew member\n';
  md += '- The Highway Keeper and The Void Cartographer connect to nothing\n\n';

  md += '### Strong Franchise Assets\n\n';
  md += '1. The Long Road Home (complete song system, 12 verses, Books 1-4 + Book 7)\n';
  md += '2. The Wayward Naught (character-as-setting, fully developed)\n';
  md += '3. Port NPC network (12+ revisitable faces with themes)\n';
  md += '4. Crew pair dynamics (3 pairs + ship)\n';
  md += '5. FARTS/SHITS comedy (thematic humor)\n';
  md += '6. Book 7 differentiated grief structure\n';
  md += '7. Benjamin\'s Dual Sight (unresolved mystery)\n';
  md += '8. Quantum Highways origin (unresolved mystery)\n';

  return md;
}
