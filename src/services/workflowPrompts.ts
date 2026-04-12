export function buildDossierPrompt(braindump: string, genreTropes: string, bookTitle: string): string {
  return `<braindump>
${braindump}
</braindump>

<genre_tropes>
${genreTropes}
</genre_tropes>

<instructions>
Given the above braindump information and genre tropes, create a pre-writing story dossier that has a list of everything the author will need to fully flesh out the characters, worldbuilding, and outline for ${bookTitle}.

Here's what you should include:

Characters: Make a complete list of characters, including minor ones, needed for this book. Label these as appropriate with their role in the story (protagonist, antagonist, side character, henchman, comic relief, love interest, etc.) Give a brief explanation of who the character is and their role in the story, but don't give too many details just yet. These should be no more than 1-2 sentences per character. When referencing a group of individuals instead of individual characters, make sure you name 3-5 minor characters who are or would be a part of that group, just so the author has named characters to use when writing scenes with members of those groups in them.

Worldbuilding Info: Make a complete list of all locations, objects, and other worldbuilding information that will be needed for this book. Give a brief explanation of what the worldbuilding element is and its role in the story, but don't give too many details just yet. These should be no more than one sentence per worldbuilding element.

Outline: Make a plan on what will be needed to fully outline this book. Do not actually start outlining the book yet, but give instructions on what will be needed and any suggestions you have.

Format your response using Markdown with clear headers and bullet points.
</instructions>`;
}

export function buildSceneBriefPrompt(
  chapterTitle: string,
  chapterSummary: string,
  outlineSynopsis: string,
  characters: string,
  worldbuilding: string,
  previousChapterText: string,
  genre: string,
): string {
  return `<outline>
${outlineSynopsis}
</outline>

<characters>
${characters}
</characters>

<worldbuilding>
${worldbuilding}
</worldbuilding>

${previousChapterText ? `<previous_chapter_text>\n${previousChapterText}\n</previous_chapter_text>` : ''}

<instructions>
Given the above outline and character/worldbuilding information, your task is to flesh out a "scene brief" for ${chapterTitle}. This scene brief should include the following:

POV: Identify the best point-of-view character for this chapter. Justify the choice based on emotional and narrative importance.

Genre: ${genre}

Plot (Verbatim + Beats): Extract the full plot summary for this chapter from the outline: "${chapterSummary}". Then draft 20-25 scene beats that establish all important details. Focus exclusively on what happens, not sensory details.

Scene Function: Define the narrative function (e.g., Inciting Incident, Character Introduction, World Establishment, Foreshadowing Device).

${previousChapterText ? 'Previous Chapter: Make sure this scene picks up appropriately after the end of the previous chapter text.' : ''}

Characters: List all characters appearing. For each, provide:
- Name & Role
- Physical Appearance for this scene (clothing, posture, visible wear)
- Emotional State & Goals in this moment
- Behavioral Notes (gestures, speech patterns, tics)

Setting: Describe the environment using sensory-rich language. Include time of day, terrain, sounds, smells, lighting, weather.

Main Source of Conflict: Explain the central dramatic tension. Is it internal, interpersonal, societal, or environmental? Show how it escalates.

Tone & Style Notes: Guide the writing voice with specific cues.

Symbolism or Thematic Layer: Identify symbols, metaphors, or archetypal moments that should emerge.

Continuity Considerations: Note links to past events or foreshadowing for future chapters. Mention items, emotional threads, or worldbuilding that must remain consistent.

Other Notes: Include worldbuilding mechanics, scene transitions, or structural devices.

Format using Markdown with clear section headers.
</instructions>`;
}

export function buildImprovementPlanPrompt(
  chapterContent: string,
  sceneBrief: string,
  previousChapterText: string,
  styleSheet: string,
  prohibitedWords: string[],
): string {
  return `<previous_chapter_text>
${previousChapterText || 'N/A - This is the first chapter.'}
</previous_chapter_text>

<chapter>
${chapterContent}
</chapter>

<scene_brief>
${sceneBrief}
</scene_brief>

<style_sheet>
${styleSheet}
</style_sheet>

<prohibited_words>
${prohibitedWords.join(', ')}
</prohibited_words>

<instructions>
Critique the chapter on a line-by-line basis and find ways to improve it. Give specific examples. Look for:

- Chapter Flow: Identify internal structure (hook, tension rise, end-of-chapter promise)
- Rhythm Check: Highlight slow pacing (exposition/info-dumps). Suggest scene breaks or cuts if needed.
- Show vs Tell: Highlight areas that tell instead of show, or lack deep point of view.
- Cliches: Highlight common cliches, overreliance on metaphors, and bad sentence-level writing.
- Adverbs: Identify over-reliance on adverbs.
- Dialogue Tags: Identify dialogue tags that are not "said" or "asked". Suggest replacements.
- Passive Voice: Flag instances of passive voice.
- Zero Fluff: Highlight overly wordy sentences and areas to reduce fluff.
- Voice Check: Compare each character's dialogue against their profile; flag off-character moments.
- Motivation Alignment: Ensure each action drives plot or character growth.
- Open Questions: Note unclear motives, logic gaps, or plot holes.
- Ending: Did the text end where the scene brief said? If not, specify where it should end.
- Beginning: Did the text begin naturally from the previous chapter? If not, specify how it should begin.
- Prohibited Words: Flag any use of words from the prohibited_words list.
- Reader Experience: Does the chapter leave readers eager for the next installment?

Make a specific improvement plan with line-by-line recommendations. The goal is to make the text sound more human and natural.
</instructions>`;
}

export function buildImplementEditPrompt(originalChapter: string, improvementPlan: string, chapterTitle: string): string {
  return `<original_chapter>
${originalChapter}
</original_chapter>

<improvement_plan>
${improvementPlan}
</improvement_plan>

<instructions>
Using the text of the <original_chapter> and the <improvement_plan>, implement the suggested changes. Only implement the suggested changes, and do not change anything else about the original_chapter. Reproduce the entire chapter with the suggested changes made.

The chapter should begin with the chapter header written in Markdown as an H2 heading: "## ${chapterTitle}"
</instructions>`;
}

export function buildLogicCheckPrompt(content: string, checkType: string): string {
  return `You will be auditing the following ${checkType} for logical consistency and plausibility.

<content>
${content}
</content>

<instructions>
Identify logical inconsistencies, implausible elements, character-world mismatches, and conflicts that would undermine the story's internal coherence.

Perform these audit checks:

1. Premise Logic Check: Does the core premise hold together internally?
2. Character-World Fit: Do characters' roles, goals, and capabilities make sense given the worldbuilding?
3. Worldbuilding Coherence: Do world elements support the premise? Any conflicting rules?
4. Plot Setup Plausibility: Are there obvious logistical impossibilities or motivation gaps?
5. Convenience Flags: Does anything rely on unlikely coincidences without justification?
6. Specific Fixes: For each issue, provide a concrete suggestion to resolve it.

For each issue, use this format:

**[Category] Issue:** [Brief description]
**LOGIC BREAK:** [What breaks the internal logic]
**References:** [Elements involved]
**FIX:** [Concrete suggestion]

If a category has no issues, state "No significant issues identified."

Structure your report with clear section headers.
</instructions>`;
}
