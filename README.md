# VaultScrub

**Live Demo:** https://vaultscrub-pii-sanitizer.vercel.app

**100% Client-Side, Zero-Network PII Detection & Sanitization Workbench**

VaultScrub is an offline-capable, browser-native workbench for detecting, mathematically validating, auditing, and sanitizing Personally Identifiable Information (PII) across unstructured text, logs, clinical notes, resumes, and RFC-4180 CSV files—without a single byte ever leaving the user's device.

---

## Problem & Privacy Guarantee

Traditional sanitization tools often upload sensitive text or CSVs to a backend API, creating a secondary data-exposure risk before redaction even occurs. VaultScrub eliminates server-side exposure by design:

- **Pure In-Browser Execution:** All detection, checksum validation, span resolution, and redaction run synchronously and deterministically in TypeScript inside the browser (`src/engine/`).
- **Live Network Monitor (`0 Network Calls`):** [`src/utils/networkMonitor.ts`](src/utils/networkMonitor.ts) instruments `window.fetch` and `XMLHttpRequest.prototype.open` at runtime and surfaces a live status pill (`100% Client-Side • 0 Network Calls`) in [`src/components/TopBar.tsx`](src/components/TopBar.tsx).
- **Production Content Security Policy:** [`vite.config.ts`](vite.config.ts) injects a strict `<meta http-equiv="Content-Security-Policy">` tag into production builds with `connect-src 'none'`, `default-src 'self'`, `script-src 'self'`, and zero external fonts, scripts, or telemetry.

---

## Mandatory Requirements Matrix

| PromptWars Requirement | Implementation | Verification |
| --- | --- | --- |
| **Multi-Entity Pattern Detection** (Email, Phone, Credit Card, Aadhaar, PAN, IPv4/IPv6 + Custom Terms) | [`src/engine/detectors.ts`](src/engine/detectors.ts), [`src/engine/customTerms.ts`](src/engine/customTerms.ts), [`src/engine/resolver.ts`](src/engine/resolver.ts) | [`src/engine/engine.test.ts`](src/engine/engine.test.ts) (`detectors & overlap resolution`, `custom sensitive terms`) |
| **Luhn Checksum Validation** (Credit Card verification & decoy rejection) | [`src/engine/validators.ts`](src/engine/validators.ts) (`isValidLuhn`, `detectCardNetwork`, `generateValidLuhn`) | [`src/engine/engine.test.ts`](src/engine/engine.test.ts) (`Luhn & card networks`, failed 16-digit Luhn decoy test) |
| **3 Redaction Modes & Local Re-Hydration** (`FULL` [Typed / Generic], `PARTIAL`, `PSEUDONYM` + `rehydrateText`) | [`src/engine/redactor.ts`](src/engine/redactor.ts) (`sanitizeText`, `maskPartial`, `rehydrateText`), [`src/components/RehydrateModal.tsx`](src/components/RehydrateModal.tsx) | [`src/engine/engine.test.ts`](src/engine/engine.test.ts) (`redaction modes`, `round-trip re-hydration` with `>=10` token boundary safety) |
| **Audit & Export** (KPIs incl. `Exposure Neutralized`, Entity/Rejected/Pseudonym tabs, JSON Audit Report, `.txt`/`.csv` download, Clipboard copy) | [`src/components/AuditPanel.tsx`](src/components/AuditPanel.tsx), [`src/components/ControlStrip.tsx`](src/components/ControlStrip.tsx), [`src/utils/output.ts`](src/utils/output.ts), [`src/utils/csv.ts`](src/utils/csv.ts) | [`src/utils/csv.test.ts`](src/utils/csv.test.ts) (RFC-4180 round-trip & `noisy_csv` sanitization) |
| **Sample Loader & File Ingestion** (4 synthetic presets + `.txt`/`.csv` upload & full-viewport drag-and-drop) | [`src/engine/samples.ts`](src/engine/samples.ts), [`src/components/TopBar.tsx`](src/components/TopBar.tsx), [`src/App.tsx`](src/App.tsx) | [`src/engine/engine.test.ts`](src/engine/engine.test.ts) (`sample presets` — exact offsets, zero overlaps, expected decoys) |
| **AI Engineering Prompt Log** | [`PROMPT_LOG.md`](PROMPT_LOG.md), [`src/components/PromptLogModal.tsx`](src/components/PromptLogModal.tsx) | Structured 7-sprint log bundled in-app (`Prompt Log` button) with verification outputs & caught regressions |

