import { useRef } from 'react';
import { FileText, Info, ScrollText, ShieldCheck, Upload, X } from 'lucide-react';
import { SAMPLE_PRESET_LIST, type SamplePresetId } from '../engine';
import { useExternalRequestCount } from '../utils/networkMonitor';
import { formatBytes } from '../utils/output';

const PILL_LABELS: Record<SamplePresetId, string> = {
  support_ticket: 'Support Ticket',
  hr_resume: 'HR Resume / KYC',
  clinical_note: 'Clinical Note',
  noisy_csv: 'Noisy CSV',
};

export interface LoadedSource {
  name: string | null;
  size: number;
  lines: number;
  sampleId: SamplePresetId | null;
}

interface Props {
  source: LoadedSource | null;
  error: string | null;
  onLoadSample: (id: SamplePresetId) => void;
  onFile: (file: File) => void;
  onClear: () => void;
  onOpenHowItWorks: () => void;
  onOpenPromptLog: () => void;
}

export function NetworkBadge() {
  const count = useExternalRequestCount();
  const ok = count === 0;
  return (
    <span
      title={`${count} External Requests`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        ok
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/50 bg-red-500/10 text-red-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {ok ? '100% Client-Side • 0 Network Calls' : `${count} External Requests Detected`}
    </span>
  );
}

export function TopBar({
  source,
  error,
  onLoadSample,
  onFile,
  onClear,
  onOpenHowItWorks,
  onOpenPromptLog,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="border-b border-slate-800 bg-zinc-950">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight text-slate-50">VaultScrub</h1>
            <p className="text-xs text-slate-400">Client-Side PII Sanitizer</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Samples</span>
          {SAMPLE_PRESET_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.description}
              onClick={() => onLoadSample(p.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                source?.sampleId === p.id
                  ? 'border-slate-500 bg-slate-800 text-slate-50'
                  : 'border-slate-700 bg-zinc-900 text-slate-300 hover:border-slate-500 hover:text-slate-50'
              }`}
            >
              {PILL_LABELS[p.id]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-zinc-900 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            <Upload className="h-3.5 w-3.5" /> Upload .txt / .csv
          </button>
          {source && (
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono text-slate-100">{source.name ?? 'Pasted / sample text'}</span>
              <span className="text-slate-500">
                {formatBytes(source.size)} • {source.lines} {source.lines === 1 ? 'line' : 'lines'}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-0.5 rounded border border-slate-700 px-1.5 text-slate-300 hover:border-red-500/60 hover:text-red-300"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPromptLog}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-zinc-900 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            <ScrollText className="h-3.5 w-3.5 text-emerald-400" />
            Prompt Log
          </button>
          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-zinc-900 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            <Info className="h-3.5 w-3.5 text-sky-400" />
            How It Works
          </button>
          <NetworkBadge />
        </div>
      </div>
    </header>
  );
}
