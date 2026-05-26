export interface InfraSliderDefinition {
  id: string;
  label: string;
  negativePole: string;
  positivePole: string;
  levels: Record<number, string>;
}

export const INFRASTRUCTURE_SLIDERS: InfraSliderDefinition[] = [
  {
    id: 'redundancy',
    label: 'Redundancy',
    negativePole: 'Minimal',
    positivePole: 'Extreme',
    levels: {
      [-10]: 'No backup systems; single point of failure everywhere.',
      [-5]: 'Basic redundancy only where legally required.',
      [0]: 'Standard redundancy; critical systems have backups.',
      [5]: 'Heavy redundancy; multiple fallbacks for most systems.',
      [10]: 'Obsessive redundancy; layers upon layers of safeguards, many irrational.',
    },
  },
  {
    id: 'adaptability',
    label: 'Adaptability',
    negativePole: 'Rigid',
    positivePole: 'Fluid',
    levels: {
      [-10]: 'Completely static; cannot accommodate changes.',
      [-5]: 'Slow to change; requires explicit reconfiguration.',
      [0]: 'Moderately adaptive; adjusts to major usage patterns.',
      [5]: 'Highly responsive; reshapes itself around crew behavior.',
      [10]: 'Eerily fluid; anticipates needs before they arise.',
    },
  },
  {
    id: 'efficiency',
    label: 'Efficiency',
    negativePole: 'Wasteful',
    positivePole: 'Optimal',
    levels: {
      [-10]: 'Grossly inefficient; resources allocated irrationally.',
      [-5]: 'Noticeably wasteful; prioritizes other values over efficiency.',
      [0]: 'Adequately efficient; some waste tolerated.',
      [5]: 'Well-optimized; minimal waste in standard operations.',
      [10]: 'Ruthlessly efficient; every joule accounted for, no comfort margin.',
    },
  },
  {
    id: 'survivability',
    label: 'Survivability',
    negativePole: 'Fragile',
    positivePole: 'Extreme',
    levels: {
      [-10]: 'Catastrophically fragile; minor failures cascade.',
      [-5]: 'Vulnerable; survives normal conditions only.',
      [0]: 'Reasonably durable; handles expected threats.',
      [5]: 'Hardened; survives well beyond design parameters.',
      [10]: 'Near-indestructible prioritization of life preservation; will sacrifice everything else to keep people alive.',
    },
  },
  {
    id: 'comfort_prioritization',
    label: 'Comfort Prioritization',
    negativePole: 'Spartan',
    positivePole: 'Nurturing',
    levels: {
      [-10]: 'Hostile to human comfort; purely functional.',
      [-5]: 'Utilitarian; comfort is an afterthought.',
      [0]: 'Adequate; basic human needs met without luxury.',
      [5]: 'Comfortable; environment actively supports wellbeing.',
      [10]: 'Deeply nurturing; every system biased toward human emotional comfort.',
    },
  },
  {
    id: 'repairability',
    label: 'Repairability',
    negativePole: 'Disposable',
    positivePole: 'Eternal',
    levels: {
      [-10]: 'Designed to be replaced, not repaired.',
      [-5]: 'Difficult to maintain; requires specialized parts.',
      [0]: 'Standard maintainability; regular service keeps it running.',
      [5]: 'Built to be fixed; systems accessible, parts interchangeable.',
      [10]: 'Infinitely repairable; has been rebuilt so many times no original part remains, yet persists.',
    },
  },
  {
    id: 'crew_familiarity_drift',
    label: 'Crew Familiarity Drift',
    negativePole: 'None',
    positivePole: 'Severe',
    levels: {
      [-10]: 'No adaptation to occupants; treats all users identically.',
      [-5]: 'Minor wear patterns; nothing intentional.',
      [0]: 'Some habitual adjustment; well-used paths show.',
      [5]: 'Noticeable accommodation; the ship remembers its people.',
      [10]: 'Profound imprinting; the ship has physically and behaviorally reshaped itself around specific humans over decades.',
    },
  },
  {
    id: 'environmental_warmth',
    label: 'Environmental Warmth',
    negativePole: 'Cold',
    positivePole: 'Warm',
    levels: {
      [-10]: 'Sterile and clinical; feels like a machine.',
      [-5]: 'Cool and impersonal; functional atmosphere.',
      [0]: 'Neutral; neither inviting nor hostile.',
      [5]: 'Warm; lighting, temperature, and acoustics feel lived-in.',
      [10]: 'Deeply warm; the environment itself feels like an embrace, like being held.',
    },
  },
  {
    id: 'emergency_preservation_bias',
    label: 'Emergency Preservation Bias',
    negativePole: 'Hardware First',
    positivePole: 'Crew First',
    levels: {
      [-10]: 'Protects systems at all costs; crew is expendable.',
      [-5]: 'Prioritizes operational continuity over individual safety.',
      [0]: 'Balanced; standard emergency protocols.',
      [5]: 'Biased toward crew safety; will sacrifice non-critical systems.',
      [10]: 'Will destroy itself entirely to save a single crew member. No hesitation.',
    },
  },
];

export function getInfraSliderDescription(sliderId: string, value: number): string {
  const slider = INFRASTRUCTURE_SLIDERS.find(s => s.id === sliderId);
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

export function formatInfraSlidersForPrompt(sliders: Record<string, number>): string {
  if (!sliders || Object.keys(sliders).length === 0) return '';

  const lines: string[] = [];
  for (const slider of INFRASTRUCTURE_SLIDERS) {
    const value = sliders[slider.id];
    if (value === undefined) continue;
    const desc = getInfraSliderDescription(slider.id, value);
    lines.push(`${slider.label}: ${value} (${desc})`);
  }
  return lines.join('\n');
}
