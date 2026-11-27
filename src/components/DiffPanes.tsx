import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  FileUp,
  Pencil,
  RotateCcw,
  Type,
  X,
} from 'lucide-react';
import {
  SAMPLE_PRESET_LIST,
  type DetectedEntity,
  type RejectedCandidate,
  type SamplePresetId,
} from '../engine';
import {
  buildSourceSegments,
  splitSegmentsIntoLines,
  type LinePiece,
  type OutputSegment,
  type SourceSegment,
} from '../utils/output';
import { ENTITY_STYLES, REJECTED_STYLE, entityLabel, rejectedTooltip } from './entityStyles';

export type SourceView = 'inspect' | 'edit';

/** Span currently pulsing after an audit-row jump (nonce restarts the animation). */
export interface FocusTarget {
  anchor: string;
  nonce: number;
}

const PANE =
  'flex h-[360px] min-h-[300px] flex-none flex-col overflow-hidden rounded-lg border border-slate-800 bg-zinc-950 lg:h-full lg:min-h-[360px] lg:max-h-[620px] lg:min-w-0 lg:flex-1';
const MONO = 'font-mono text-[13px] leading-6 whitespace-pre-wrap break-words';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
const HDR_BTN =
  `inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40 ${FOCUS_RING}`;
const WHITELISTED =
  'text-slate-400 line-through decoration-dashed decoration-slate-500 ring-1 ring-dashed ring-slate-600';

function PaneHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-slate-800 bg-slate-900/60 px-3 py-2">
      <h2 className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      <div className="flex flex-wrap items-center justify-end gap-1.5">{children}</div>
    </div>
  );
}

