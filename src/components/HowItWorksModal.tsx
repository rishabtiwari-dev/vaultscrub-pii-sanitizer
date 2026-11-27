import { useRef } from 'react';
import {
  Binary,
  CreditCard,
  FileCheck2,
  GitMerge,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useModalFocus } from './useModalFocus';

interface Props {
  open: boolean;
  onClose: () => void;
}

const GUARANTEES = [
  {
    icon: CreditCard,
    title: '1. Luhn Algorithm & Card Network Detection',
    detail:
      'Every 13–19 digit candidate is verified with the mod-10 Luhn checksum and BIN prefix rules, eliminating false positives on 16-digit Order or Transaction IDs while identifying Visa, Mastercard, RuPay, Amex, and Discover.',
  },
  {
    icon: Binary,
    title: '2. Verhoeff Dihedral D5 Checksum',
    detail:
      '12-digit Indian National IDs (Aadhaar) are mathematically validated using the non-commutative dihedral group D5 Verhoeff table, rejecting random courier tracking numbers and non-PII numeric IDs.',
  },
  {
    icon: FileCheck2,
    title: '3. Strict PAN Structure Decoding',
    detail:
      'Indian Permanent Account Numbers are validated against the 10-character [A-Z]{5}[0-9]{4}[A-Z] grammar and decoded by their 4th-character holder classification (Individual, Company, Firm, Trust, HUF, etc.).',
  },
  {
    icon: GitMerge,
    title: '4. Deterministic Span Resolver & Canonical Normalization',
    detail:
      'Overlapping matches are resolved deterministically (CREDIT_CARD > EMAIL > AADHAAR > IP_ADDRESS > PAN > PHONE, then longest match). Values are canonically normalized so format variations map to identical pseudonym tokens.',
  },
  {
    icon: Lock,
    title: '5. Zero-Network Privacy Architecture',
    detail:
      'All detection, validation, and redaction execute synchronously in browser memory with zero outbound requests—enforced in production builds via a strict Content Security Policy (connect-src \'none\').',
  },
];

export function HowItWorksModal({ open, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useModalFocus(open, onClose, closeBtnRef);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2
                id="how-it-works-title"
                className="text-sm font-semibold text-slate-100"
              >
                How VaultScrub Validation Works
              </h2>
              <p className="text-[11px] text-slate-400">
                5 deterministic guarantees for zero-leakage client-side sanitization
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md border border-slate-800 p-1 text-slate-400 hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {GUARANTEES.map((g) => {
            const Icon = g.icon;
            return (
              <div
                key={g.title}
                className="flex gap-3 rounded-lg border border-slate-800/90 bg-slate-900/40 p-3.5"
              >
                <div className="mt-0.5 shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-300">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-100">
                    {g.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {g.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/40 px-5 py-3">
          <span className="font-mono text-[11px] text-slate-500">
            connect-src &apos;none&apos; • 100% deterministic in-memory engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
