export interface SliderDefinition {
  id: string;
  label: string;
  negativePole: string;
  positivePole: string;
  levels: Record<number, string>;
}

export const PERSONALITY_SLIDERS: SliderDefinition[] = [
  {
    id: 'stress_calm',
    label: 'Stress / Calm',
    negativePole: 'Stressed',
    positivePole: 'Calm',
    levels: {
      [-10]: 'On the verge of breakdown; panicky, scattered, unable to think straight.',
      [-5]: 'Noticeably tense; snappy, irritable, distractible, catastrophizes internally.',
      [0]: 'Manageably pressured; feels strain but stays functional.',
      [5]: 'Relaxed and easygoing; handles setbacks with patience.',
      [10]: 'Deeply serene; unflappable even in crises, stabilizing presence.',
    },
  },
  {
    id: 'fear_courage',
    label: 'Fear / Courage',
    negativePole: 'Fearful',
    positivePole: 'Courageous',
    levels: {
      [-10]: 'Frozen by fear; avoids any perceived risk.',
      [-5]: 'Anxious and hesitant; frequently backs down from conflict.',
      [0]: 'Normally cautious; will face necessary risks after thought.',
      [5]: 'Bold; steps up in challenging situations.',
      [10]: 'Fearless to a fault; confronts danger head-on.',
    },
  },
  {
    id: 'suspicion_trust',
    label: 'Suspicion / Trust',
    negativePole: 'Suspicious',
    positivePole: 'Trusting',
    levels: {
      [-10]: 'Paranoid; assumes hidden agendas everywhere.',
      [-5]: 'Wary; slow to open up, expects manipulation.',
      [0]: 'Cautiously neutral; evaluates case-by-case.',
      [5]: 'Trusting; gives benefit of the doubt readily.',
      [10]: 'Naively trusting; easily persuaded or exploited.',
    },
  },
  {
    id: 'callous_empathic',
    label: 'Callous / Empathic',
    negativePole: 'Callous',
    positivePole: 'Empathic',
    levels: {
      [-10]: 'Cold and cruel; indifferent to suffering.',
      [-5]: 'Blunt and unsentimental; prioritizes practicality over feelings.',
      [0]: 'Moderately considerate; recognizes others\' feelings.',
      [5]: 'Warm and understanding; offers comfort and support.',
      [10]: 'Deeply empathic; absorbs others\' emotions, self-sacrificing.',
    },
  },
  {
    id: 'impulsivity_control',
    label: 'Impulsivity / Self-Control',
    negativePole: 'Impulsive',
    positivePole: 'Self-Controlled',
    levels: {
      [-10]: 'Completely impulsive; acts on first urge, chaotic behavior.',
      [-5]: 'Impetuous; often acts without thinking.',
      [0]: 'Mixed; sometimes impulsive, sometimes measured.',
      [5]: 'Deliberate; typically pauses to think.',
      [10]: 'Highly controlled; meticulously plans every action.',
    },
  },
  {
    id: 'dominance_submission',
    label: 'Dominance / Submission',
    negativePole: 'Dominant',
    positivePole: 'Submissive',
    levels: {
      [-10]: 'Overbearing; must lead and control everything.',
      [-5]: 'Assertive and competitive; pushes for their way.',
      [0]: 'Balanced; can lead or follow comfortably.',
      [5]: 'Cooperative; prefers to follow a clear leader.',
      [10]: 'Highly submissive; habitually yields, struggles to assert needs.',
    },
  },
  {
    id: 'pessimism_optimism',
    label: 'Pessimism / Optimism',
    negativePole: 'Pessimistic',
    positivePole: 'Optimistic',
    levels: {
      [-10]: 'Nihilistic; believes things are hopeless.',
      [-5]: 'Generally pessimistic; anticipates negative outcomes.',
      [0]: 'Realist; sees pros and cons.',
      [5]: 'Hopeful; expects things to work out.',
      [10]: 'Rose-colored; insists things will be fine regardless.',
    },
  },
  {
    id: 'introverted_extroverted',
    label: 'Introverted / Extroverted',
    negativePole: 'Introverted',
    positivePole: 'Extroverted',
    levels: {
      [-10]: 'Deeply withdrawn; avoids social contact.',
      [-5]: 'Reserved; keeps to a small circle.',
      [0]: 'Ambiverted; comfortable alone or social.',
      [5]: 'Outgoing; seeks social contact, energized by groups.',
      [10]: 'Highly extroverted; craves constant interaction.',
    },
  },
  {
    id: 'gut_logic',
    label: 'Gut / Logic',
    negativePole: 'Gut-Driven',
    positivePole: 'Logic-Driven',
    levels: {
      [-10]: 'Purely instinctive; goes entirely by intuition.',
      [-5]: 'Intuition-first; consults feelings, uses logic to justify.',
      [0]: 'Mixed; weighs both gut and rational analysis.',
      [5]: 'Analytical; seeks evidence and clear reasoning.',
      [10]: 'Hyper-rational; distrusts feelings entirely.',
    },
  },
  {
    id: 'detail_bigpicture',
    label: 'Detail / Big-Picture',
    negativePole: 'Detail-Focused',
    positivePole: 'Big-Picture',
    levels: {
      [-10]: 'Microscopic; obsessively focused on small details.',
      [-5]: 'Detail-attentive; careful with specifics.',
      [0]: 'Balanced; can zoom in or out as needed.',
      [5]: 'Big-picture oriented; focuses on overarching goals.',
      [10]: 'Abstract visionary; lives at the level of concepts.',
    },
  },
  {
    id: 'cautious_risktaker',
    label: 'Cautious / Risk Taker',
    negativePole: 'Cautious',
    positivePole: 'Risk Taker',
    levels: {
      [-10]: 'Risk-averse; avoids change, refuses gambles.',
      [-5]: 'Careful; prefers safe, proven paths.',
      [0]: 'Moderate; willing to take some risks when necessary.',
      [5]: 'Adventurous; enjoys taking chances.',
      [10]: 'Reckless; chases risk for its own sake.',
    },
  },
  {
    id: 'serious_humorous',
    label: 'Seriousness / Humor',
    negativePole: 'Serious',
    positivePole: 'Humorous',
    levels: {
      [-10]: 'Grave; rarely jokes, treats topics solemnly.',
      [-5]: 'Earnest; occasional dry humor but generally straight-faced.',
      [0]: 'Balanced; can be playful or serious.',
      [5]: 'Lighthearted; frequently jokes, uses humor to connect.',
      [10]: 'Constant jokester; deflects emotions with humor.',
    },
  },
  {
    id: 'deception_honesty',
    label: 'Deception / Honesty',
    negativePole: 'Deceptive',
    positivePole: 'Honest',
    levels: {
      [-10]: 'Pathological liar; lies reflexively.',
      [-5]: 'Habitual deceiver; lies when advantageous.',
      [0]: 'Socially typical; mostly honest with white lies.',
      [5]: 'Principled honest; strongly prefers truth.',
      [10]: 'Radical honesty; blunt even when tact would help.',
    },
  },
  {
    id: 'stability_sensitivity',
    label: 'Stability / Sensitivity',
    negativePole: 'Stable',
    positivePole: 'Sensitive',
    levels: {
      [-10]: 'Unshakeable; criticism barely registers.',
      [-5]: 'Thick-skinned; handles most criticism without turbulence.',
      [0]: 'Typical; stung by harsh critique but recovers.',
      [5]: 'Sensitive; easily hurt by disapproval.',
      [10]: 'Extremely fragile; small comments feel like attacks.',
    },
  },
  {
    id: 'shame_selfworth',
    label: 'Shame / Self-Worth',
    negativePole: 'Shame',
    positivePole: 'Self-Worth',
    levels: {
      [-10]: 'Deep self-loathing; sees self as fundamentally broken.',
      [-5]: 'Insecure; frequently doubts worth.',
      [0]: 'Mixed; has both strengths and insecurities.',
      [5]: 'Healthy self-regard; recognizes flaws but believes in value.',
      [10]: 'High self-worth; strongly confident, may edge into arrogance.',
    },
  },
];

export function getSliderDescription(sliderId: string, value: number): string {
  const slider = PERSONALITY_SLIDERS.find(s => s.id === sliderId);
  if (!slider) return '';

  const levels = [-10, -5, 0, 5, 10];
  let closest = 0;
  let minDist = Infinity;
  for (const level of levels) {
    const dist = Math.abs(value - level);
    if (dist < minDist) {
      minDist = dist;
      closest = level;
    }
  }
  return slider.levels[closest] || '';
}

export function formatSlidersForPrompt(sliders: Record<string, number>): string {
  if (!sliders || Object.keys(sliders).length === 0) return '';

  const lines: string[] = [];
  for (const slider of PERSONALITY_SLIDERS) {
    const value = sliders[slider.id];
    if (value === undefined) continue;
    const desc = getSliderDescription(slider.id, value);
    lines.push(`${slider.label}: ${value} (${desc})`);
  }
  return lines.join('\n');
}