function LineView<T extends { text: string }>({
  lines,
  renderPiece,
}: {
  lines: LinePiece<T>[][];
  renderPiece: (piece: LinePiece<T>, key: string) => ReactNode;
}) {
  const gutterWidth = `${String(lines.length).length + 2}ch`;
  return (
    <div className="py-2 font-mono text-[13px] leading-6 text-slate-300">
      {lines.map((line, i) => (
        <div key={i} className="flex min-h-6 hover:bg-slate-900/50">
          <span
            aria-hidden="true"
            style={{ width: gutterWidth }}
            className="shrink-0 select-none border-r border-slate-800/80 pr-2 text-right text-[11px] tabular-nums text-slate-600"
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words px-3">
            {line.map((piece, j) => renderPiece(piece, `${i}:${j}`))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SourceProps {
  text: string;
  entities: DetectedEntity[];
  rejected: RejectedCandidate[];
  excludedCount: number;
  view: SourceView;
  onView: (v: SourceView) => void;
  onChange: (t: string) => void;
  onPasteText: (t: string) => void;
  onClear: () => void;
  onToggleSpan: (e: DetectedEntity) => void;
  onResetWhitelist: () => void;
  onLoadSample: (id: SamplePresetId) => void;
  onBrowse: () => void;
  focus: FocusTarget | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function SourcePane(p: SourceProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingFocus = useRef(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (ta && p.view === 'edit') {
      ta.style.height = 'auto';
      ta.style.height = `${Math.max(ta.scrollHeight, 260)}px`;
      if (pendingFocus.current) {
        pendingFocus.current = false;
        ta.focus();
      }
    }
  }, [p.text, p.view]);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 3500);
    return () => window.clearTimeout(id);
  }, [hint]);

  const startEditing = () => {
    pendingFocus.current = true;
    if (p.view === 'edit') taRef.current?.focus();
    else p.onView('edit');
  };

  const paste = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported');
      const clip = await navigator.clipboard.readText();
      if (clip) p.onPasteText(clip);
      else setHint('Clipboard is empty — copy some text first.');
    } catch {
      startEditing();
      setHint('Clipboard access unavailable — press Ctrl/⌘ + V to paste into the editor.');
    }
  };

  const empty = p.text.length === 0;
  const lines = useMemo(
    () => splitSegmentsIntoLines(buildSourceSegments(p.text, p.entities, p.rejected)),
    [p.text, p.entities, p.rejected]
  );
  const focusAnchor = p.focus?.anchor;

  const renderPiece = ({ seg, text, first }: LinePiece<SourceSegment>, key: string) => {
    const focused = seg.anchor !== undefined && seg.anchor === focusAnchor;
    const reactKey = focused ? `${key}-f${p.focus?.nonce}` : key;
    const anchorAttr = first ? seg.anchor : undefined;
    const pulse = focused ? ' vs-focus' : '';

    if (seg.entity) {
      const e = seg.entity;
      const wl = e.whitelisted === true;
      return (
        <span
          key={reactKey}
          data-anchor={anchorAttr}
          role="button"
          tabIndex={first ? 0 : -1}
          aria-pressed={wl}
          aria-label={`${entityLabel(e.type)} ${e.value}, ${wl ? 'whitelisted, activate to restore redaction' : 'activate to whitelist'}`}
          title={`${entityLabel(e.type)} • ${e.validationBadge}${wl ? ' • Whitelisted (click to re-enable)' : ' (click to whitelist)'}`}
          onClick={() => p.onToggleSpan(e)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              p.onToggleSpan(e);
            }
          }}
          className={`cursor-pointer rounded-sm px-0.5 ${FOCUS_RING} ${wl ? WHITELISTED : ENTITY_STYLES[e.type].highlight}${pulse}`}
        >
          {text}
        </span>
      );
    }
    if (seg.rejected) {
      return (
        <span key={reactKey} data-anchor={anchorAttr} title={rejectedTooltip(seg.rejected.reason)} className={`${REJECTED_STYLE}${pulse}`}>
          {text}
        </span>
      );
    }
    return <span key={key}>{text}</span>;
  };

  const toggleBtn = (active: boolean) =>
    `inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
      active ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
    }`;

  return (
    <section aria-label="Original source" className={PANE}>
      <PaneHeader title="Original Source">
        {p.excludedCount > 0 && (
          <button
            type="button"
            onClick={p.onResetWhitelist}
            className={`${HDR_BTN} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}
          >
            <RotateCcw aria-hidden="true" className="h-3 w-3" /> Reset Whitelist ({p.excludedCount})
          </button>
        )}
        <button
          type="button"
          onClick={() => void paste()}
          title="Replace source with clipboard text"
          className={`${HDR_BTN} border-slate-700 text-slate-200 hover:border-slate-500`}
        >
          <ClipboardPaste aria-hidden="true" className="h-3 w-3" /> Paste
        </button>
        {!empty && (
          <button
            type="button"
            onClick={p.onClear}
            title="Clear source and return to onboarding"
            className={`${HDR_BTN} border-slate-700 text-slate-300 hover:border-red-500/60 hover:text-red-300`}
          >
            <X aria-hidden="true" className="h-3 w-3" /> Clear
          </button>
        )}
        <div
          role="group"
          aria-label="Source view mode"
          className="inline-flex overflow-hidden rounded border border-slate-700 text-[11px]"
        >
          <button
            type="button"
            aria-pressed={p.view === 'inspect'}
            onClick={() => p.onView('inspect')}
            className={toggleBtn(p.view === 'inspect')}
          >
            <Eye aria-hidden="true" className="h-3 w-3" /> Inspect
          </button>
          <button
            type="button"
            aria-pressed={p.view === 'edit'}
            onClick={startEditing}
            className={toggleBtn(p.view === 'edit')}
          >
            <Pencil aria-hidden="true" className="h-3 w-3" /> Edit Raw Text
          </button>
        </div>
      </PaneHeader>
      {hint && (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] text-amber-200"
        >
          {hint}
        </div>
      )}
      <div ref={p.scrollRef} onScroll={p.onScroll} className="min-h-[220px] flex-1 overflow-auto lg:min-h-[280px]">
        {p.view === 'edit' ? (
          <div className="min-h-full p-3">
            <textarea
              ref={taRef}
              aria-label="Original source text editor"
              value={p.text}
              spellCheck={false}
              placeholder="Paste or type text containing PII..."
              onChange={(e) => p.onChange(e.target.value)}
              className={`${MONO} block w-full resize-none overflow-hidden rounded bg-transparent text-slate-200 placeholder:text-slate-600 ${FOCUS_RING}`}
            />
          </div>
        ) : empty ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 p-5 text-center">
            <FileUp aria-hidden="true" className="h-8 w-8 text-slate-600" />
            <div>
              <p className="text-sm font-medium text-slate-200">Load data to begin sanitizing</p>
              <p className="text-xs text-slate-500">
                Drag &amp; drop a .txt / .csv file anywhere,{' '}
                <button
                  type="button"
                  onClick={p.onBrowse}
                  className={`rounded text-sky-400 underline ${FOCUS_RING}`}
                >
                  browse
                </button>
                , paste raw text, or start from a sample. Nothing leaves this browser tab.
              </p>
            </div>
            <button
              type="button"
              onClick={startEditing}
              className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 ${FOCUS_RING}`}
            >
              <Type aria-hidden="true" className="h-3.5 w-3.5" /> Paste Raw Text
            </button>
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SAMPLE_PRESET_LIST.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => p.onLoadSample(s.id)}
                  className={`rounded-md border border-slate-800 bg-slate-900 p-3 text-left hover:border-slate-500 ${FOCUS_RING}`}
                >
                  <div className="text-xs font-semibold text-slate-100">{s.label}</div>
                  <div className="mt-1 text-[11px] leading-snug text-slate-500">{s.description}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <LineView lines={lines} renderPiece={renderPiece} />
        )}
      </div>
    </section>
  );
}

