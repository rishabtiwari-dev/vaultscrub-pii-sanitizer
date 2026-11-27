import { useMemo, useState } from 'react';
import { BadgeCheck, Crosshair, Download, EyeOff, Info, RotateCcw, Undo2 } from 'lucide-react';
import {
  type DetectedEntity,
  type RedactionMode,
  type SanitizationResult,
} from '../engine';
import { previewMasked } from '../utils/output';
import { ENTITY_STYLES, entityLabel } from './entityStyles';

interface Props {
  result: SanitizationResult;
  mode: RedactionMode;
  strictVerhoeff: boolean;
  sourceFileName: string | null;
  whitelistedCount: number;
  customTermCount: number;
  onToggleSpan: (e: DetectedEntity) => void;
  onSwitchToPseudonym: () => void;
  onStrictVerhoeff: (v: boolean) => void;
  onOpenRehydrate: () => void;
  onJump: (span: { start: number; end: number }) => void;
}

const ROW =
  'group cursor-pointer border-t border-slate-900 outline-none transition-colors hover:bg-slate-900/70 focus-visible:bg-slate-900/70 focus-visible:ring-1 focus-visible:ring-emerald-500/50';

function jumpKeys(onJump: () => void) {
  return (ev: React.KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onJump();
    }
  };
}

type Tab = 'entities' | 'rejected' | 'pseudonyms';

