import type { BuiltInEntityType, EntityType } from '../engine';

export interface EntityStyle {
  label: string;
  dot: string;
  highlight: string;
  badge: string;
  chipOn: string;
}

export const ENTITY_STYLES: Record<EntityType, EntityStyle> = {
  EMAIL: {
    label: 'Email',
    dot: 'bg-sky-400',
    highlight: 'bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/50',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    chipOn: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
  },
  PHONE: {
    label: 'Phone',
    dot: 'bg-emerald-400',
    highlight: 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/50',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    chipOn: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  },
  IP_ADDRESS: {
    label: 'IP Address',
    dot: 'bg-violet-400',
    highlight: 'bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/50',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
    chipOn: 'border-violet-500/50 bg-violet-500/10 text-violet-200',
  },
  PAN: {
    label: 'PAN',
    dot: 'bg-amber-400',
    highlight: 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/50',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    chipOn: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  },
  AADHAAR: {
    label: 'Aadhaar',
    dot: 'bg-fuchsia-400',
    highlight: 'bg-fuchsia-500/25 text-fuchsia-100 ring-1 ring-fuchsia-400/50',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40',
    chipOn: 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200',
  },
  CREDIT_CARD: {
    label: 'Credit Card',
    dot: 'bg-rose-400',
    highlight: 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-400/50',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    chipOn: 'border-rose-500/50 bg-rose-500/10 text-rose-200',
  },
  CUSTOM: {
    label: 'Custom Term',
    dot: 'bg-lime-400',
    highlight: 'bg-lime-500/20 text-lime-100 ring-1 ring-lime-400/50',
    badge: 'bg-lime-500/15 text-lime-300 border-lime-500/40',
    chipOn: 'border-lime-500/50 bg-lime-500/10 text-lime-200',
  },
};

export const CHIP_ORDER: readonly BuiltInEntityType[] = [
  'EMAIL',
  'PHONE',
  'IP_ADDRESS',
  'PAN',
  'AADHAAR',
  'CREDIT_CARD',
];

/** Human-readable label for any entity type (never surfaces raw enum strings). */
export function entityLabel(type: EntityType): string {
  return ENTITY_STYLES[type].label;
}

/** Tooltip copy for a rejected (preserved) decoy candidate. */
export function rejectedTooltip(reason: string): string {
  return `Skipped: ${reason} — not redacted`;
}

/** Subtle dashed style for rejected decoys preserved in the document. */
export const REJECTED_STYLE =
  'cursor-help rounded-sm underline decoration-dashed decoration-amber-400/70 decoration-1 underline-offset-4 bg-amber-500/[0.06] text-slate-200';
