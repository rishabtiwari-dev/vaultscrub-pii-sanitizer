import type {
  DetectedEntity,
  EntityType,
  RejectedCandidate,
} from './types';

/** Deterministic priority rank for overlapping entity resolution (higher wins). */
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

/**
 * Binary search returning the index of `target` inside a strictly ascending `nums` array.
 */
function indexOfSorted(nums: readonly number[], target: number): number {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const val = nums[mid];
    if (val === target) {
      return mid;
    }
    if (val < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return -1;
}

function overlapsAny(sorted: readonly Span[], span: Span): boolean {
  const idx = upperBoundByStart(sorted, span.end);
  return idx > 0 && sorted[idx - 1].end > span.start;
}

function bitAdd(tree: Int32Array, index: number, delta: number): void {
  for (let i = index + 1; i < tree.length; i += i & -i) {
    tree[i] += delta;
  }
}

function bitPrefixSum(tree: Int32Array, count: number): number {
  let sum = 0;
  for (let i = count; i > 0; i -= i & -i) {
    sum += tree[i];
  }
  return sum;
}

function bitRangeSum(tree: Int32Array, left: number, right: number): number {
  if (left >= right) {
    return 0;
  }
  return bitPrefixSum(tree, right) - bitPrefixSum(tree, left);
}

/**
 * Resolves overlapping entity candidates deterministically in strict O(N log N) time:
 * Priority: CREDIT_CARD > EMAIL > AADHAAR > IP_ADDRESS > PAN > PHONE > CUSTOM,
 * breaking ties by longest match, then earliest start index.
 * Uses coordinate compression + a Fenwick Tree (Binary Indexed Tree) so each
 * elementary interval transitions from empty to occupied at most once.
 * Returned entities are strictly non-overlapping and sorted by start ASC.
 */
export function resolveSpans(candidates: DetectedEntity[]): DetectedEntity[] {
  const valid = candidates.filter((c) => c.end > c.start);
  if (valid.length === 0) {
    return [];
  }

  valid.sort((a, b) => {
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

  // Coordinate-compress all distinct span endpoints into elementary intervals [k, k + 1).
  const rawEndpoints = new Array<number>(valid.length * 2);
  for (let i = 0; i < valid.length; i++) {
    rawEndpoints[i * 2] = valid[i].start;
    rawEndpoints[i * 2 + 1] = valid[i].end;
  }
  rawEndpoints.sort((a, b) => a - b);

  const coords: number[] = [rawEndpoints[0]];
  for (let i = 1; i < rawEndpoints.length; i++) {
    if (rawEndpoints[i] !== rawEndpoints[i - 1]) {
      coords.push(rawEndpoints[i]);
    }
  }

  const elementaryCount = coords.length - 1;
  const tree = new Int32Array(elementaryCount + 1);
  const accepted: DetectedEntity[] = [];

  for (const candidate of valid) {
    const left = indexOfSorted(coords, candidate.start);
    const right = indexOfSorted(coords, candidate.end);
    if (bitRangeSum(tree, left, right) !== 0) {
      continue;
    }
    accepted.push(candidate);
    for (let k = left; k < right; k++) {
      bitAdd(tree, k, 1);
    }
  }

  return accepted.sort((a, b) => a.start - b.start);
}

/**
 * Removes rejected candidates that overlap an accepted entity and deduplicates
 * remaining entries sorted by start ASC in O((N + M) log N) time.
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
