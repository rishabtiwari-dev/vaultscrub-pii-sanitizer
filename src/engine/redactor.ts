import { detectCustomTerms, parseCustomTerms } from './customTerms';
import { detectEntities } from './detectors';
import { filterRejectedCandidates, resolveSpans } from './resolver';
import {
  ALL_ENTITY_TYPES,
  makeSpanKey,
  type DetectedEntity,
  type EntityCounts,
  type EntityType,
  type FullMaskStyle,
  type RedactionOptions,
  type SanitizationResult,
} from './types';

const COUNTRY_CODE_REGEX = /^\+(\d{1,3})/;
const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const LEADING_WORD_REGEX = /^[A-Za-z0-9_]/;
const TRAILING_WORD_REGEX = /[A-Za-z0-9_]$/;

const PSEUDONYM_PREFIX: Record<EntityType, string> = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  CREDIT_CARD: 'CARD',
  PAN: 'PAN',
  AADHAAR: 'AADHAAR',
  IP_ADDRESS: 'IP',
  CUSTOM: 'CUSTOM',
};

function resolveEnabledTypes(
  input?: RedactionOptions['enabledTypes']
): Set<EntityType> {
  if (!input) {
    return new Set(ALL_ENTITY_TYPES);
  }
  if (input instanceof Set) {
    return new Set(input);
  }
  if (Array.isArray(input)) {
    return new Set(input);
  }
  const set = new Set<EntityType>();
  for (const type of ALL_ENTITY_TYPES) {
    if (input[type]) {
      set.add(type);
    }
  }
  return set;
}

function resolveExcludedKeys(
  input?: RedactionOptions['excludedSpanKeys']
): Set<string> {
  if (!input) {
    return new Set();
  }
  return input instanceof Set ? input : new Set(input);
}

function createEmptyCounts(): EntityCounts {
  return {
    EMAIL: 0,
    PHONE: 0,
    IP_ADDRESS: 0,
    PAN: 0,
    AADHAAR: 0,
    CREDIT_CARD: 0,
  };
}

/**
 * Generates a full block mask (`[REDACTED]` or `[<TYPE>_REDACTED]`).
 */
export function maskFull(
  type: EntityType,
  fullMaskStyle: FullMaskStyle = 'TYPED'
): string {
  if (fullMaskStyle === 'GENERIC') {
    return '[REDACTED]';
  }
  return `[${type}_REDACTED]`;
}

/**
 * Generates a context-preserving partial mask for each supported entity type.
 */
export function maskPartial(entity: DetectedEntity): string {
  switch (entity.type) {
    case 'CREDIT_CARD': {
      const digits = entity.normalizedValue;
      const last4 = digits.slice(-4);
      if (digits.length === 16) {
        return `XXXX-XXXX-XXXX-${last4}`;
      }
      if (digits.length === 15) {
        return `XXXX-XXXXXX-X${last4}`;
      }
      const maskedCount = Math.max(0, digits.length - 4);
      const masked = 'X'.repeat(maskedCount);
      return `${masked}-${last4}`;
    }

    case 'AADHAAR': {
      const last4 = entity.normalizedValue.slice(-4);
      return `XXXX-XXXX-${last4}`;
    }

    case 'EMAIL': {
      const trimmed = entity.value.trim();
      const atIndex = trimmed.indexOf('@');
      if (atIndex <= 0) {
        return '***';
      }
      const local = trimmed.slice(0, atIndex);
      const domain = trimmed.slice(atIndex + 1);
      return `${local[0]}***@${domain}`;
    }

    case 'PAN': {
      const upper = entity.value.trim().toUpperCase();
      return `${upper.slice(0, 2)}***${upper.slice(5)}`;
    }

    case 'PHONE': {
      const digits = entity.normalizedValue;
      const last4 = digits.slice(-4);
      if (entity.metadata.phoneRegion === 'IN') {
        return `+91-XXXXXX${last4}`;
      }
      const trimmed = entity.value.trim();
      if (trimmed.startsWith('+')) {
        const ccMatch = COUNTRY_CODE_REGEX.exec(trimmed);
        if (ccMatch) {
          const cc = ccMatch[1];
          const remainingMasked = Math.max(4, digits.length - cc.length - 4);
          return `+${cc}-${'X'.repeat(remainingMasked)}${last4}`;
        }
      }
      const prefixMaskLen = Math.max(3, digits.length - 4);
      if (prefixMaskLen === 6) {
        return `XXX-XXX-${last4}`;
      }
      return `${'X'.repeat(prefixMaskLen)}-${last4}`;
    }

    case 'IP_ADDRESS': {
      if (entity.metadata.ipVersion === 'IPv4') {
        const parts = entity.value.split('.');
        return `${parts[0]}.${parts[1]}.X.X`;
      }
      if (entity.value.startsWith('::')) {
        return '::XXXX';
      }
      const groups = entity.value.split(':').filter((g) => g.length > 0);
      const head = groups.slice(0, 2).join(':');
      return head ? `${head}:XXXX:XXXX` : 'XXXX:XXXX';
    }

    case 'CUSTOM': {
      const v = entity.value.trim();
      if (v.length <= 3) {
        return '*'.repeat(Math.max(3, v.length));
      }
      return `${v[0]}${'*'.repeat(v.length - 2)}${v[v.length - 1]}`;
    }
  }
}

