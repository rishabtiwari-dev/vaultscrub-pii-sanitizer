import { describe, expect, it } from 'vitest';
import {
  generateValidLuhn,
  generateValidVerhoeff12,
  makeSpanKey,
  sanitizeText,
} from '../engine';
import {
  buildOutputSegments,
  buildSourceSegments,
  countLines,
  formatBytes,
  sanitizedFileName,
  spanAnchor,
  splitSegmentsIntoLines,
} from './output';

describe('output utilities', () => {
  it('handles empty input cleanly', () => {
    const res = sanitizeText('', { mode: 'FULL' });
    const outSegs = buildOutputSegments('', res.entities, res.rejectedCandidates);
    const srcSegs = buildSourceSegments('', res.entities, res.rejectedCandidates);

    expect(outSegs).toEqual([]);
    expect(srcSegs).toEqual([]);
    expect(splitSegmentsIntoLines(outSegs)).toEqual([[]]);
    expect(countLines('')).toBe(0);
  });

  it('reconstructs exact sanitizedText across FULL, PARTIAL, and PSEUDONYM modes', () => {
    const card = generateValidLuhn('4111', 16);
    const aadhaar = generateValidVerhoeff12('49918822331');
    const source = `Contact alice@example.com\nCard: ${card}\nID: ${aadhaar}`;

    const modes = [
      { mode: 'FULL' as const, fullMaskStyle: 'TYPED' as const },
      { mode: 'FULL' as const, fullMaskStyle: 'GENERIC' as const },
      { mode: 'PARTIAL' as const },
      { mode: 'PSEUDONYM' as const },
    ];

    for (const opts of modes) {
      const res = sanitizeText(source, opts);
      const outSegs = buildOutputSegments(source, res.entities, res.rejectedCandidates);
      const srcSegs = buildSourceSegments(source, res.entities, res.rejectedCandidates);

      expect(outSegs.map((s) => s.text).join('')).toBe(res.sanitizedText);
      expect(srcSegs.map((s) => s.text).join('')).toBe(source);
      expect(outSegs.filter((s) => s.changed)).toHaveLength(3);
    }
  });

  it('keeps whitelisted spans verbatim with changed=false and stable anchors', () => {
    const card = generateValidLuhn('4111', 16);
    const source = `Email alice@example.com and card ${card}`;
    const baseline = sanitizeText(source, { mode: 'FULL' });
    const emailEntity = baseline.entities.find((e) => e.type === 'EMAIL');
    expect(emailEntity).toBeDefined();

    const wlKey = makeSpanKey(emailEntity!);
    const res = sanitizeText(source, {
      mode: 'FULL',
      fullMaskStyle: 'TYPED',
      excludedSpanKeys: new Set([wlKey]),
    });

    const outSegs = buildOutputSegments(source, res.entities, res.rejectedCandidates);
    expect(outSegs.map((s) => s.text).join('')).toBe(res.sanitizedText);

    const wlSeg = outSegs.find((s) => s.anchor === spanAnchor(emailEntity!));
    expect(wlSeg).toEqual({
      text: 'alice@example.com',
      changed: false,
      anchor: spanAnchor(emailEntity!),
    });
  });

  it('preserves rejected decoy candidates verbatim with rejected metadata', () => {
    const validCard = generateValidLuhn('4111', 16);
    const invalidLuhn = validCard.slice(0, -1) + String((Number(validCard.at(-1)) + 1) % 10);
    const validAadhaar = generateValidVerhoeff12('49918822331');
    const invalidVerhoeff =
      validAadhaar.slice(0, -1) + String((Number(validAadhaar.at(-1)) + 1) % 10);

    const source = `Order ${invalidLuhn} and ref ${invalidVerhoeff}`;
    const res = sanitizeText(source, { mode: 'FULL', strictVerhoeff: true });

    expect(res.entities).toHaveLength(0);
    expect(res.rejectedCandidates).toHaveLength(2);

    const outSegs = buildOutputSegments(source, res.entities, res.rejectedCandidates);
    const srcSegs = buildSourceSegments(source, res.entities, res.rejectedCandidates);

    expect(outSegs.map((s) => s.text).join('')).toBe(source);
    expect(srcSegs.map((s) => s.text).join('')).toBe(source);
    expect(outSegs.every((s) => !s.changed)).toBe(true);
    expect(outSegs.filter((s) => s.rejected)).toHaveLength(2);
    expect(srcSegs.filter((s) => s.rejected)).toHaveLength(2);
  });

  it('splits segments into lines matching countLines and marks first piece only', () => {
    const text = 'line1\r\nline2\n';
    expect(countLines(text)).toBe(3);

    const lines = splitSegmentsIntoLines([{ text }]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual([{ seg: { text }, text: 'line1', first: true }]);
    expect(lines[1]).toEqual([{ seg: { text }, text: 'line2', first: false }]);
    expect(lines[2]).toEqual([]);
  });

  it('formats byte sizes and sanitized export filenames deterministically', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');

    expect(sanitizedFileName('customers.csv', false)).toEqual({
      name: 'customers_sanitized.csv',
      mime: 'text/csv',
    });
    expect(sanitizedFileName('notes.txt', false)).toEqual({
      name: 'notes_sanitized.txt',
      mime: 'text/plain',
    });
    expect(sanitizedFileName(null, true)).toEqual({
      name: 'vaultscrub_sanitized.csv',
      mime: 'text/csv',
    });
    expect(sanitizedFileName(null, false)).toEqual({
      name: 'vaultscrub_sanitized.txt',
      mime: 'text/plain',
    });
  });
});
