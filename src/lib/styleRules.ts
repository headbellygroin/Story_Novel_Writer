export interface StyleRule {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export const BUILT_IN_STYLE_RULES: StyleRule[] = [
  {
    id: 'avoid_adverbs',
    label: 'Avoid Adverbs',
    description: 'Use precise verbs instead of verb+adverb. "Sprinted" not "ran quickly." "Whispered" not "said quietly."',
    prompt: 'STRICT RULE: Do NOT use adverbs (words ending in -ly that modify verbs). Instead, choose a more precise verb. For example: use "sprinted" instead of "ran quickly", "whispered" instead of "said quietly", "shuffled" instead of "walked slowly", "snapped" instead of "said angrily". Every adverb is a sign of a weak verb. If an adverb is absolutely the only way to convey the meaning, it may be used sparingly, but default to zero.',
  },
  {
    id: 'no_leading_the',
    label: 'Kill Leading "The"',
    description: 'Never start a sentence with "The." Restructure to open with action, character, or detail instead.',
    prompt: 'STRICT RULE: NEVER begin a sentence with the word "The". Every sentence that would start with "The" must be restructured. Techniques: lead with an action verb, lead with a character name, lead with a prepositional phrase, lead with a participle, or invert the clause order. Examples: Instead of "The door creaked open" write "Hinges screamed as the door swung wide." Instead of "The sun set behind the mountains" write "Crimson bled across the ridgeline." Instead of "The man stepped forward" write "Marcus stepped forward." This forces varied, dynamic sentence openings and eliminates monotonous phrasing.',
  },
  {
    id: 'no_linking_verbs',
    label: 'Eliminate Linking Verbs',
    description: 'Replace was/were/seemed/appeared/became with action. "He was tired" becomes "Exhaustion dragged at his limbs."',
    prompt: 'STRICT RULE: Eliminate linking verbs (was, were, is, am, are, been, being, seemed, appeared, became, felt, looked, sounded, remained, grew, turned, proved, stayed). These verbs describe states instead of actions and make prose feel static. Replace every linking verb construction with an action, image, or sensory detail. "She was afraid" becomes "Her hands shook." "The room was dark" becomes "Darkness swallowed the room." "He seemed tired" becomes "His eyelids drooped, each blink slower than the last." Linking verbs are acceptable only in dialogue where a character would naturally speak that way.',
  },
  {
    id: 'show_dont_tell',
    label: 'Show, Don\'t Tell',
    description: 'Reveal emotions through action, dialogue, and body language rather than stating them directly.',
    prompt: 'STRICT RULE: Show emotions and states through actions, body language, dialogue, and sensory detail rather than telling. Do NOT write "she was angry" -- instead show clenched fists, a sharp tone, a slammed door. Do NOT write "he felt sad" -- instead show slumped shoulders, a quiet voice, eyes fixed on nothing.',
  },
  {
    id: 'active_voice',
    label: 'Prefer Active Voice',
    description: 'Subject does the action. "Rain hammered the roof" not "The roof was hammered by rain."',
    prompt: 'STRICT RULE: Use active voice where the subject performs the action. Write "Rain hammered the roof" not "The roof was hammered by rain." Write "She broke the lock" not "The lock was broken by her." Passive construction (subject + was/were + past participle + by) must be restructured so the actor leads. Passive voice is only acceptable when the actor is genuinely unknown or deliberately hidden for narrative effect.',
  },
  {
    id: 'tight_dialogue',
    label: 'Minimal Dialogue Tags',
    description: 'Use "said" or no tag at all. Avoid flowery tags like "exclaimed" or "proclaimed."',
    prompt: 'STRICT RULE: Use "said" as the default dialogue tag, or omit the tag entirely when the speaker is clear from context. Never use ornate tags like "exclaimed", "proclaimed", "opined", "queried", or "retorted". Action beats are preferred over tags when possible.',
  },
  {
    id: 'no_filter_words',
    label: 'Cut Filter Words',
    description: 'Remove "felt", "saw", "heard", "seemed", "noticed" -- put the reader directly in the experience.',
    prompt: 'STRICT RULE: Eliminate filter words that create distance between the reader and the experience. Do NOT write "she felt the cold wind" -- write "cold wind bit her cheeks." Do NOT write "he saw the door open" -- write "the door swung open." Remove: felt, noticed, saw, heard, seemed, realized, watched, observed, wondered.',
  },
];

export function getActiveRulePrompts(styleRules: Record<string, boolean>): string[] {
  return BUILT_IN_STYLE_RULES
    .filter(rule => styleRules[rule.id])
    .map(rule => rule.prompt);
}
