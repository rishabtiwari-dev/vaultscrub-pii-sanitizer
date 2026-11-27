import { describe, expect, it } from 'vitest';
import { SAMPLE_PRESETS } from '../engine';
import { buildCsvTableData, parseCsv, sanitizeCsv, serializeCsv } from './csv';

describe('RFC-4180 CSV parser & serializer', () => {
  it('parses quoted commas and escaped double quotes', () => {
    const input = [
      'id,name,notes',
      '1,"Sharma, Priya","Said ""hello, world"" today"',
      '2,Arjun,"Simple note"',
    ].join('\n');

    const rows = parseCsv(input);
    expect(rows).toEqual([
      ['id', 'name', 'notes'],
      ['1', 'Sharma, Priya', 'Said "hello, world" today'],
      ['2', 'Arjun', 'Simple note'],
    ]);
  });

  it('handles multi-line quoted fields and CRLF line endings', () => {
    const input = 'col1,col2,col3\r\n1,"line one\r\nline two",ok\r\n2,"a,b",done\r\n';
    const rows = parseCsv(input);
    expect(rows).toEqual([
      ['col1', 'col2', 'col3'],
      ['1', 'line one\r\nline two', 'ok'],
      ['2', 'a,b', 'done'],
    ]);
  });

  it('round-trips special characters with valid RFC-4180 quoting', () => {
    const rows = [
      ['h1', 'h2', 'h3'],
      ['plain', 'has, comma', 'has "quotes" and\nnewline'],
    ];
    const serialized = serializeCsv(rows);
    expect(parseCsv(serialized)).toEqual(rows);
  });

  it('preserves exact column counts and valid quoting during round-trip CSV sanitization', () => {
    const raw = [
      'row_id,email,notes',
      '1,"priya.sharma@example.com","Quoted, ""VIP"" contact priya.sharma@example.com"',
      '2,"arjun.nair@protonmail.com","Multi-line\nnote with +91 98765 43210"',
    ].join('\r\n');

    const { csv, result } = sanitizeCsv(raw, { mode: 'PSEUDONYM' });
    const parsedOriginal = parseCsv(raw);
    const parsedSanitized = parseCsv(csv);

    expect(parsedSanitized.length).toBe(parsedOriginal.length);
    for (let r = 0; r < parsedOriginal.length; r += 1) {
      expect(parsedSanitized[r].length).toBe(parsedOriginal[r].length);
    }

    expect(parsedSanitized[1][1]).toBe('EMAIL_01');
    expect(parsedSanitized[1][2]).toBe('Quoted, "VIP" contact EMAIL_01');
    expect(parsedSanitized[2][1]).toBe('EMAIL_02');
    expect(parsedSanitized[2][2]).toBe('Multi-line\nnote with PHONE_01');
    expect(result.pseudonymMap['EMAIL_01']).toBe('priya.sharma@example.com');
  });

  it('parses and sanitizes the noisy_csv sample preset with consistent column counts', () => {
    const raw = SAMPLE_PRESETS.noisy_csv.content;
    const { csv, result } = sanitizeCsv(raw, { mode: 'FULL', fullMaskStyle: 'TYPED' });
    const table = buildCsvTableData(raw, result.entities);

    expect(table.columnCount).toBe(8);
    expect(table.rows.length).toBe(3);

    const parsed = parseCsv(csv);
    expect(parsed.length).toBe(4);
    for (const row of parsed) {
      expect(row.length).toBe(8);
    }
    expect(parsed[1][1]).toBe('[EMAIL_REDACTED]');
  });
});
