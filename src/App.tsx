import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Columns2, Table2, Upload } from 'lucide-react';
import {
  ALL_ENTITY_TYPES,
  SAMPLE_PRESETS,
  makeSpanKey,
  parseCustomTerms,
  sanitizeText,
  type DetectedEntity,
  type EntityType,
  type FullMaskStyle,
  type RedactionMode,
  type SamplePresetId,
} from './engine';
import { AuditPanel } from './components/AuditPanel';
import { ControlStrip } from './components/ControlStrip';
import { CsvTableView } from './components/CsvTableView';
import {
  OutputPane,
  SourcePane,
  type FocusTarget,
  type SourceView,
} from './components/DiffPanes';
import { HowItWorksModal } from './components/HowItWorksModal';
import { PromptLogModal } from './components/PromptLogModal';
import { RehydrateModal } from './components/RehydrateModal';
import { TopBar, type LoadedSource } from './components/TopBar';
import { buildCsvTableData } from './utils/csv';
import {
  buildOutputSegments,
  countLines,
  sanitizedFileName,
  spanAnchor,
} from './utils/output';

const DEBOUNCE_MS = 120;
const FOCUS_PULSE_MS = 1600;
const INITIAL_SAMPLE: SamplePresetId = 'support_ticket';
type WorkspaceView = 'diff' | 'csv';

