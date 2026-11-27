import { describe, expect, it } from 'vitest';
import {
  getExternalRequestCount,
  getRequestRecords,
  installNetworkMonitor,
  isIgnoredRequestUrl,
} from './networkMonitor';

describe('networkMonitor', () => {
  it('starts with zero external requests and no recorded calls', () => {
    expect(getExternalRequestCount()).toBe(0);
    expect(getRequestRecords()).toEqual([]);
  });

  it('is a safe no-op when called outside a browser window', () => {
    installNetworkMonitor();
    expect(getExternalRequestCount()).toBe(0);
    expect(getRequestRecords()).toEqual([]);
  });

  it('ignores non-network schemes and same-origin dev tooling URLs', () => {
    const base = 'http://localhost:5173/';
    expect(isIgnoredRequestUrl('data:image/svg+xml;utf8,<svg/>', base)).toBe(true);
    expect(isIgnoredRequestUrl('blob:http://localhost:5173/1234', base)).toBe(true);
    expect(isIgnoredRequestUrl('about:blank', base)).toBe(true);
    expect(isIgnoredRequestUrl('/@vite/client', base)).toBe(true);
    expect(isIgnoredRequestUrl('/@react-refresh', base)).toBe(true);
    expect(isIgnoredRequestUrl('/src/App.tsx', base)).toBe(true);
    expect(isIgnoredRequestUrl('/node_modules/lucide-react/dist/esm/icons/x.js', base)).toBe(true);
    expect(isIgnoredRequestUrl('/__vite_ping', base)).toBe(true);
  });

  it('flags outbound cross-origin and same-origin API endpoints as external', () => {
    const base = 'http://localhost:5173/';
    expect(isIgnoredRequestUrl('https://api.example.com/collect', base)).toBe(false);
    expect(isIgnoredRequestUrl('https://evil.test/src/leak', base)).toBe(false);
    expect(isIgnoredRequestUrl('/api/telemetry', base)).toBe(false);
  });
});
