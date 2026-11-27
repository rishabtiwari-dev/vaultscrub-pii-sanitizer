import type {
  DetectedEntity,
  EntityType,
  RejectedCandidate,
} from './types';

export const ENTITY_PRIORITY: Record<EntityType, number> = {
  CREDIT_CARD: 6,
  EMAIL: 5,
  AADHAAR: 4,
  IP_ADDRESS: 3,
  PAN: 2,
  PHONE: 1,
  CUSTOM: 0,
};

interface Span {
  start: number;
  end: number;
}

/**
 * Index of the first span in `sorted` (non-overlapping, start ASC) whose
 * start is >= `end`. Because spans are disjoint, ends are also ascending,
 * so only `sorted[idx - 1]` can overlap a query span ending at `end`.
 */
function upperBoundByStart(sorted: readonly Span[], end: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid].start < end) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function overlapsAny(sorted: readonly Span[], span: Span): boolean {
  const idx = upperBoundByStart(sorted, span.end);
  return idx > 0 && sorted[idx - 1].end > span.start;
}

/**
 * Resolves overlapping entity candidates deterministically:
 * Priority: CREDIT_CARD > EMAIL > AADHAAR > IP_ADDRESS > PAN > PHONE > CUSTOM,
 * breaking ties by longest match, then earliest start index.
 * Returned entities are strictly non-overlapping and sorted by start ASC.
 * Runs in O(n log n) comparisons via binary-searched interval insertion.
 */
export function resolveSpans(candidates: DetectedEntity[]): DetectedEntity[] {
  const sorted = [...candidates].sort((a, b) => {
    const priorityDiff = ENTITY_PRIORITY[b.type] - ENTITY_PRIORITY[a.type];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const lenDiff = b.end - b.start - (a.end - a.start);
    if (lenDiff !== 0) {
      return lenDiff;
    }
    return a.start - b.start;
  });

  const accepted: DetectedEntity[] = [];
  for (const candidate of sorted) {
    if (candidate.end <= candidate.start) {
      continue;
    }
    const idx = upperBoundByStart(accepted, candidate.end);
    if (idx > 0 && accepted[idx - 1].end > candidate.start) {
      continue;
    }
    accepted.splice(idx, 0, candidate);
  }

  return accepted;
}

/**
 * Removes rejected candidates that overlap an accepted entity and deduplicates
 * remaining entries sorted by start ASC.
 */
export function filterRejectedCandidates(
  rejected: RejectedCandidate[],
  accepted: DetectedEntity[]
): RejectedCandidate[] {
  const acceptedSorted = [...accepted].sort((a, b) => a.start - b.start);
  const seen = new Set<string>();
  const filtered: RejectedCandidate[] = [];

  for (const item of rejected) {
    if (overlapsAny(acceptedSorted, item)) {
      continue;
    }
    const key = `${item.start}:${item.end}:${item.suspectedType}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    filtered.push(item);
  }

  return filtered.sort((a, b) => a.start - b.start);
}
