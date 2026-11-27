import {
  maskPartial,
  type DetectedEntity,
  type EntityType,
  type RejectedCandidate,
} from '../engine';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
const LINE_SPLIT_REGEX = /\r\n|\r|\n/;

/** Stable anchor id for a span (entities and rejected candidates never overlap). */
export function spanAnchor(span: { start: number; end: number }): string {
  return `${span.start}:${span.end}`;
}

type Mark =
  | { kind: 'entity'; start: number; end: number; entity: DetectedEntity }
  | { kind: 'rejected'; start: number; end: number; rejected: RejectedCandidate };

/** Merges resolved entities and rejected candidates into one sorted, non-overlapping list. */
function mergeMarks(entities: DetectedEntity[], rejected: RejectedCandidate[]): Mark[] {
  const marks: Mark[] = [
    ...entities.map((e): Mark => ({ kind: 'entity', start: e.start, end: e.end, entity: e })),
    ...rejected.map((r): Mark => ({ kind: 'rejected', start: r.start, end: r.end, rejected: r })),
  ].sort((a, b) => a.start - b.start || (a.kind === 'entity' ? -1 : 1));
  const out: Mark[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start < cursor || m.end <= m.start) continue;
    out.push(m);
    cursor = m.end;
  }
  return out;
}

export interface OutputSegment {
  text: string;
  changed: boolean;
  type?: EntityType;
  anchor?: string;
  rejected?: RejectedCandidate;
}

/** Builds ordered diff output segments combining redacted entities, whitelisted spans, and decoys. */
export function buildOutputSegments(
  text: string,
  entities: DetectedEntity[],
  rejected: RejectedCandidate[] = []
): OutputSegment[] {
  const segs: OutputSegment[] = [];
  let cursor = 0;
  for (const m of mergeMarks(entities, rejected)) {
    if (m.start > cursor) {
      segs.push({ text: text.slice(cursor, m.start), changed: false });
    }
    const anchor = spanAnchor(m);
    if (m.kind === 'rejected') {
      segs.push({ text: m.rejected.value, changed: false, anchor, rejected: m.rejected });
    } else if (m.entity.whitelisted) {
      segs.push({ text: m.entity.value, changed: false, anchor });
    } else {
      segs.push({
        text: m.entity.replacement ?? m.entity.value,
        changed: true,
        type: m.entity.type,
        anchor,
      });
    }
    cursor = m.end;
  }
  if (cursor < text.length) {
    segs.push({ text: text.slice(cursor), changed: false });
  }
  return segs;
}

export interface SourceSegment {
  text: string;
  anchor?: string;
  entity?: DetectedEntity;
  rejected?: RejectedCandidate;
}

/** Builds ordered source segments annotating detected entities and rejected decoy spans. */
export function buildSourceSegments(
  text: string,
  entities: DetectedEntity[],
  rejected: RejectedCandidate[]
): SourceSegment[] {
  const segs: SourceSegment[] = [];
  let cursor = 0;
  for (const m of mergeMarks(entities, rejected)) {
    if (m.start > cursor) segs.push({ text: text.slice(cursor, m.start) });
    const value = text.slice(m.start, m.end);
    segs.push(
      m.kind === 'entity'
        ? { text: value, anchor: spanAnchor(m), entity: m.entity }
        : { text: value, anchor: spanAnchor(m), rejected: m.rejected }
    );
    cursor = m.end;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor) });
  return segs;
}

export interface LinePiece<T> {
  seg: T;
  text: string;
  /** True for the first visual piece of a segment (carries the anchor). */
  first: boolean;
}

/**
 * Splits rendered segments into per-line arrays for line-number gutters.
 * Line count matches `countLines` (a trailing newline yields an empty last line).
 */
export function splitSegmentsIntoLines<T extends { text: string }>(segs: T[]): LinePiece<T>[][] {
  const lines: LinePiece<T>[][] = [[]];
  for (const seg of segs) {
    const parts = seg.text.split(LINE_SPLIT_REGEX);
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ seg, text: part, first: i === 0 });
    });
  }
  return lines;
}

/** Returns a partial-masked preview string for audit tables. */
export function previewMasked(entity: DetectedEntity): string {
  return maskPartial(entity);
}

/** Formats a byte count into human-readable B, KB, or MB units. */
export function formatBytes(n: number): string {
  if (n < BYTES_PER_KB) return `${n} B`;
  if (n < BYTES_PER_MB) return `${(n / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(n / BYTES_PER_MB).toFixed(2)} MB`;
}

/** Counts display lines in text (an empty string has 0 lines). */
export function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split(LINE_SPLIT_REGEX).length;
}

/** Computes a safe download filename and MIME type for sanitized output. */
export function sanitizedFileName(
  sourceName: string | null,
  isCsvSample: boolean
): { name: string; mime: string } {
  if (sourceName) {
    const dot = sourceName.lastIndexOf('.');
    const base = dot > 0 ? sourceName.slice(0, dot) : sourceName;
    const ext = dot > 0 ? sourceName.slice(dot + 1).toLowerCase() : 'txt';
    const safeExt = ext === 'csv' ? 'csv' : 'txt';
    return {
      name: `${base}_sanitized.${safeExt}`,
      mime: safeExt === 'csv' ? 'text/csv' : 'text/plain',
    };
  }
  return isCsvSample
    ? { name: 'vaultscrub_sanitized.csv', mime: 'text/csv' }
    : { name: 'vaultscrub_sanitized.txt', mime: 'text/plain' };
}
