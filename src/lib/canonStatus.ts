export const CANON_STATUSES = [
  { key: 'canon', label: 'Canon', description: 'Immutable, locked-in lore' },
  { key: 'stable', label: 'Stable', description: 'Likely permanent, but could adjust' },
  { key: 'draft', label: 'Draft', description: 'Actively evolving' },
  { key: 'experimental', label: 'Experimental', description: 'Brainstorming, may be discarded' },
  { key: 'deprecated', label: 'Deprecated', description: 'Old lore, no longer active' },
] as const;

export type CanonStatus = typeof CANON_STATUSES[number]['key'];

export const CANON_STATUS_COLORS: Record<string, string> = {
  canon: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  stable: 'bg-sky-100 text-sky-800 border-sky-300',
  draft: 'bg-amber-100 text-amber-800 border-amber-300',
  experimental: 'bg-rose-100 text-rose-700 border-rose-300',
  deprecated: 'bg-slate-100 text-slate-500 border-slate-300',
};

export const CANON_STATUS_DOT: Record<string, string> = {
  canon: 'bg-emerald-500',
  stable: 'bg-sky-500',
  draft: 'bg-amber-500',
  experimental: 'bg-rose-400',
  deprecated: 'bg-slate-400',
};
