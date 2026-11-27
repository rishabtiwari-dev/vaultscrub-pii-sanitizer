import { memo, useEffect, useState } from 'react';
import { Check, Copy, Download, Eye, ShieldCheck, Table2 } from 'lucide-react';
import { type DetectedEntity } from '../engine';
import { type CsvTableData } from '../utils/csv';
import { ENTITY_STYLES } from './entityStyles';

type CellMode = 'sanitized' | 'original';
const PAGE_SIZE = 100;

interface Props {
  table: CsvTableData;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onToggleSpan: (e: DetectedEntity) => void;
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export const CsvTableView = memo(function CsvTableView({
  table,
  copied,
  onCopy,
  onDownload,
  onToggleSpan,
}: Props) {
  const [cellMode, setCellMode] = useState<CellMode>('sanitized');
  const [visibleRows, setVisibleRows] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleRows(PAGE_SIZE);
  }, [table.rows]);

  const displayedRows = table.rows.slice(0, visibleRows);

  return (
    <section
      aria-label="CSV table view"
      className="flex h-[360px] min-h-[300px] flex-none flex-col overflow-hidden rounded-lg border border-slate-800 bg-zinc-950 lg:h-full lg:min-h-[360px] lg:max-h-[620px] lg:min-w-0 lg:flex-1"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Table2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            CSV Table View
          </h2>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'} × {table.columnCount} cols
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="CSV cell display mode"
            className="inline-flex overflow-hidden rounded border border-slate-700 text-[11px]"
          >
            <button
              type="button"
              aria-pressed={cellMode === 'sanitized'}
              onClick={() => setCellMode('sanitized')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                cellMode === 'sanitized'
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck aria-hidden="true" className="h-3 w-3" /> Sanitized
            </button>
            <button
              type="button"
              aria-pressed={cellMode === 'original'}
              onClick={() => setCellMode('original')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                cellMode === 'original'
                  ? 'bg-slate-700 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye aria-hidden="true" className="h-3 w-3" /> Original (Highlighted)
            </button>
          </div>

          <button
            type="button"
            disabled={table.columnCount === 0}
            onClick={onCopy}
            className={`inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500 disabled:opacity-40 ${FOCUS_RING}`}
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy aria-hidden="true" className="h-3 w-3" />
            )}
            {copied ? 'Copied!' : 'Copy Sanitized'}
          </button>

          <button
            type="button"
            disabled={table.columnCount === 0}
            onClick={onDownload}
            className={`inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 ${FOCUS_RING}`}
          >
            <Download aria-hidden="true" className="h-3 w-3" /> Download Sanitized
          </button>
        </div>
      </div>

      {table.columnCount === 0 ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center p-6 text-xs text-slate-500 lg:min-h-[280px]">
          No CSV rows to display.
        </div>
      ) : (
        <div className="min-h-[220px] flex-1 overflow-auto lg:min-h-[280px]">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400 shadow-sm">
              <tr>
                <th scope="col" className="border-b border-r border-slate-800 px-3 py-2 text-right text-slate-500">
                  #
                </th>
                {table.headers.map((header, idx) => (
                  <th
                    key={idx}
                    scope="col"
                    className="whitespace-nowrap border-b border-r border-slate-800 px-3 py-2 font-semibold text-slate-200 last:border-r-0"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {displayedRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/40">
                  <td className="border-r border-slate-900 px-3 py-2 text-right text-slate-600">
                    {rIdx + 1}
                  </td>
                  {Array.from({ length: table.columnCount }, (_, cIdx) => {
                    const cell = row[cIdx];
                    if (!cell) {
                      return (
                        <td
                          key={cIdx}
                          className="border-r border-slate-900 px-3 py-2 text-slate-600 last:border-r-0"
                        />
                      );
                    }

                    const segments =
                      cellMode === 'sanitized'
                        ? cell.sanitizedSegments
                        : cell.originalSegments;

                    return (
                      <td
                        key={cIdx}
                        className={`max-w-xs whitespace-pre-wrap break-words border-r border-slate-900 px-3 py-2 align-top text-slate-300 last:border-r-0 ${
                          cellMode === 'sanitized' && cell.hasChanges
                            ? 'bg-emerald-500/[0.03]'
                            : ''
                        }`}
                      >
                        {segments.length === 0 ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          segments.map((seg, sIdx) => {
                            if (cellMode === 'sanitized') {
                              return seg.changed ? (
                                <mark
                                  key={sIdx}
                                  className="rounded-sm bg-emerald-400/20 px-0.5 font-semibold text-emerald-200 ring-1 ring-emerald-400/60"
                                >
                                  {seg.text}
                                </mark>
                              ) : (
                                <span key={sIdx}>{seg.text}</span>
                              );
                            }

                            if (seg.entity) {
                              const e = seg.entity;
                              const wl = e.whitelisted === true;
                              return (
                                <span
                                  key={sIdx}
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={wl}
                                  aria-label={`${e.type} ${seg.text}, ${wl ? 'whitelisted, activate to restore redaction' : 'activate to whitelist'}`}
                                  title={`${e.type} • ${e.validationBadge}${
                                    wl
                                      ? ' • Whitelisted (click to re-enable)'
                                      : ' (click to whitelist)'
                                  }`}
                                  onClick={() => onToggleSpan(e)}
                                  onKeyDown={(ev) => {
                                    if (ev.key === 'Enter' || ev.key === ' ') {
                                      ev.preventDefault();
                                      onToggleSpan(e);
                                    }
                                  }}
                                  className={`cursor-pointer rounded-sm px-0.5 ${FOCUS_RING} ${
                                    wl
                                      ? 'text-slate-400 line-through decoration-dashed decoration-slate-500 ring-1 ring-dashed ring-slate-600'
                                      : ENTITY_STYLES[e.type].highlight
                                  }`}
                                >
                                  {seg.text}
                                </span>
                              );
                            }

                            return <span key={sIdx}>{seg.text}</span>;
                          })
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {table.rows.length > visibleRows && (
            <div className="flex items-center justify-center border-t border-slate-800 bg-slate-900/40 px-3 py-2">
              <button
                type="button"
                onClick={() => setVisibleRows((prev) => prev + PAGE_SIZE)}
                className={`rounded border border-slate-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-slate-200 hover:border-emerald-500/50 hover:text-emerald-200 ${FOCUS_RING}`}
              >
                Show {Math.min(PAGE_SIZE, table.rows.length - visibleRows)} more (showing {visibleRows} of {table.rows.length})
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
});
