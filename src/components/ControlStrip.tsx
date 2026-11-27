import { Lock, Tags, X } from 'lucide-react';
import type { EntityCounts, EntityType, FullMaskStyle, RedactionMode } from '../engine';
import { CHIP_ORDER, ENTITY_STYLES } from './entityStyles';

interface Props {
  mode: RedactionMode;
  onMode: (m: RedactionMode) => void;
  fullStyle: FullMaskStyle;
  onFullStyle: (s: FullMaskStyle) => void;
  enabled: Set<EntityType>;
  onToggleType: (t: EntityType) => void;
  counts: EntityCounts;
  strictVerhoeff: boolean;
  onStrictVerhoeff: (v: boolean) => void;
  customTermsInput: string;
  onCustomTermsInput: (v: string) => void;
  customTermCount: number;
}

const MODES: { id: RedactionMode; label: string; short: string }[] = [
  { id: 'FULL', label: 'Full Mask', short: 'Full' },
  { id: 'PARTIAL', label: 'Partial Mask', short: 'Partial' },
  { id: 'PSEUDONYM', label: 'Consistent Pseudonymization', short: 'Pseudonymize' },
];

const SEG_BASE = 'whitespace-nowrap px-3 py-1.5 text-xs font-medium transition-colors';
const SEG_ACTIVE =
  'bg-emerald-500/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.55)]';
const SEG_IDLE = 'bg-zinc-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200';

const CUSTOM_EXAMPLE: Record<RedactionMode, string> = {
  FULL: '[REDACTED]',
  PARTIAL: 'P***s',
  PSEUDONYM: 'CUSTOM_01',
};

export function ControlStrip(p: Props) {
  const customHits = p.counts.CUSTOM ?? 0;
  const customSt = ENTITY_STYLES.CUSTOM;

  return (
    <section className="border-b border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Redaction mode"
            className="inline-flex overflow-hidden rounded-md border border-slate-700 divide-x divide-slate-800"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={p.mode === m.id}
                title={m.label}
                onClick={() => p.onMode(m.id)}
                className={`${SEG_BASE} ${p.mode === m.id ? SEG_ACTIVE : SEG_IDLE}`}
              >
                <span className="hidden md:inline">{m.label}</span>
                <span className="md:hidden">{m.short}</span>
              </button>
            ))}
          </div>
          {p.mode === 'FULL' && (
            <div className="inline-flex overflow-hidden rounded-md border border-slate-700 font-mono text-[11px] divide-x divide-slate-800">
              {(['GENERIC', 'TYPED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => p.onFullStyle(s)}
                  aria-pressed={p.fullStyle === s}
                  className={`whitespace-nowrap px-2 py-1 transition-colors ${
                    p.fullStyle === s ? 'bg-slate-800 text-emerald-200' : 'bg-zinc-900 text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {s === 'GENERIC' ? '[REDACTED]' : '[TYPE_REDACTED]'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CHIP_ORDER.map((t) => {
            const on = p.enabled.has(t);
            const st = ENTITY_STYLES[t];
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                title={`${on ? 'Disable' : 'Enable'} ${st.label} detection`}
                onClick={() => p.onToggleType(t)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  on ? st.chipOn : 'border-slate-800 bg-zinc-900 text-slate-500 line-through'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${on ? st.dot : 'bg-slate-600'}`} />
                {st.label}
                <span className={`rounded px-1 font-mono tabular-nums ${on ? 'bg-black/30' : 'bg-slate-800'}`}>{p.counts[t]}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-700 bg-zinc-900 px-2.5 py-1 text-slate-300">
            <Lock className="h-3 w-3" /> Luhn: Enforced
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={p.strictVerhoeff}
            onClick={() => p.onStrictVerhoeff(!p.strictVerhoeff)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-700 bg-zinc-900 px-2.5 py-1 text-slate-300 hover:border-slate-500"
          >
            Strict Verhoeff
            <span className={`relative h-4 w-7 rounded-full transition-colors ${p.strictVerhoeff ? 'bg-emerald-500' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${p.strictVerhoeff ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-900 px-4 py-1.5 sm:px-5">
        <label
          htmlFor="custom-terms"
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500"
        >
          <Tags className="h-3.5 w-3.5 text-lime-400" /> Custom Terms
        </label>
        <div className="relative min-w-[14rem] flex-1">
          <input
            id="custom-terms"
            type="text"
            value={p.customTermsInput}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => p.onCustomTermsInput(e.target.value)}
            placeholder="Comma-separated codenames or terms — e.g. Project Helios, Internal-992"
            className="w-full rounded-md border border-slate-800 bg-zinc-900 py-1 pl-2.5 pr-7 font-mono text-[12px] text-slate-200 outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/30"
          />
          {p.customTermsInput && (
            <button
              type="button"
              aria-label="Clear custom terms"
              onClick={() => p.onCustomTermsInput('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <span
          title="Custom terms yield to built-in PII spans and use the active redaction mode"
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] ${
            p.customTermCount > 0 ? customSt.chipOn : 'border-slate-800 bg-zinc-900 text-slate-500'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${p.customTermCount > 0 ? customSt.dot : 'bg-slate-600'}`} />
          {p.customTermCount} {p.customTermCount === 1 ? 'term' : 'terms'}
          <span className="rounded bg-black/30 px-1 font-mono tabular-nums">{customHits} hits</span>
        </span>
        <span className="hidden whitespace-nowrap font-mono text-[10px] text-slate-600 lg:inline">
          → {p.mode === 'FULL' && p.fullStyle === 'TYPED' ? '[CUSTOM_REDACTED]' : CUSTOM_EXAMPLE[p.mode]}
        </span>
      </div>
    </section>
  );
}