function Kpi({ label, value, tone = 'text-slate-50' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className={`font-mono text-lg font-semibold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function auditReportFileName(sourceFileName: string | null): string {
  if (!sourceFileName) {
    return 'vaultscrub_audit_report.json';
  }
  const dot = sourceFileName.lastIndexOf('.');
  const base = dot > 0 ? sourceFileName.slice(0, dot) : sourceFileName;
  return `${base}_audit_report.json`;
}

export function AuditPanel({
  result,
  mode,
  strictVerhoeff,
  sourceFileName,
  whitelistedCount,
  customTermCount,
  onToggleSpan,
  onSwitchToPseudonym,
  onStrictVerhoeff,
  onOpenRehydrate,
  onJump,
}: Props) {
  const [tab, setTab] = useState<Tab>('entities');
  const [includePseudonymMap, setIncludePseudonymMap] = useState(false);
  const redacted = result.entities.filter((e) => !e.whitelisted).length;
  const exposurePct =
    result.entities.length === 0
      ? 100
      : Math.round((redacted / result.entities.length) * 100);

  const pseudoRows = useMemo(() => {
    const rows = new Map<string, { token: string; sample: DetectedEntity; count: number }>();
    for (const e of result.entities) {
      if (e.whitelisted || !e.replacement) continue;
      const token = e.replacement;
      const r = rows.get(token);
      if (r) r.count += 1;
      else rows.set(token, { token, sample: e, count: 1 });
    }
    return [...rows.values()];
  }, [result.entities]);

  const exportAuditJson = () => {
    const report: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      sourceFileName: sourceFileName ?? 'pasted_or_sample_text',
      redactionMode: mode,
      strictVerhoeff,
      totalDetected: result.entities.length,
      totalWhitelisted: whitelistedCount,
      totalRejectedFalsePositives: result.rejectedCandidates.length,
      countsByType: result.countsByType,
      customTermsConfigured: customTermCount,
      complianceSummary: {
        DPDP: {
          status: 'compliant',
          entitiesCovered: ['AADHAAR', 'PAN', 'PHONE', 'EMAIL'],
        },
        GDPR: {
          status: 'compliant',
          entitiesCovered: ['EMAIL', 'PHONE', 'IP_ADDRESS'],
        },
        'PCI-DSS': {
          status: 'compliant',
          entitiesCovered: ['CREDIT_CARD'],
        },
      },
      rejectedCandidates: result.rejectedCandidates,
    };

    if (includePseudonymMap) {
      report.pseudonymMap = result.pseudonymMap;
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = auditReportFileName(sourceFileName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'entities', label: 'Detected Entities', n: result.entities.length },
    { id: 'rejected', label: 'Rejected False Positives', n: result.rejectedCandidates.length },
    { id: 'pseudonyms', label: 'Pseudonym Map', n: Object.keys(result.pseudonymMap).length },
  ];

  return (
    <section className="flex h-72 shrink-0 flex-col border-t border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-5 py-2">
        <Kpi label="Entities Redacted" value={redacted} tone="text-emerald-300" />
        <Kpi
          label="Exposure Neutralized"
          value={`${exposurePct}%`}
          tone={exposurePct === 100 ? 'text-emerald-300' : 'text-amber-300'}
        />
        <Kpi label="False Positives Blocked" value={result.rejectedCandidates.length} tone="text-amber-300" />
        <Kpi label="Whitelisted Spans" value={whitelistedCount} />
        <Kpi label="Processing Time" value={`${result.processingTimeMs.toFixed(1)} ms`} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {['DPDP Ready', 'GDPR', 'PCI-DSS'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[10px] text-emerald-300">
                <BadgeCheck className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-2">
            <label
              title="Privacy notice: including the pseudonym map exports original normalized PII values alongside tokens."
              className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200"
            >
              <input
                type="checkbox"
                checked={includePseudonymMap}
                onChange={(e) => setIncludePseudonymMap(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 accent-emerald-500"
              />
              Include Pseudonym Map
            </label>
            <button
              type="button"
              onClick={exportAuditJson}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200"
            >
              <Download className="h-3 w-3" /> Export Audit JSON
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-800 px-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs ${
              tab === t.id ? 'border-emerald-400 text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label} <span className="ml-1 rounded bg-slate-800 px-1 font-mono text-[10px]">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-2 text-xs">
        {tab === 'entities' &&
          (result.entities.length === 0 ? (
            <Empty>No entities detected.</Empty>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Type</th>
                  <th className="pr-3">Value</th>
                  <th className="pr-3">Validation</th>
                  <th className="pr-3">Offset</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {result.entities.map((e) => (
                  <tr
                    key={`${e.start}:${e.end}:${e.type}`}
                    tabIndex={0}
                    title="Click to jump to this span in the document"
                    onClick={() => onJump(e)}
                    onKeyDown={jumpKeys(() => onJump(e))}
                    className={`${ROW} ${e.whitelisted ? 'opacity-60' : ''}`}
                  >
                    <td className="py-1.5 pr-3">
                      <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-sans text-[10px] font-medium ${ENTITY_STYLES[e.type].badge}`}>{entityLabel(e.type)}</span>
                    </td>
                    <td className="pr-3 text-slate-300">
                      {e.whitelisted ? e.value : previewMasked(e)}
                      {e.whitelisted && <span className="ml-2 text-amber-400">(raw – whitelisted)</span>}
                    </td>
                    <td className="pr-3 font-sans text-slate-400">{e.validationBadge}</td>
                    <td className="pr-3 text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        {e.start}–{e.end}
                        <Crosshair className="h-3 w-3 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onToggleSpan(e);
                        }}
                        onKeyDown={(ev) => ev.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 font-sans text-[11px] text-slate-200 hover:border-slate-500"
                      >
                        {e.whitelisted ? <Undo2 className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {e.whitelisted ? 'Restore' : 'Whitelist'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {tab === 'rejected' &&
          (result.rejectedCandidates.length === 0 ? (
            <Empty>No look-alike candidates were rejected.</Empty>
          ) : (
            <div className="space-y-2">
              {strictVerhoeff &&
                result.rejectedCandidates.some((r) => r.suspectedType === 'AADHAAR') && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-200">
                    <span className="inline-flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                      Strict Verhoeff checksum is active — random 12-digit IDs are safely skipped. Testing with dummy non-checksum 12-digit numbers?
                    </span>
                    <button
                      type="button"
                      onClick={() => onStrictVerhoeff(false)}
                      className="rounded border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 font-medium text-sky-100 hover:bg-sky-500/25"
                    >
                      Switch to Pattern-Only Mode
                    </button>
                  </div>
                )}
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">Raw Value</th>
                    <th className="pr-3">Suspected Type</th>
                    <th className="pr-3">Reason Rejected</th>
                    <th>Offset</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.rejectedCandidates.map((r) => (
                    <tr
                      key={`${r.start}:${r.end}:${r.suspectedType}`}
                      tabIndex={0}
                      title="Click to jump to this preserved decoy in the document"
                      onClick={() => onJump(r)}
                      onKeyDown={jumpKeys(() => onJump(r))}
                      className={ROW}
                    >
                      <td className="py-1.5 pr-3 text-slate-200">{r.value}</td>
                      <td className="pr-3">
                        <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-sans text-[10px] font-medium ${ENTITY_STYLES[r.suspectedType].badge}`}>{entityLabel(r.suspectedType)}</span>
                      </td>
                      <td className="pr-3 font-sans text-amber-300">{r.reason}</td>
                      <td className="text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          {r.start}–{r.end}
                          <Crosshair className="h-3 w-3 text-amber-400 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'pseudonyms' &&
          (mode !== 'PSEUDONYM' ? (
            <Empty>
              Pseudonym tokens are only generated in Consistent Pseudonymization mode.
              <button
                type="button"
                onClick={onSwitchToPseudonym}
                className="ml-2 rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-emerald-200 hover:bg-emerald-500/20"
              >
                Switch to Pseudonymization
              </button>
              <button
                type="button"
                onClick={onOpenRehydrate}
                className="ml-2 inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-200"
              >
                <RotateCcw className="h-3 w-3" /> Re-Hydrate / Restore
              </button>
            </Empty>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-[11px]">
                <span className="text-slate-400">
                  Restore tokens from an AI or vendor reply using your local pseudonym map.
                </span>
                <button
                  type="button"
                  onClick={onOpenRehydrate}
                  className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-200 hover:bg-emerald-500/20"
                >
                  <RotateCcw className="h-3 w-3" /> Re-Hydrate / Restore
                </button>
              </div>
              {pseudoRows.length === 0 ? (
                <Empty>No tokens generated yet.</Empty>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">Token</th>
                      <th className="pr-3">Original (masked)</th>
                      <th>Occurrences</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {pseudoRows.map((r) => (
                      <tr key={r.token} className="border-t border-slate-900">
                        <td className="py-1.5 pr-3 text-emerald-300">{r.token}</td>
                        <td className="pr-3 text-slate-300">{previewMasked(r.sample)}</td>
                        <td className="text-slate-400">{r.count}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-slate-500">{children}</p>;
}
