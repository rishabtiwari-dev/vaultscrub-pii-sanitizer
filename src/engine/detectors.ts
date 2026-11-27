import type {
  DetectedEntity,
  EntityType,
  RejectedCandidate,
} from './types';
import { normalizeCustomTerm } from './customTerms';
import {
  decodePanHolderType,
  detectCardNetwork,
  isValidIPv4,
  isValidIPv6,
  isValidLuhn,
  isValidPan,
  isValidVerhoeff,
} from './validators';

export interface DetectionOptions {
  strictVerhoeff?: boolean;
  strictPan?: boolean;
  enabledTypes?: Set<EntityType>;
}

export interface DetectionOutput {
  candidates: DetectedEntity[];
  rejectedCandidates: RejectedCandidate[];
}

interface SpanRange {
  start: number;
  end: number;
}

function spansOverlap(a: SpanRange, b: SpanRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Normalizes a detected entity value into canonical form so format variations
 * (case, spacing, hyphens, Indian phone prefixes) map consistently.
 */
export function normalizeEntityValue(type: EntityType, value: string): string {
  switch (type) {
    case 'EMAIL':
    case 'PAN':
    case 'IP_ADDRESS':
      return value.trim().toLowerCase();

    case 'CREDIT_CARD':
    case 'AADHAAR':
      return value.replace(/\D/g, '');

    case 'PHONE': {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 14 && digits.startsWith('0091')) {
        const tail = digits.slice(4);
        if (/^[6-9]\d{9}$/.test(tail)) {
          return tail;
        }
      }
      if (digits.length === 12 && digits.startsWith('91')) {
        const tail = digits.slice(2);
        if (/^[6-9]\d{9}$/.test(tail)) {
          return tail;
        }
      }
      if (digits.length === 11 && digits.startsWith('0')) {
        const tail = digits.slice(1);
        if (/^[6-9]\d{9}$/.test(tail)) {
          return tail;
        }
      }
      return digits;
    }

    case 'CUSTOM':
      return normalizeCustomTerm(value);
  }
}

const CREDIT_CARD_REGEX = /(?<![A-Za-z0-9+]|\d-)\d(?:[ -]?\d){12,18}(?![A-Za-z0-9]|-\d)/g;
const EMAIL_REGEX =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const AADHAAR_REGEX =
  /(?<![A-Za-z0-9+])(?:[2-9]\d{11}|[2-9]\d{3}([ -])\d{4}\1\d{4})(?![A-Za-z0-9])/g;
const IPV4_REGEX =
  /(?<![A-Za-z0-9]|\d\.)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![A-Za-z0-9]|\.\d)/g;
const IPV6_REGEX =
  /(?<![A-Za-z0-9:])(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?:\.\d{1,3}\.\d{1,3}\.\d{1,3})?(?![A-Za-z0-9:])/g;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;

// Indian (+91/0091/91, leading 0, or bare 10-digit starting 6-9) and standard international formats.
// Uses [ -] instead of \s to avoid spanning across newlines, and negative lookbehind/ahead on digit-hyphen boundaries.
const PHONE_REGEX =
  /(?<![A-Za-z0-9+.]|\d[ -])(?:(?:\+91|0091|91)[ -]?[6-9]\d{4}[ -]?\d{5}|0[ -]?[6-9]\d{4}[ -]?\d{5}|[6-9]\d{4}[ -]?\d{5}|[6-9]\d{2}[ -]?\d{3}[ -]?\d{4}|\+(?!91(?:\D|$))[1-9]\d{0,2}[ -]?(?:(?:\(\d{1,4}\)[ -]?)(?:\d[ -]?){5,10}\d|(?:\d[ -]?){7,12}\d)|\(\d{3}\)[ -]?\d{3}[ -]?\d{4}|[2-9]\d{2}[ -]\d{3}[ -]\d{4})(?![A-Za-z0-9.]|[ -]\d)/g;

const ISO_DATE_LIKE = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
const DMY_DATE_LIKE = /^\d{2}[-/]\d{2}[-/]\d{4}$/;

/**
 * Runs all PII detectors over the input text, returning raw overlapping candidates
 * plus rejected candidates (failed Luhn 16-digit IDs, failed Verhoeff 12-digit IDs).
 */