---

## Engineering Differentiators Beyond the Spec

1. **Verhoeff Dihedral $D_5$ Checksum Validation:** [`src/engine/validators.ts`](src/engine/validators.ts) implements the full $D_5$ dihedral group Verhoeff algorithm (`isValidVerhoeff`) with a toggleable `Strict Verhoeff` mode to prevent false positives on 12-digit tracking, order, or reference numbers.
2. **Standard PAN Recall + Holder-Type Decoding:** Detects standard `[A-Z]{5}[0-9]{4}[A-Z]` PANs (including universal test PANs like `ABCDE1234F`) while decoding the 10 official 4th-character holder codes (`P` Individual, `C` Company, `H` HUF, `F` Firm, `A` AOP, `T` Trust, `B` BOI, `L` Local Authority, `J` Artificial Juridical Person, `G` Government) into rich badges (`PAN • Individual (P)` vs `PAN • Standard Format`), with an optional `strictPan` engine flag.
3. **Adversarial Log & Edge-Case Hardening:** Extracts bare IPv4s from server logs with `:port`, `/cidr`, or `[brackets]` (`192.168.1.10:8080`, `10.0.0.5/24`) while rejecting `1.2.3.4.5` and `999.1.1.1`; validates 15-digit Amex `4-6-5` cards, Mastercard 2-series (`2221–2720`), plus-addressed emails, and parenthesized international phones (`+1 (415) 555-0199`).
4. **100% Local Round-Trip Re-Hydration (`rehydrateText`):** Sanitize sensitive text with `PSEUDONYM` tokens (`EMAIL_01`, `PHONE_01`), send the scrubbed prompt to any external AI/vendor, then open **Re-Hydrate / Restore** in [`src/components/AuditPanel.tsx`](src/components/AuditPanel.tsx) ([`src/components/RehydrateModal.tsx`](src/components/RehydrateModal.tsx)) to restore original values in a single longest-token-first, boundary-safe pass—using either the active session map or an exported Audit JSON.
5. **Deterministic Non-Overlapping Span Resolution & Decoy Reservation:** [`src/engine/resolver.ts`](src/engine/resolver.ts) resolves overlaps in $O(n \log n)$ time using strict priority (`CREDIT_CARD > EMAIL > AADHAAR > IP_ADDRESS > PAN > PHONE > CUSTOM`), breaking ties by longest match then earliest start. Rejected 16-digit Luhn and 12-digit Verhoeff decoys reserve their spans so `PHONE` regexes never slice 10-digit substrings out of failed IDs.
6. **Canonical Normalization for Consistent Pseudonymization:** `normalizeEntityValue` normalizes phone formatting (`+91-9876543210` vs `98765 43210`), email casing (`ALICE@EXAMPLE.COM` vs `alice@example.com`), card separators, and custom terms so format variations always map to the exact same `TYPE_NN` token (e.g., `PHONE_01`, `EMAIL_01`).
7. **Zero-Dependency RFC-4180 CSV Parser & Interactive Table View:** [`src/utils/csv.ts`](src/utils/csv.ts) and [`src/components/CsvTableView.tsx`](src/components/CsvTableView.tsx) handle quoted commas, escaped quotes, and multi-line cells—preserving exact column counts on export.
8. **Interactive Audit & Human-in-the-Loop Controls:** Live `Exposure Neutralized` KPI, `Rejected False Positives` tab with 1-click Verhoeff mode assist, click-to-jump cross-highlighting (`.vs-focus` pulse animation in [`src/index.css`](src/index.css)), click-to-whitelist individual spans (`excludedSpanKeys`), Custom Sensitive Terms input, in-app `Prompt Log` modal, and structured JSON Audit Report export.

