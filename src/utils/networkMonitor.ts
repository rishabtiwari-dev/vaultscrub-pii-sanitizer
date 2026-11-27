import { useSyncExternalStore } from 'react';

/**
 * Lightweight in-browser observer of outbound `fetch` / `XMLHttpRequest` calls.
 * Same-origin requests for dev tooling (Vite HMR, /@vite, /src, /node_modules, ...)
 * and non-network schemes (data:, blob:) are ignored; anything else counts as external.
 */

export interface NetworkRequestRecord {
  method: string;
  url: string;
  at: number;
}

let externalCount = 0;
const records: NetworkRequestRecord[] = [];
const listeners = new Set<() => void>();
let installed = false;

const DEV_PATH_PREFIXES = ['/@vite', '/@react-refresh', '/@id', '/@fs', '/src/', '/node_modules/', '/__vite'];

function isIgnored(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, window.location.href);
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') {
      return true;
    }
    if (url.origin === window.location.origin) {
      return DEV_PATH_PREFIXES.some((p) => url.pathname.startsWith(p));
    }
    return false;
  } catch {
    return true;
  }
}

function record(method: string, rawUrl: string): void {
  if (isIgnored(rawUrl)) return;
  externalCount += 1;
  records.push({ method, url: rawUrl, at: Date.now() });
  listeners.forEach((l) => l());
}

export function installNetworkMonitor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    record(method.toUpperCase(), url);
    return originalFetch(input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ): void {
    record(method.toUpperCase(), String(url));
    originalOpen.call(this, method, url, async, username, password);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getExternalRequestCount(): number {
  return externalCount;
}

export function getRequestRecords(): readonly NetworkRequestRecord[] {
  return records;
}

export function useExternalRequestCount(): number {
  return useSyncExternalStore(subscribe, getExternalRequestCount, () => 0);
}