export function detectEntities(
  text: string,
  options: DetectionOptions = {}
): DetectionOutput {
  const strictVerhoeff = options.strictVerhoeff ?? true;
  const strictPan = options.strictPan ?? false;
  const enabledTypes = options.enabledTypes;
  const isEnabled = (type: EntityType): boolean =>
    enabledTypes ? enabledTypes.has(type) : true;

  const candidates: DetectedEntity[] = [];
  const rejectedCandidates: RejectedCandidate[] = [];
  const reservedNumericSpans: SpanRange[] = [];

  // 1. Credit Cards (always scanned to guard against substring false positives on 16-digit IDs)
  for (const match of text.matchAll(CREDIT_CARD_REGEX)) {
    const start = match.index ?? 0;
    const value = match[0];
    const end = start + value.length;
    const digits = value.replace(/\D/g, '');

    if (digits.length < 13 || digits.length > 19 || /^0+$/.test(digits)) {
      continue;
    }

    if (isValidLuhn(digits)) {
      reservedNumericSpans.push({ start, end });
      if (isEnabled('CREDIT_CARD')) {
        const cardNetwork = detectCardNetwork(digits);
        candidates.push({
          start,
          end,
          value,
          normalizedValue: normalizeEntityValue('CREDIT_CARD', value),
          type: 'CREDIT_CARD',
          metadata: {
            cardNetwork,
            luhnValid: true,
          },
          validationBadge: `${cardNetwork} · Luhn Valid`,
        });
      }
    } else if (digits.length === 16) {
      reservedNumericSpans.push({ start, end });
      if (isEnabled('CREDIT_CARD')) {
        rejectedCandidates.push({
          start,
          end,
          value,
          suspectedType: 'CREDIT_CARD',
          reason: 'Failed Luhn check (likely Order/Transaction ID)',
        });
      }
    }
  }

  // 2. Emails
  if (isEnabled('EMAIL')) {
    for (const match of text.matchAll(EMAIL_REGEX)) {
      const start = match.index ?? 0;
      const value = match[0];
      candidates.push({
        start,
        end: start + value.length,
        value,
        normalizedValue: normalizeEntityValue('EMAIL', value),
        type: 'EMAIL',
        metadata: {},
        validationBadge: 'Valid Email',
      });
    }
  }

  // 3. Aadhaar (12-digit starting 2-9)
  for (const match of text.matchAll(AADHAAR_REGEX)) {
    const start = match.index ?? 0;
    const value = match[0];
    const end = start + value.length;
    const span = { start, end };

    if (reservedNumericSpans.some((reserved) => spansOverlap(span, reserved))) {
      continue;
    }

    const digits = value.replace(/\D/g, '');
    if (digits.length !== 12) {
      continue;
    }

    if (isValidVerhoeff(digits)) {
      reservedNumericSpans.push(span);
      if (isEnabled('AADHAAR')) {
        candidates.push({
          start,
          end,
          value,
          normalizedValue: normalizeEntityValue('AADHAAR', value),
          type: 'AADHAAR',
          metadata: { verhoeffValid: true },
          validationBadge: 'Verhoeff Valid',
        });
      }
    } else if (strictVerhoeff) {
      reservedNumericSpans.push(span);
      if (isEnabled('AADHAAR')) {
        rejectedCandidates.push({
          start,
          end,
          value,
          suspectedType: 'AADHAAR',
          reason: 'Failed Verhoeff checksum (likely Tracking/Reference ID)',
        });
      }
    } else if (isEnabled('AADHAAR')) {
      reservedNumericSpans.push(span);
      candidates.push({
        start,
        end,
        value,
        normalizedValue: normalizeEntityValue('AADHAAR', value),
        type: 'AADHAAR',
        metadata: { verhoeffValid: false },
        validationBadge: 'Format Match (Unverified)',
      });
    }
  }

  // 4. IP Addresses (IPv4 & IPv6)
  if (isEnabled('IP_ADDRESS')) {
    for (const match of text.matchAll(IPV4_REGEX)) {
      const start = match.index ?? 0;
      const value = match[0];
      if (!isValidIPv4(value)) {
        continue;
      }
      candidates.push({
        start,
        end: start + value.length,
        value,
        normalizedValue: normalizeEntityValue('IP_ADDRESS', value),
        type: 'IP_ADDRESS',
        metadata: { ipVersion: 'IPv4' },
        validationBadge: 'IPv4 Valid',
      });
    }

    for (const match of text.matchAll(IPV6_REGEX)) {
      const start = match.index ?? 0;
      const value = match[0];
      if (!/[0-9a-fA-F]/.test(value) || !isValidIPv6(value)) {
        continue;
      }
      candidates.push({
        start,
        end: start + value.length,
        value,
        normalizedValue: normalizeEntityValue('IP_ADDRESS', value),
        type: 'IP_ADDRESS',
        metadata: { ipVersion: 'IPv6' },
        validationBadge: 'IPv6 Valid',
      });
    }
  }

  // 5. Indian PAN
  if (isEnabled('PAN')) {
    for (const match of text.matchAll(PAN_REGEX)) {
      const start = match.index ?? 0;
      const value = match[0];
      if (!isValidPan(value, strictPan)) {
        continue;
      }
      const upper = value.trim().toUpperCase();
      const holder = decodePanHolderType(upper);
      const panHolderType = holder !== 'Unknown' ? holder : 'Standard Format';
      const validationBadge =
        holder !== 'Unknown'
          ? `PAN • ${holder} (${upper[3]})`
          : 'PAN • Standard Format';
      candidates.push({
        start,
        end: start + value.length,
        value,
        normalizedValue: normalizeEntityValue('PAN', value),
        type: 'PAN',
        metadata: { panHolderType },
        validationBadge,
      });
    }
  }

  // 6. Phone Numbers
  if (isEnabled('PHONE')) {
    for (const match of text.matchAll(PHONE_REGEX)) {
      const start = match.index ?? 0;
      const value = match[0];
      const end = start + value.length;
      const span = { start, end };

      if (ISO_DATE_LIKE.test(value) || DMY_DATE_LIKE.test(value)) {
        continue;
      }
      if (reservedNumericSpans.some((reserved) => spansOverlap(span, reserved))) {
        continue;
      }

      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        continue;
      }

      const normalized = normalizeEntityValue('PHONE', value);
      const isIndian =
        /^(?:\+91|0091)/.test(value) ||
        (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) ||
        (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) ||
        (digits.length === 10 && /^[6-9]/.test(digits) && !value.trim().startsWith('('));

      candidates.push({
        start,
        end,
        value,
        normalizedValue: normalized,
        type: 'PHONE',
        metadata: { phoneRegion: isIndian ? 'IN' : 'INTL' },
        validationBadge: isIndian ? 'IN Phone' : 'Intl Phone',
      });
    }
  }

  return { candidates, rejectedCandidates };
}