---

## Architecture

```text
+-------------------------------------------------------------------------+
| 1. INPUT INGESTION (100% Local Browser Memory)                          |
|    - Synthetic Samples (support_ticket, hr_resume, clinical_note, csv)  |
|    - Paste / Live Editor / Drag-and-Drop (.txt, .csv)                   |
|    - Custom Sensitive Terms (comma / newline separated)                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| 2. PURE TYPESCRIPT ENGINE (src/engine/ — Zero React/DOM/Network)        |
|    detectors.ts  -->  validators.ts  -->  resolver.ts  -->  redactor.ts |
|    (Regex + Custom)  (Luhn, Verhoeff,    (Priority +       (FULL,       |
|                       PAN 4th, IPv4/6)    Decoy Reserve)    PARTIAL,    |
|                                                             PSEUDONYM)  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| 3. SYNCHRONIZED WORKSPACE & AUDIT UI (src/components/)                  |
|    - DiffPanes.tsx: Synchronized Source Inspector & Redacted Output     |
|    - CsvTableView.tsx: RFC-4180 Cell-by-Cell Diff Table                 |
|    - AuditPanel.tsx: Entities, Rejected Decoys, Pseudonym Map, Jump/WL  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| 4. LOCAL BLOB EXPORT & PRIVACY TELEMETRY                                |
|    - Sanitized .txt / .csv Download (Blob URL) + Clipboard Copy         |
|    - JSON Audit Report Export (optional Pseudonym Map toggle)           |
|    - networkMonitor.ts (0 Network Calls) + Production CSP (connect 'none')
+-------------------------------------------------------------------------+
```

---

## Verified Benchmarks & Quality Gate

All checks were executed directly against the current repository state:

- **Unit & Integration Tests (`pnpm test` / `npm test`):** `31/31` tests passing across 2 test files (`26` in [`src/engine/engine.test.ts`](src/engine/engine.test.ts), `5` in [`src/utils/csv.test.ts`](src/utils/csv.test.ts)).
- **Throughput Benchmark (`vitest run`):** `38.2 ms` end-to-end runtime on a 2,000-line / 155.2 KB noisy document (`4,002` entities detected, `400` rejected decoys logged, `0` overlapping spans).
- **TypeScript Check (`pnpm typecheck` / `npm run typecheck`):** `0` errors under `strict: true`, `noUnusedLocals: true`, and `noUnusedParameters: true`.
- **Production Build (`pnpm build` / `npm run build`):** Clean Vite production bundle in `506 ms` (`dist/index.html` + `dist/assets/index-*.js` at `331.40 kB`), with `connect-src 'none'` CSP injected.

---

## Quick Start & Commands

Works identically with either `pnpm` or `npm`:

```bash
# Install dependencies
pnpm install          # or: npm install

# Start local development server
pnpm dev              # or: npm run dev

# Run Vitest unit & integration test suite
pnpm test             # or: npm test

# Run strict TypeScript typecheck
pnpm typecheck        # or: npm run typecheck

# Typecheck and build production bundle (with CSP meta tag)
pnpm build            # or: npm run build

# Preview production build locally
pnpm preview          # or: npm run preview
```

---

## Verification Tip for Judges

1. Open the app (`pnpm dev` or `pnpm preview`), open **Browser DevTools → Network**, and optionally **disconnect Wi-Fi / enable Offline mode**.
2. Click through all 4 sample presets (**Support Ticket**, **HR Resume / KYC**, **Clinical Note**, **Noisy CSV**), toggle **FULL / PARTIAL / PSEUDONYM** modes, inspect **Rejected False Positives**, click rows in the **Audit Panel** to jump to spans, and export both a sanitized `.txt`/`.csv` file and a JSON Audit Report.
3. Confirm the DevTools Network tab records **0 outbound requests** and the header badge remains **`100% Client-Side • 0 Network Calls`**.
