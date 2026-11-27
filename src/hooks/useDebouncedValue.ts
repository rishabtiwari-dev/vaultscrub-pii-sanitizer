import { useCallback, useEffect, useState } from 'react';

/**
 * Returns a debounced mirror of `value` that updates after `delayMs` of inactivity.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounced state hook that also exposes an immediate setter for instant loads
 * or clears without waiting for the debounce timer.
 */
export function useImmediateDebouncedValue<T>(
  value: T,
  delayMs: number
): [T, (next: T) => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  const setImmediate = useCallback((next: T) => {
    setDebounced(next);
  }, []);

  return [debounced, setImmediate];
}
