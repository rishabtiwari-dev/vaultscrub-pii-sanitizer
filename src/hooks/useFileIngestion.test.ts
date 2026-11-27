import { describe, expect, it } from 'vitest';
import { MAX_TEXT_FILE_BYTES, validateIngestedFile } from './useFileIngestion';

describe('validateIngestedFile', () => {
  it('accepts .txt and .csv files up to the 5 MB limit (case-insensitive)', () => {
    expect(validateIngestedFile({ name: 'notes.txt', size: 1024 })).toEqual({ ok: true });
    expect(validateIngestedFile({ name: 'EXPORT.CSV', size: MAX_TEXT_FILE_BYTES })).toEqual({
      ok: true,
    });
  });

  it('rejects unsupported file extensions', () => {
    expect(validateIngestedFile({ name: 'report.pdf', size: 512 })).toEqual({
      ok: false,
      error: 'Only .txt and .csv files are supported.',
    });
    expect(validateIngestedFile({ name: 'audit.json', size: 512 })).toEqual({
      ok: false,
      error: 'Only .txt and .csv files are supported.',
    });
  });

  it('rejects files exceeding 5 MB before reading into memory', () => {
    expect(
      validateIngestedFile({ name: 'huge.csv', size: MAX_TEXT_FILE_BYTES + 1 })
    ).toEqual({
      ok: false,
      error: 'File exceeds the 5 MB client-side limit. Please split or trim the file.',
    });
  });
});