/**
 * Runs detection, deterministic non-overlapping resolution, and redaction over input text.
 */
export function sanitizeText(
  text: string,
  options: RedactionOptions
): SanitizationResult {
  const startTime = performance.now();
  const enabledTypes = resolveEnabledTypes(options.enabledTypes);
  const excludedSpanKeys = resolveExcludedKeys(options.excludedSpanKeys);
  const strictVerhoeff = options.strictVerhoeff ?? true;
  const strictPan = options.strictPan ?? false;
  const fullMaskStyle = options.fullMaskStyle ?? 'TYPED';
  const customTerms = parseCustomTerms(options.customTerms);

  const { candidates, rejectedCandidates: rawRejected } = detectEntities(text, {
    strictVerhoeff,
    strictPan,
    enabledTypes,
  });

  if (customTerms.length > 0) {
    candidates.push(...detectCustomTerms(text, customTerms));
  }

  const resolvedEntities = resolveSpans(candidates);
  const rejectedCandidates = filterRejectedCandidates(
    rawRejected,
    resolvedEntities
  );

  const countsByType = createEmptyCounts();
  if (customTerms.length > 0) {
    countsByType.CUSTOM = 0;
  }
  const pseudonymMap: Record<string, string> = {};
  const valueToToken = new Map<string, string>();
  const typeCounters: Record<EntityType, number> = {
    ...createEmptyCounts(),
    CUSTOM: 0,
  };

  const outputChunks: string[] = [];
  let cursor = 0;

  const finalEntities: DetectedEntity[] = resolvedEntities.map((entity) => {
    const spanKey = makeSpanKey(entity);
    const shortKey = `${entity.start}:${entity.end}`;
    const isWhitelisted =
      excludedSpanKeys.has(spanKey) || excludedSpanKeys.has(shortKey);

    outputChunks.push(text.slice(cursor, entity.start));
    cursor = entity.end;

    if (isWhitelisted) {
      outputChunks.push(entity.value);
      return { ...entity, whitelisted: true, replacement: entity.value };
    }

    countsByType[entity.type] = (countsByType[entity.type] ?? 0) + 1;

    let replacement: string;
    switch (options.mode) {
      case 'FULL':
        replacement = maskFull(entity.type, fullMaskStyle);
        break;
      case 'PARTIAL':
        replacement = maskPartial(entity);
        break;
      case 'PSEUDONYM': {
        const lookupKey = `${entity.type}::${entity.normalizedValue}`;
        let token = valueToToken.get(lookupKey);
        if (!token) {
          typeCounters[entity.type] += 1;
          const indexStr = String(typeCounters[entity.type]).padStart(2, '0');
          token = `${PSEUDONYM_PREFIX[entity.type]}_${indexStr}`;
          valueToToken.set(lookupKey, token);
          pseudonymMap[token] = entity.normalizedValue;
        }
        replacement = token;
        break;
      }
    }

    outputChunks.push(replacement);
    return { ...entity, whitelisted: false, replacement };
  });

  outputChunks.push(text.slice(cursor));

  const processingTimeMs = Math.max(0, performance.now() - startTime);

  return {
    sanitizedText: outputChunks.join(''),
    entities: finalEntities,
    rejectedCandidates,
    countsByType,
    pseudonymMap,
    processingTimeMs,
  };
}

export interface RehydrationResult {
  restoredText: string;
  replacementsCount: number;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(REGEX_META_CHARS, '\\$&');
}

/**
 * Deterministically restores pseudonym placeholders back to their original values
 * in a single pass (longest-token-first with word-character boundary guards).
 */
export function rehydrateText(
  sanitizedText: string,
  pseudonymMap: Record<string, string>
): RehydrationResult {
  if (!sanitizedText) {
    return { restoredText: sanitizedText, replacementsCount: 0 };
  }

  const entries = Object.entries(pseudonymMap).filter(([token]) => token.length > 0);
  if (entries.length === 0) {
    return { restoredText: sanitizedText, replacementsCount: 0 };
  }

  entries.sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]));

  const tokenLookup = new Map<string, string>(entries);
  const pattern = entries
    .map(([token]) => {
      const escaped = escapeRegexLiteral(token);
      const prefix = LEADING_WORD_REGEX.test(token) ? '(?<![A-Za-z0-9_])' : '';
      const suffix = TRAILING_WORD_REGEX.test(token) ? '(?![A-Za-z0-9_])' : '';
      return `${prefix}${escaped}${suffix}`;
    })
    .join('|');

  const regex = new RegExp(pattern, 'g');
  let replacementsCount = 0;
  const restoredText = sanitizedText.replace(regex, (match) => {
    replacementsCount += 1;
    return tokenLookup.get(match) ?? match;
  });

  return { restoredText, replacementsCount };
}
