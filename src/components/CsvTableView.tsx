import { useState } from 'react';
import { Check, Copy, Download, Eye, ShieldCheck, Table2 } from 'lucide-react';
import { type DetectedEntity } from '../engine';
import { type CsvTableData } from '../utils/csv';
import { ENTITY_STYLES } from './entityStyles';

type CellMode = 'sanitized' | 'original';

interface Props {
  table: CsvTableData;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onToggleSpan: (e: DetectedEntity) => void;
}

export function CsvTableView({
  table,
  copied,
  onCopy,
  onDownload,
  onToggleSpan,
}: Props) {
  const [cellMode, setCellMode] = useState<CellMode>('sanitized');

  return (
    <div className="flex h-[360px] min-h-[300px] flex-none flex-col overflow-hidden rounded-lg border border-slate-800 bg-zinc-950 lg:h-full lg:min-h-[360px] lg:max-h-[620px] lg:min-w-0 lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            CSV Table View
          </h2>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'} × {table.columnCount} cols
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded border border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => setCellMode('sanitized')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 ${
                cellMode === 'sanitized'
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="h-3 w-3" /> Sanitized
            </button>
            <button
              type="button"
              onClick={() => setCellMode('original')}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 ${
                cellMode === 'original'
                  ? 'bg-slate-700 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="h-3 w-3" /> Original (Highlighted)
            </button>
          </div>

          <button
            type="button"
            disabled={table.columnCount === 0}
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:border-slate-500 disabled:opacity-40"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? 'Copied!' : 'Copy Sanitized'}
          </button>

          <button
            type="button"
            disabled={table.columnCount === 0}
            onClick={onDownload}
            className="inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> Download Sanitized
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
                <th className="border-b border-r border-slate-800 px-3 py-2 text-right text-slate-500">
                  #
                </th>
                {table.headers.map((header, idx) => (
                  <th
                    key={idx}
                    className="whitespace-nowrap border-b border-r border-slate-800 px-3 py-2 font-semibold text-slate-200 last:border-r-0"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {table.rows.map((row, rIdx) => (
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
                                  className={`cursor-pointer rounded-sm px-0.5 ${
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
        </div>
      )}
    </div>
  );
}
