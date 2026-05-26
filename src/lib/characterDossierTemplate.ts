export const CHARACTER_DOSSIER_TEMPLATE = `# Core Role
What purpose they serve emotionally and narratively within the story.
(e.g., emotional center, protector, stabilizer, catalyst, memory keeper, systems interpreter)



---

# Function / Occupation
Their actual operational role within the story world.
(e.g., Captain, Engineer, Teacher, Detective, Healer, Thief)



---

# Public Appearance
How the outside world sees them physically.

Include: body type, posture, expressions, clothing, movement, disabilities or visible differences, how strangers react to them.

Most importantly: How society interprets them.



---

# Internal Appearance
How their closest people see this person.

This represents: dignity, emotional self-image, idealized identity, internal confidence, how they feel among people who love them.

Include: idealized features, emotional aura, confidence, beauty, symbolic traits.



---

# Protagonist's Perspective
How the main character experiences both realities simultaneously.

Focus on: emotional interpretation, how they understand this person, why they accept them, what they notice others miss.



---

# Personality Traits

## Positive Traits
-
-
-

## Negative Traits
-
-
-

## Contradictory Traits
(Important for realism)
Examples: socially awkward but emotionally perceptive, intimidating but gentle, confident while deeply insecure
-
-

---

# Emotional Function Within Group
What emotional need this character fulfills for the group.
(e.g., safety, warmth, stability, intimacy, acceptance, humor, structure)



---

# Relationship With Setting
How they emotionally relate to the primary setting.
(e.g., friend, protector, home, parent, confidant, workplace, sanctuary)

Include: routines, habits, favorite areas, symbolic meaning.



---

# Relationship With Protagonist
How they emotionally view the protagonist.

Questions: Why do they trust them? What do they provide emotionally? What scares them about losing them?



---

# Key Relationships

(Repeat for each important relationship)

## [Character Name]
Include: conflict, trust, humor, dependency, emotional tension, shared rituals.



---

# Personal Fear
Their deepest emotional fear.

NOT surface fears. Examples: abandonment, uselessness, becoming a burden, being forgotten, losing control, isolation, hurting others.



---

# Personal Flaw
What prevents them from growing emotionally.

Examples: avoidance, emotional repression, dependency, denial, obsession, insecurity.



---

# Quiet Human Moments
Small moments that make them feel real.

Examples: late-night habits, nervous rituals, favorite foods, sleeping patterns, how they react when alone, tiny comforts.



---

# Comedy Dynamics
How they contribute to humor.

Examples: misunderstandings, blunt honesty, overconfidence, obsessive behavior, strange logic, emotional timing.



---

# Symbolic Theme
What they represent thematically.
(e.g., resilience, acceptance, memory, adaptation, labor, humanity, trust)



---

# Character Arc

## Beginning State
Who they are emotionally at the start.


## Midpoint Evolution
What begins changing.


## End State
Who they become emotionally.


---

# Book / Act Focus
Which book or act most strongly develops this character and why.



---

# Relationship To The Wider World
How this character naturally reveals: economics, infrastructure, culture, technology, labor systems, politics, traditions.

This keeps worldbuilding emotionally grounded.



---

# Legacy / Post-Crisis
How a major story event permanently changes them.

Questions: What part of them breaks? What part survives? What do they carry forward?

`;

export const DOSSIER_SECTIONS = [
  'Core Role',
  'Function / Occupation',
  'Public Appearance',
  'Internal Appearance',
  "Protagonist's Perspective",
  'Personality Traits',
  'Emotional Function Within Group',
  'Relationship With Setting',
  'Relationship With Protagonist',
  'Key Relationships',
  'Personal Fear',
  'Personal Flaw',
  'Quiet Human Moments',
  'Comedy Dynamics',
  'Symbolic Theme',
  'Character Arc',
  'Book / Act Focus',
  'Relationship To The Wider World',
  'Legacy / Post-Crisis',
];

export function countFilledSections(dossier: string): number {
  if (!dossier?.trim()) return 0;
  let count = 0;
  for (const section of DOSSIER_SECTIONS) {
    const regex = new RegExp(`#\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n---|-$|#)`, 'i');
    const match = dossier.match(regex);
    if (match) {
      const content = match[0]
        .replace(new RegExp(`#\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
        .replace(/\(.*?\)/g, '')
        .replace(/Examples?:.*$/gm, '')
        .replace(/Include:.*$/gm, '')
        .replace(/Focus on:.*$/gm, '')
        .replace(/Questions:.*$/gm, '')
        .replace(/NOT surface fears\./g, '')
        .replace(/##\s*\[Character Name\]/g, '')
        .replace(/##\s*(Positive|Negative|Contradictory) Traits/g, '')
        .replace(/##\s*(Beginning State|Midpoint Evolution|End State)/g, '')
        .replace(/-\s*$/gm, '')
        .replace(/---/g, '')
        .trim();
      if (content.length > 0) count++;
    }
  }
  return count;
}