function describeSource(
  content: string,
  src: Omit<LoadedSource, 'size' | 'lines'>
): LoadedSource {
  return {
    ...src,
    size: new TextEncoder().encode(content).length,
    lines: countLines(content),
  };
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Centers a `[data-anchor]` element inside its own scroll container. */
function scrollToAnchor(container: HTMLElement | null, anchor: string): void {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`);
  if (!el) return;
  const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
  const top = container.scrollTop + delta - container.clientHeight / 2 + el.offsetHeight / 2;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
}

export default function App() {
  // First impression: boot straight into a live, fully highlighted sample.
  const [text, setText] = useState(() => SAMPLE_PRESETS[INITIAL_SAMPLE].content);
  const [debounced, setDebounced] = useState(() => SAMPLE_PRESETS[INITIAL_SAMPLE].content);
  const [source, setSource] = useState<LoadedSource | null>(() =>
    describeSource(SAMPLE_PRESETS[INITIAL_SAMPLE].content, { name: null, sampleId: INITIAL_SAMPLE })
  );
  const [view, setView] = useState<SourceView>('inspect');
  const [mode, setMode] = useState<RedactionMode>('FULL');
  const [fullStyle, setFullStyle] = useState<FullMaskStyle>('TYPED');
  const [enabled, setEnabled] = useState<Set<EntityType>>(() => new Set(ALL_ENTITY_TYPES));
  const [strictVerhoeff, setStrictVerhoeff] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [customTermsInput, setCustomTermsInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('diff');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [promptLogOpen, setPromptLogOpen] = useState(false);
  const [rehydrateOpen, setRehydrateOpen] = useState(false);
  const [focus, setFocus] = useState<FocusTarget | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const suppressSyncUntil = useRef(0);
  const focusNonce = useRef(0);

  // Debounce live edits
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text]);

  const debouncedTerms = useDebouncedValue(customTermsInput, DEBOUNCE_MS);
  const customTerms = useMemo(() => parseCustomTerms(debouncedTerms), [debouncedTerms]);

  const result = useMemo(
    () =>
      sanitizeText(debounced, {
        mode,
        fullMaskStyle: fullStyle,
        enabledTypes: enabled,
        excludedSpanKeys: excluded,
        strictVerhoeff,
        customTerms,
      }),
    [debounced, mode, fullStyle, enabled, excluded, strictVerhoeff, customTerms]
  );

  const segments = useMemo(
    () => buildOutputSegments(debounced, result.entities, result.rejectedCandidates),
    [debounced, result.entities, result.rejectedCandidates]
  );

  const isCsv =
    source?.sampleId === 'noisy_csv' ||
    (source?.name?.toLowerCase().endsWith('.csv') ?? false);

  const csvTable = useMemo(
    () => (isCsv ? buildCsvTableData(debounced, result.entities) : null),
    [isCsv, debounced, result.entities]
  );

  const exportableText = isCsv && csvTable ? csvTable.sanitizedCsv : result.sanitizedText;

  const whitelistedCount = result.entities.filter((e) => e.whitelisted).length;
  const redactedCount = result.entities.length - whitelistedCount;

  const loadText = useCallback((content: string, src: Omit<LoadedSource, 'size' | 'lines'>) => {
    setText(content);
    setDebounced(content); // immediate for loads
    setExcluded(new Set());
    setView('inspect');
    setWorkspaceView('diff');
    setError(null);
    setFocus(null);
    setSource(describeSource(content, src));
  }, []);

  const loadSample = useCallback(
    (id: SamplePresetId) => loadText(SAMPLE_PRESETS[id].content, { name: null, sampleId: id }),
    [loadText]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!/\.(txt|csv)$/i.test(file.name)) {
        setError('Only .txt and .csv files are supported.');
        return;
      }
      try {
        const content = await file.text();
        loadText(content, { name: file.name, sampleId: null });
      } catch {
        setError('Could not read file.');
      }
    },
    [loadText]
  );

  const clear = useCallback(() => {
    setText('');
    setDebounced('');
    setSource(null);
    setExcluded(new Set());
    setView('inspect');
    setWorkspaceView('diff');
    setError(null);
    setFocus(null);
  }, []);

  const handleEdit = (t: string) => {
    setText(t);
    // Span keys are offset-based, so edits invalidate the whitelist.
    setExcluded((prev) => (prev.size ? new Set() : prev));
    const meta = { size: new TextEncoder().encode(t).length, lines: countLines(t) };
    setSource((s) => (s ? { ...s, ...meta } : t ? { name: null, sampleId: null, ...meta } : null));
  };

  const toggleSpan = (e: DetectedEntity) => {
    const key = makeSpanKey(e);
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleType = (t: EntityType) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const syncScroll = (from: 'left' | 'right') => () => {
    if (performance.now() < suppressSyncUntil.current) return; // jump-to-span in flight
    if (syncing.current) {
      syncing.current = false;
      return;
    }
    const a = from === 'left' ? leftRef.current : rightRef.current;
    const b = from === 'left' ? rightRef.current : leftRef.current;
    if (!a || !b) return;
    const range = a.scrollHeight - a.clientHeight;
    const ratio = range > 0 ? a.scrollTop / range : 0;
    const target = ratio * (b.scrollHeight - b.clientHeight);
    if (Math.abs(b.scrollTop - target) > 1) {
      syncing.current = true;
      b.scrollTop = target;
    }
  };

  // Audit row → diff pane jump with a brief focus pulse.
  const jumpTo = useCallback((span: { start: number; end: number }) => {
    setWorkspaceView('diff');
    setView('inspect');
    focusNonce.current += 1;
    setFocus({ anchor: spanAnchor(span), nonce: focusNonce.current });
  }, []);

  useEffect(() => {
    if (!focus) return;
    const raf = window.requestAnimationFrame(() => {
      suppressSyncUntil.current = performance.now() + 900;
      scrollToAnchor(leftRef.current, focus.anchor);
      scrollToAnchor(rightRef.current, focus.anchor);
    });
    const id = window.setTimeout(() => setFocus(null), FOCUS_PULSE_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
  }, [focus]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const copy = async (announce = false) => {
    if (!exportableText) return;
    try {
      await navigator.clipboard.writeText(exportableText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = exportableText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    if (announce) setToast('Sanitized output copied to clipboard');
    window.setTimeout(() => setCopied(false), 1800);
  };

  // Keep the global shortcut handler bound once while always calling the latest copy().
  const copyRef = useRef(copy);
  copyRef.current = copy;

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setFocus(null);
        return;
      }
      if (!(ev.ctrlKey || ev.metaKey) || !ev.shiftKey || ev.key.toLowerCase() !== 'c') return;
      const pageSelection = window.getSelection()?.toString() ?? '';
      const ae = document.activeElement;
      const fieldSelection =
        (ae instanceof HTMLTextAreaElement || (ae instanceof HTMLInputElement && ae.type === 'text')) &&
        ae.selectionStart !== ae.selectionEnd;
      if (pageSelection || fieldSelection) return; // respect the user's own text selection
      ev.preventDefault();
      void copyRef.current(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const download = () => {
    const { name, mime } = sanitizedFileName(source?.name ?? null, source?.sampleId === 'noisy_csv');
    const url = URL.createObjectURL(new Blob([exportableText], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const isFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const onDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragging(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  return (
    <div
      className="relative flex min-h-screen flex-col bg-slate-950 text-slate-200 lg:h-screen"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <TopBar
        source={source}
        error={error}
        onLoadSample={loadSample}
        onFile={handleFile}
        onClear={clear}
        onOpenHowItWorks={() => setHowItWorksOpen(true)}
        onOpenPromptLog={() => setPromptLogOpen(true)}
      />
      <ControlStrip
        mode={mode}
        onMode={setMode}
        fullStyle={fullStyle}
        onFullStyle={setFullStyle}
        enabled={enabled}
        onToggleType={toggleType}
        counts={result.countsByType}
        strictVerhoeff={strictVerhoeff}
        onStrictVerhoeff={setStrictVerhoeff}
        customTermsInput={customTermsInput}
        onCustomTermsInput={setCustomTermsInput}
        customTermCount={customTerms.length}
      />

      {isCsv && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/40 px-4 py-1.5 sm:px-5">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-700 bg-zinc-950 text-xs">
            <button
              type="button"
              onClick={() => setWorkspaceView('diff')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 font-medium transition-colors ${
                workspaceView === 'diff'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" /> Raw Diff
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('csv')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 font-medium transition-colors ${
                workspaceView === 'csv'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> CSV Table View
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            RFC-4180 parser active • column alignment preserved on export
          </span>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {isCsv && workspaceView === 'csv' && csvTable ? (
          <CsvTableView
            table={csvTable}
            copied={copied}
            onCopy={() => void copy()}
            onDownload={download}
            onToggleSpan={toggleSpan}
          />
        ) : (
          <>
            <SourcePane
              text={view === 'edit' ? text : debounced}
              entities={result.entities}
              rejected={result.rejectedCandidates}
              excludedCount={whitelistedCount}
              view={view}
              onView={setView}
              onChange={handleEdit}
              onPasteText={(t) => loadText(t, { name: null, sampleId: null })}
              onClear={clear}
              onToggleSpan={toggleSpan}
              onResetWhitelist={() => setExcluded(new Set())}
              onLoadSample={loadSample}
              onBrowse={() => fileInputRef.current?.click()}
              focus={focus}
              scrollRef={leftRef}
              onScroll={syncScroll('left')}
            />
            <OutputPane
              segments={segments}
              empty={debounced.length === 0}
              copied={copied}
              redactedCount={redactedCount}
              rejectedCount={result.rejectedCandidates.length}
              whitelistedCount={whitelistedCount}
              onCopy={() => void copy()}
              onDownload={download}
              focus={focus}
              scrollRef={rightRef}
              onScroll={syncScroll('right')}
            />
          </>
        )}
      </main>

      <AuditPanel
        result={result}
        mode={mode}
        strictVerhoeff={strictVerhoeff}
        sourceFileName={
          source?.name ?? (source?.sampleId ? `${source.sampleId}.txt` : null)
        }
        whitelistedCount={whitelistedCount}
        customTermCount={customTerms.length}
        onToggleSpan={toggleSpan}
        onSwitchToPseudonym={() => setMode('PSEUDONYM')}
        onStrictVerhoeff={setStrictVerhoeff}
        onOpenRehydrate={() => setRehydrateOpen(true)}
        onJump={jumpTo}
      />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />

      <PromptLogModal
        open={promptLogOpen}
        onClose={() => setPromptLogOpen(false)}
      />

      <RehydrateModal
        open={rehydrateOpen}
        onClose={() => setRehydrateOpen(false)}
        sessionPseudonymMap={result.pseudonymMap}
        currentSanitizedText={exportableText}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-zinc-950/95 px-3 py-2 text-xs text-emerald-200 shadow-xl"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {toast}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-emerald-400 bg-slate-950/85 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/40 bg-zinc-950/90 px-8 py-6 shadow-2xl">
            <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 p-3">
              <Upload className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-base font-medium text-emerald-200">
              Drop .txt or .csv file to sanitize 100% locally
            </p>
            <p className="text-xs text-slate-400">
              Processed strictly in browser memory — zero network uploads
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
