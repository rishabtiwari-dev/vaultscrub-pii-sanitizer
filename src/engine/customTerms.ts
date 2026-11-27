import type { DetectedEntity } from './types';

export const MIN_CUSTOM_TERM_LENGTH = 2;
export const MAX_CUSTOM_TERMS = 50;

const WHITESPACE_RUN_REGEX = /\s+/g;
const TERM_SPLIT_REGEX = /[,\n]/;
const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const LEADING_ALNUM_REGEX = /^[A-Za-z0-9]/;
const TRAILING_ALNUM_REGEX = /[A-Za-z0-9]$/;

/** Canonical form for custom terms: trimmed, whitespace-collapsed, lower-case. */
export function normalizeCustomTerm(value: string): string {
  return value.trim().replace(WHITESPACE_RUN_REGEX, ' ').toLowerCase();
}

/**
 * Parses user input (comma/newline separated string or array) into a
 * deduplicated (case-insensitive) list of display-cased terms.
 */
export function parseCustomTerms(
  input: string | readonly string[] | undefined | null
): string[] {
  if (!input) {
    return [];
  }
  const raw = typeof input === 'string' ? input.split(TERM_SPLIT_REGEX) : input;
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const item of raw) {
    const term = item.trim().replace(WHITESPACE_RUN_REGEX, ' ');
    if (term.length < MIN_CUSTOM_TERM_LENGTH) {
      continue;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    terms.push(term);
    if (terms.length >= MAX_CUSTOM_TERMS) {
      break;
    }
  }
  return terms;
}

function escapeRegExp(value: string): string {
  return value.replace(REGEX_META_CHARS, '\\$&');
}

function termPattern(term: string): string {
  // Internal whitespace matches any run of spaces/tabs/NBSP (never newlines).
  const body = term.split(' ').map(escapeRegExp).join('[ \\t\\u00A0]+');
  const lead = LEADING_ALNUM_REGEX.test(term) ? '(?<![A-Za-z0-9])' : '';
  const trail = TRAILING_ALNUM_REGEX.test(term) ? '(?![A-Za-z0-9])' : '';
  return `${lead}${body}${trail}`;
}

/** Builds one case-insensitive alternation regex, longest terms first. */
export function buildCustomTermRegex(terms: readonly string[]): RegExp | null {
  if (terms.length === 0) {
    return null;
  }
  const ordered = [...terms].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );
  return new RegExp(ordered.map(termPattern).join('|'), 'gi');
}

/**
 * Detects literal custom-term occurrences. Results may overlap built-in PII
 * candidates; the resolver gives CUSTOM the lowest priority.
 */
export function detectCustomTerms(
  text: string,
  terms: readonly string[]
): DetectedEntity[] {
  const regex = buildCustomTermRegex(terms);
  if (!regex) {
    return [];
  }
  const found: DetectedEntity[] = [];
  for (const match of text.matchAll(regex)) {
    const value = match[0];
    if (!value) {
      continue;
    }
    const start = match.index ?? 0;
    found.push({
      start,
      end: start + value.length,
      value,
      normalizedValue: normalizeCustomTerm(value),
      type: 'CUSTOM',
      metadata: { customTerm: true },
      validationBadge: 'Custom Term',
    });
  }
  return found;
}
