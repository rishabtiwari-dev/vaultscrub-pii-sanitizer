import {
  sanitizeText,
  type DetectedEntity,
  type EntityType,
  type RedactionOptions,
  type SanitizationResult,
} from '../engine';

export interface CsvCellSegment {
  text: string;
  changed: boolean;
  type?: EntityType;
  entity?: DetectedEntity;
}

export interface CsvTableCell {
  originalValue: string;
  sanitizedValue: string;
  hasChanges: boolean;
  sanitizedSegments: CsvCellSegment[];
  originalSegments: CsvCellSegment[];
}

export interface CsvTableData {
  headers: string[];
  rows: CsvTableCell[][];
  columnCount: number;
  sanitizedCsv: string;
}

interface RawCsvCell {
  value: string;
  rawStart: number;
  rawEnd: number;
  rawIndices: number[];
}

function detectLineEnding(input: string): '\r\n' | '\n' {
  return input.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Parses RFC-4180 CSV text into raw cell structures with character offset mappings.
 */
function parseCsvWithCells(input: string): RawCsvCell[][] {
  if (input.length === 0) {
    return [];
  }

  const rows: RawCsvCell[][] = [];
  let currentRow: RawCsvCell[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    if (input[i] === '"') {
      // Quoted field
      const rawStart = i;
      i += 1; // skip opening quote
      let value = '';
      const rawIndices: number[] = [];

      while (i < len) {
        const ch = input[i];
        if (ch === '"') {
          if (i + 1 < len && input[i + 1] === '"') {
            value += '"';
            rawIndices.push(i);
            i += 2;
          } else {
            i += 1; // skip closing quote
            break;
          }
        } else {
          value += ch;
          rawIndices.push(i);
          i += 1;
        }
      }

      const rawEnd = i;
      currentRow.push({ value, rawStart, rawEnd, rawIndices });

      // Skip optional spaces before delimiter? RFC-4180 expects immediate delimiter or EOL.
      if (i < len && input[i] === ',') {
        i += 1;
        if (i === len) {
          // Trailing comma at EOF -> empty trailing cell
          currentRow.push({ value: '', rawStart: i, rawEnd: i, rawIndices: [] });
          rows.push(currentRow);
          currentRow = [];
        }
      } else if (i < len && (input[i] === '\r' || input[i] === '\n')) {
        if (input[i] === '\r' && i + 1 < len && input[i + 1] === '\n') {
          i += 2;
        } else {
          i += 1;
        }
        rows.push(currentRow);
        currentRow = [];
      }
    } else {
      // Unquoted field
      const rawStart = i;
      let value = '';
      const rawIndices: number[] = [];

      while (i < len && input[i] !== ',' && input[i] !== '\r' && input[i] !== '\n') {
        value += input[i];
        rawIndices.push(i);
        i += 1;
      }

      const rawEnd = i;
      currentRow.push({ value, rawStart, rawEnd, rawIndices });

      if (i < len && input[i] === ',') {
        i += 1;
        if (i === len) {
          currentRow.push({ value: '', rawStart: i, rawEnd: i, rawIndices: [] });
          rows.push(currentRow);
          currentRow = [];
        }
      } else if (i < len && (input[i] === '\r' || input[i] === '\n')) {
        if (input[i] === '\r' && i + 1 < len && input[i + 1] === '\n') {
          i += 2;
        } else {
          i += 1;
        }
        rows.push(currentRow);
        currentRow = [];
      }
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parses an RFC-4180 CSV string into a 2D array of cell values.
 */
export function parseCsv(input: string): string[][] {
  return parseCsvWithCells(input).map((row) => row.map((cell) => cell.value));
}

/**
 * Escapes and quotes a single CSV field per RFC-4180.
 */
export function escapeCsvField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serializes a 2D array of strings into a valid RFC-4180 CSV string.
 */
export function serializeCsv(
  rows: readonly (readonly string[])[],
  lineEnding: '\r\n' | '\n' = '\n'
): string {
  return rows
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join(lineEnding);
}

function mapEntityToCellOffsets(
  cell: RawCsvCell,
  entity: DetectedEntity
): { start: number; end: number } | null {
  if (entity.start < cell.rawStart || entity.end > cell.rawEnd) {
    return null;
  }
  const indices = cell.rawIndices;
  let cellStart = -1;
  let cellEnd = -1;
  for (let k = 0; k < indices.length; k += 1) {
    const rawIdx = indices[k];
    if (cellStart === -1 && rawIdx >= entity.start) {
      cellStart = k;
    }
    if (rawIdx < entity.end) {
      cellEnd = k + 1;
    }
  }
  if (cellStart === -1 || cellEnd === -1 || cellStart >= cellEnd) {
    return null;
  }
  return { start: cellStart, end: cellEnd };
}

function buildCellData(
  cell: RawCsvCell,
  cellEntities: { start: number; end: number; entity: DetectedEntity }[]
): CsvTableCell {
  const sanitizedSegments: CsvCellSegment[] = [];
  const originalSegments: CsvCellSegment[] = [];
  let cursor = 0;
  let hasChanges = false;
  const sanitizedParts: string[] = [];

  for (const item of cellEntities) {
    if (item.start > cursor) {
      const unchanged = cell.value.slice(cursor, item.start);
      sanitizedSegments.push({ text: unchanged, changed: false });
      originalSegments.push({ text: unchanged, changed: false });
      sanitizedParts.push(unchanged);
    }

    const { entity } = item;
    originalSegments.push({
      text: cell.value.slice(item.start, item.end),
      changed: false,
      type: entity.type,
      entity,
    });

    if (entity.whitelisted) {
      const kept = cell.value.slice(item.start, item.end);
      sanitizedSegments.push({ text: kept, changed: false, type: entity.type, entity });
      sanitizedParts.push(kept);
    } else {
      const replacement = entity.replacement ?? entity.value;
      sanitizedSegments.push({
        text: replacement,
        changed: true,
        type: entity.type,
        entity,
      });
      sanitizedParts.push(replacement);
      hasChanges = true;
    }

    cursor = item.end;
  }

  if (cursor < cell.value.length) {
    const tail = cell.value.slice(cursor);
    sanitizedSegments.push({ text: tail, changed: false });
    originalSegments.push({ text: tail, changed: false });
    sanitizedParts.push(tail);
  }

  return {
    originalValue: cell.value,
    sanitizedValue: sanitizedParts.join(''),
    hasChanges,
    sanitizedSegments,
    originalSegments,
  };
}

/**
 * Builds a structured CSV table and strictly valid RFC-4180 sanitized CSV output
 * using the engine's detected entities and exact replacements.
 */
export function buildCsvTableData(
  rawCsv: string,
  entities: DetectedEntity[]
): CsvTableData {
  const rawRows = parseCsvWithCells(rawCsv);
  if (rawRows.length === 0) {
    return { headers: [], rows: [], columnCount: 0, sanitizedCsv: '' };
  }

  const columnCount = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
  const tableRows: CsvTableCell[][] = rawRows.map((row) =>
    row.map((cell) => {
      const matched: { start: number; end: number; entity: DetectedEntity }[] = [];
      for (const entity of entities) {
        if (entity.end <= cell.rawStart) continue;
        if (entity.start >= cell.rawEnd) break;
        const mapped = mapEntityToCellOffsets(cell, entity);
        if (mapped) {
          matched.push({ ...mapped, entity });
        }
      }
      return buildCellData(cell, matched);
    })
  );

  const sanitizedMatrix = tableRows.map((row) => row.map((c) => c.sanitizedValue));
  const sanitizedCsv = serializeCsv(sanitizedMatrix, detectLineEnding(rawCsv));

  const headerCells = tableRows[0] ?? [];
  const headers = Array.from({ length: columnCount }, (_, idx) =>
    headerCells[idx]?.sanitizedValue ?? `Column ${idx + 1}`
  );

  return {
    headers,
    rows: tableRows.slice(1),
    columnCount,
    sanitizedCsv,
  };
}

/**
 * Runs VaultScrub sanitization on a CSV string and returns strictly valid RFC-4180 CSV.
 */
export function sanitizeCsv(
  csvText: string,
  options: RedactionOptions
): { csv: string; result: SanitizationResult } {
  const result = sanitizeText(csvText, options);
  const { sanitizedCsv } = buildCsvTableData(csvText, result.entities);
  return { csv: sanitizedCsv, result };
}