interface OutputProps {
  segments: OutputSegment[];
  empty: boolean;
  copied: boolean;
  redactedCount: number;
  rejectedCount: number;
  whitelistedCount: number;
  onCopy: () => void;
  onDownload: () => void;
  focus: FocusTarget | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function OutputPane(p: OutputProps) {
  const lines = useMemo(() => splitSegmentsIntoLines(p.segments), [p.segments]);
  const focusAnchor = p.focus?.anchor;
  const skipped = p.rejectedCount + p.whitelistedCount;

  const renderPiece = ({ seg, text, first }: LinePiece<OutputSegment>, key: string) => {
    const focused = seg.anchor !== undefined && seg.anchor === focusAnchor;
    const reactKey = focused ? `${key}-f${p.focus?.nonce}` : key;
    const anchorAttr = first ? seg.anchor : undefined;
    const pulse = focused ? ' vs-focus' : '';

    if (seg.changed && seg.type) {
      return (
        <mark
          key={reactKey}
          data-anchor={anchorAttr}
          title={`${entityLabel(seg.type)} redacted`}
          className={`rounded-sm bg-emerald-400/20 px-0.5 font-semibold text-emerald-200 ring-1 ring-emerald-400/60${pulse}`}
        >
          {text}
        </mark>
      );
    }
    if (seg.rejected) {
      return (
        <span key={reactKey} data-anchor={anchorAttr} title={rejectedTooltip(seg.rejected.reason)} className={`${REJECTED_STYLE}${pulse}`}>
          {text}
        </span>
      );
    }
    if (seg.anchor) {
      return (
        <span key={reactKey} data-anchor={anchorAttr} title="Whitelisted — kept verbatim" className={`rounded-sm${pulse}`}>
          {text}
        </span>
      );
    }
    return <span key={key}>{text}</span>;
  };

  return (
    <section aria-label="Sanitized output" className={PANE}>
      <PaneHeader
        title={
          <>
            Sanitized Output
            {!p.empty && (
              <span
                title={`${p.redactedCount} spans redacted • ${skipped} skipped (${p.rejectedCount} decoys failed checksum, ${p.whitelistedCount} whitelisted)`}
                className="rounded-full border border-slate-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-medium normal-case tracking-normal"
              >
                <span className="text-emerald-300">{p.redactedCount} redacted</span>
                <span className="text-slate-600"> • </span>
                <span className="text-amber-300">{skipped} skipped</span>
              </span>
            )}
          </>
        }
      >
        <button
          type="button"
          disabled={p.empty}
          onClick={p.onCopy}
          title="Copy sanitized output (Ctrl/⌘ + Shift + C)"
          className={`${HDR_BTN} border-slate-700 text-slate-200 hover:border-slate-500`}
        >
          {p.copied ? <Check aria-hidden="true" className="h-3 w-3 text-emerald-400" /> : <Copy aria-hidden="true" className="h-3 w-3" />}
          {p.copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          type="button"
          disabled={p.empty}
          onClick={p.onDownload}
          title="Download sanitized file"
          className={`${HDR_BTN} border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`}
        >
          <Download aria-hidden="true" className="h-3 w-3" /> Download
        </button>
      </PaneHeader>
      <div ref={p.scrollRef} onScroll={p.onScroll} className="min-h-[220px] flex-1 overflow-auto lg:min-h-[280px]">
        {p.empty ? (
          <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
            <p className="text-xs text-slate-500">Sanitized output appears here.</p>
          </div>
        ) : (
          <LineView lines={lines} renderPiece={renderPiece} />
        )}
      </div>
    </section>
  );
}
