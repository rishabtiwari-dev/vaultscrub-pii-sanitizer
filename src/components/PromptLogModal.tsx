import { Fragment, useMemo, useRef } from 'react';
import { Download, ScrollText, X } from 'lucide-react';
import promptLogRaw from '../../PROMPT_LOG.md?raw';
import { useModalFocus } from './useModalFocus';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Renders inline **bold**, *italic*, `code`, and [label](href) spans cleanly. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let idx = 0;
  for (const m of text.matchAll(tokenRe)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const tok = m[0];
    if (tok.startsWith('`')) {
      parts.push(
        <code key={idx++} className="rounded bg-slate-800/90 px-1 py-0.5 font-mono text-[11px] text-emerald-300">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith('**')) {
      parts.push(
        <strong key={idx++} className="font-semibold text-slate-100">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith('*')) {
      parts.push(
        <em key={idx++} className="italic text-slate-300">
          {tok.slice(1, -1)}
        </em>
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      parts.push(
        <span key={idx++} className="font-mono text-sky-300" title={linkMatch?.[2]}>
          {linkMatch?.[1] ?? tok}
        </span>
      );
    }
    last = start + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function PromptLogContent({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      if (trimmed === '---') {
        out.push(<hr key={key++} className="my-4 border-slate-800" />);
        i += 1;
        continue;
      }

      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i += 1;
        }
        i += 1; // skip closing fence
        out.push(
          <pre
            key={key++}
            className="my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-slate-300"
          >
            {codeLines.join('\n')}
          </pre>
        );
        continue;
      }

      if (trimmed.startsWith('### ')) {
        out.push(
          <h5 key={key++} className="mt-5 mb-2 text-sm font-semibold text-emerald-300">
            {renderInline(trimmed.slice(4))}
          </h5>
        );
        i += 1;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        out.push(
          <h4 key={key++} className="mt-5 mb-2 border-b border-slate-800 pb-1 text-base font-semibold text-slate-100">
            {renderInline(trimmed.slice(3))}
          </h4>
        );
        i += 1;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        out.push(
          <h3 key={key++} className="mb-2 text-lg font-semibold text-slate-50">
            {renderInline(trimmed.slice(2))}
          </h3>
        );
        i += 1;
        continue;
      }

      // Markdown table
      if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1].trim())) {
        const headers = splitTableRow(trimmed);
        i += 2; // skip header + separator
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(splitTableRow(lines[i]));
          i += 1;
        }
        out.push(
          <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  {headers.map((h, ci) => (
                    <th key={ci} scope="col" className="px-3 py-2 font-medium">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rows.map((r, ri) => (
                  <tr key={ri} className="bg-zinc-950/60">
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 align-top text-slate-300">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Unordered / ordered list
      if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const items: { indent: number; text: string }[] = [];
        while (i < lines.length) {
          const cur = lines[i];
          const curTrim = cur.trim();
          const m = curTrim.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
          if (!m) break;
          const indent = cur.length - cur.trimStart().length;
          items.push({ indent, text: m[1] });
          i += 1;
        }
        const Tag = ordered ? 'ol' : 'ul';
        out.push(
          <Tag
            key={key++}
            className={`my-2 space-y-1.5 pl-5 text-xs leading-relaxed text-slate-300 ${
              ordered ? 'list-decimal' : 'list-disc'
            }`}
          >
            {items.map((it, idx) => (
              <li key={idx} className={it.indent >= 2 ? 'ml-4 list-[circle] text-slate-400' : ''}>
                {renderInline(it.text)}
              </li>
            ))}
          </Tag>
        );
        continue;
      }

      // Paragraph
      const paraLines: string[] = [trimmed];
      i += 1;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('#') &&
        lines[i].trim() !== '---' &&
        !lines[i].trim().startsWith('|') &&
        !lines[i].trim().startsWith('```') &&
        !/^(?:[-*]|\d+\.)\s+/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i].trim());
        i += 1;
      }
      out.push(
        <p key={key++} className="my-2 text-xs leading-relaxed text-slate-300">
          {paraLines.map((pl, idx) => (
            <Fragment key={idx}>
              {idx > 0 && ' '}
              {renderInline(pl)}
            </Fragment>
          ))}
        </p>
      );
    }

    return out;
  }, [markdown]);

  return <>{blocks}</>;
}

export function PromptLogModal({ open, onClose }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useModalFocus(open, onClose, closeBtnRef);

  if (!open) return null;

  const downloadLog = () => {
    const blob = new Blob([promptLogRaw], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PROMPT_LOG.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-log-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5">
              <ScrollText aria-hidden="true" className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 id="prompt-log-title" className="text-sm font-semibold text-slate-100">
                AI Engineering &amp; Prompt Log
              </h2>
              <p className="text-[11px] text-slate-400">
                Bundled offline from PROMPT_LOG.md • zero network calls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadLog}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" /> Download PROMPT_LOG.md
            </button>
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <PromptLogContent markdown={promptLogRaw} />
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/40 px-5 py-3">
          <span className="font-mono text-[11px] text-slate-500">
            Bundled at build time via Vite ?raw • Esc or click outside to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
