import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, FileJson, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import { rehydrateText } from '../engine';

interface Props {
  open: boolean;
  onClose: () => void;
  sessionPseudonymMap: Record<string, string>;
  currentSanitizedText: string;
}

function isStringRecord(val: unknown): val is Record<string, string> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return false;
  }
  return Object.values(val).every((v) => typeof v === 'string');
}

export function RehydrateModal({
  open,
  onClose,
  sessionPseudonymMap,
  currentSanitizedText,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [uploadedMap, setUploadedMap] = useState<{
    fileName: string;
    map: Record<string, string>;
  } | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const activeMap = uploadedMap ? uploadedMap.map : sessionPseudonymMap;
  const activeTokenCount = Object.keys(activeMap).length;

  const { restoredText, replacementsCount } = useMemo(
    () => rehydrateText(inputText, activeMap),
    [inputText, activeMap]
  );

  if (!open) return null;

  const handleLoadJson = async (file: File) => {
    setJsonError(null);
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if ('pseudonymMap' in record) {
          if (isStringRecord(record.pseudonymMap)) {
            setUploadedMap({ fileName: file.name, map: record.pseudonymMap });
            return;
          }
          setJsonError('The JSON file has an invalid pseudonymMap field.');
          return;
        }
        if (isStringRecord(record) && Object.keys(record).length > 0) {
          setUploadedMap({ fileName: file.name, map: record });
          return;
        }
      }

      setJsonError(
        'No pseudonymMap found. Export an Audit JSON with "Include Pseudonym Map" checked.'
      );
    } catch {
      setJsonError('Could not parse JSON file.');
    }
  };

  const copyRestored = async () => {
    if (!restoredText) return;
    try {
      await navigator.clipboard.writeText(restoredText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = restoredText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rehydrate-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5">
              <RotateCcw className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2
                id="rehydrate-modal-title"
                className="text-sm font-semibold text-slate-100"
              >
                Local Round-Trip Re-Hydration
              </h2>
              <p className="text-[11px] text-slate-400">
                Paste an AI/vendor reply containing tokens like EMAIL_01 or PHONE_01 to restore original values 100% locally in your browser.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md border border-slate-800 p-1 text-slate-400 hover:border-slate-600 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Map Source Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/30 px-5 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <FileJson className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-400">Mapping Source:</span>
            <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-200">
              {uploadedMap ? uploadedMap.fileName : 'Active Session Map'}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
              {activeTokenCount} {activeTokenCount === 1 ? 'token' : 'tokens'}
            </span>
            {jsonError && <span className="text-red-400">{jsonError}</span>}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleLoadJson(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-zinc-900 px-2.5 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              <Upload className="h-3.5 w-3.5" /> Load Audit JSON
            </button>
            {uploadedMap && (
              <button
                type="button"
                onClick={() => {
                  setUploadedMap(null);
                  setJsonError(null);
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
              >
                Use Session Map
              </button>
            )}
          </div>
        </div>

        {/* Dual Input / Restored Preview Panes */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-4 md:grid-cols-2">
          <div className="flex min-h-[260px] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <span className="text-xs font-medium text-slate-200">
                Sanitized / AI Reply Input
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInputText(currentSanitizedText)}
                  disabled={!currentSanitizedText}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-3 w-3" /> Use Current Sanitized Output
                </button>
                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste text containing tokens like EMAIL_01, PHONE_01, CARD_01..."
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          <div className="flex min-h-[260px] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-200">
                  Locally Restored Output
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                  {replacementsCount} {replacementsCount === 1 ? 'token' : 'tokens'} restored
                </span>
              </div>
              <button
                type="button"
                onClick={() => void copyRestored()}
                disabled={!restoredText}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Restored
                  </>
                )}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {restoredText ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-100">
                  {restoredText}
                </pre>
              ) : (
                <p className="py-12 text-center text-xs text-slate-500">
                  Restored text will appear here instantaneously — zero network calls.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/40 px-5 py-3">
          <span className="font-mono text-[11px] text-slate-500">
            Longest-token-first boundary-safe restore • 100% offline in browser memory
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
