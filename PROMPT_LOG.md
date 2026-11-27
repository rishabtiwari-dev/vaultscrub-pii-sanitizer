# VaultScrub — AI-Assisted Engineering & Prompt Log

This document records the structured, 7-sprint AI-assisted engineering workflow used to build **VaultScrub** for the Google + Hack2skill PromptWars evaluation. Every architectural decision, structured prompt specification, verification gate, and caught regression is documented below.

---

## Methodology Overview

1. **Problem-First Specification & Shared Memory (`AGENTS.md`):** Before writing application code, we codified non-negotiable architectural boundaries in [`AGENTS.md`](AGENTS.md)—most importantly the **Zero-Network Privacy Constraint**, **Pure Engine Boundary** (`src/engine/` free of React/DOM/storage), **Offset Integrity** (`text.slice(start, end) === value`), and **Synthetic Test Data** (`generateValidLuhn` / `generateValidVerhoeff12`).
2. **Sprint-Based Context Isolation:** Each sprint ran in a fresh conversation anchored by `AGENTS.md` and explicit file-read directives, preventing context bloat and keeping edits tightly scoped.
3. **Pure-Engine-Before-UI Sequencing:** The mathematical validators, detectors, span resolver, and redactor were built and unit-tested in Node/Vitest (Sprint 1) before any React UI was constructed (Sprints 2–6).
4. **Automated Verification Gates:** Every sprint concluded with `pnpm typecheck` (`tsc --noEmit`), `pnpm test` (`vitest run`), and `pnpm build` (`vite build`) before advancing.

---

## Sprint Summary

| Sprint | Objective | Model Used | Key Artifacts Produced | Verification Result |
| --- | --- | --- | --- | --- |
| **Sprint 1** | Pure TypeScript PII Engine & Mathematical Validators | **Gemini 4 Neon Orchestrator** | `src/engine/{types,validators,detectors,resolver,redactor,samples,index}.ts`, `engine.test.ts` | `17/17` Vitest tests passing, `0` TS errors |
| **Sprint 2** | Core Workbench UI, Synced Diff Panes & Network Monitor | **Claude Sonnet 5.5** | `src/App.tsx`, `TopBar.tsx`, `ControlStrip.tsx`, `DiffPanes.tsx`, `AuditPanel.tsx`, `networkMonitor.ts`, `output.ts` | `17/17` Vitest tests, clean `tsc` & `vite build` |
| **Sprint 3** | RFC-4180 CSV Table View, Custom Terms & JSON Audit Export | **Gemini 4 Hydrogen** | `src/utils/csv.ts`, `csv.test.ts`, `CsvTableView.tsx`, `customTerms.ts`, JSON audit export | `26/26` Vitest tests (`+5` CSV, `+4` engine), clean build |
| **Sprint 4** | Visual Polish, Click-to-Jump Cross-Highlighting & Production CSP | **Claude Opus 5.5** | `HowItWorksModal.tsx`, `entityStyles.ts`, click-to-jump anchors, `vite.config.ts` CSP plugin | Partial edit due to model credit boundary (audited in 4B) |
| **Sprint 4B** | Post-Boundary Audit, `.vs-focus` Animation & CSP Entity Fix | **Gemini 4 Hydrogen** | `src/index.css` (`.vs-focus` pulse), `vite.config.ts` literal single-quote CSP `<meta>` | `26/26` Vitest tests, `0` TS errors, clean `vite build` |
| **Sprint 5** | Judge-Ready Documentation (`README.md` & `PROMPT_LOG.md`) | **Gemini 4 Hydrogen** | `README.md`, `PROMPT_LOG.md` (no app code modified) | `26/26` Vitest tests (`28.2 ms` benchmark), `690 ms` build |
| **Sprint 6** | Round-1 #1 Polish & Zero-Friction Submission Hardening | **Gemini 4 Hydrogen** | `PromptLogModal.tsx`, `AuditPanel.tsx` banner, `index.html` favicon/meta, `package.json` `preview`, `.gitignore` | `26/26` Vitest tests, `0` TS errors, `connect-src 'none'` verified |
| **Sprint 7** | Adversarial Detector Hardening, Local Round-Trip Re-Hydration & Final Polish | **Gemini 4 Neon** | `detectors.ts`, `validators.ts`, `redactor.ts` (`rehydrateText`), `RehydrateModal.tsx`, `AuditPanel.tsx` KPI, `App.tsx` overlay | `31/31` Vitest tests (`38.2 ms` benchmark), `0` TS errors, `506 ms` build |

---

## Detailed Sprint Transcripts

### Sprint 1 — Pure TypeScript PII Engine & Mathematical Validators

- **Objective & Model Used:**
  Build a framework-agnostic, synchronous, deterministic PII detection, mathematical validation, span resolution, and redaction engine in `src/engine/` with zero React, DOM, storage, or network dependencies. Executed with **Gemini 4 Neon Orchestrator**.

- **Core Prompt Specification:**
  ```text
  Read AGENTS.md first. Implement the pure TypeScript engine under src/engine/:
  1. Architecture & Constraints:
     - Zero React/DOM/browser-storage/network imports inside src/engine/.
     - Strict TypeScript (strict: true, noUnusedLocals: true, noUnusedParameters: true, no any).
     - Offset Integrity invariant: every resolved DetectedEntity must satisfy
       text.slice(entity.start, entity.end) === entity.value and non-overlap
       entities[i - 1].end <= entities[i].start.
     - Synthetic-only test fixtures generated via generateValidLuhn() and generateValidVerhoeff12().
  2. Mathematical Validators (src/engine/validators.ts):
     - Luhn mod-10 checksum + card network detection (Visa, Mastercard, RuPay, Amex, Discover).
     - Full dihedral group D5 Verhoeff checksum (multiplication table d, permutation table p,
       inverse table inv) for 12-digit Aadhaar candidates, with toggleable strictVerhoeff.
     - Indian PAN structural validator ([A-Z]{5}[0-9]{4}[A-Z]) + 10 official 4th-character
       holder-type codes (P, C, H, F, A, T, B, L, J, G).
     - Strict IPv4 (0–255 octets, no leading-zero spoofing) and IPv6 validation.
  3. Detectors, Resolver & Redactor:
     - detectors.ts: Multi-entity extraction + rejectedCandidates logging for failed Luhn/Verhoeff decoys.
     - resolver.ts: O(n log n) deterministic non-overlapping span resolution
       (CREDIT_CARD > EMAIL > AADHAAR > IP_ADDRESS > PAN > PHONE, ties by longest match then earliest start).
     - redactor.ts: FULL (TYPED / GENERIC), PARTIAL, and canonically normalized PSEUDONYM modes
       with span whitelisting (makeSpanKey) and type toggles (enabledTypes).
     - samples.ts: 4 noisy presets (support_ticket, hr_resume, clinical_note, noisy_csv).
  4. Verification Gate:
     - Write comprehensive Vitest suite in src/engine/engine.test.ts including a 2,000-line
       performance benchmark (< 250 ms budget). Run pnpm typecheck && pnpm test.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `17/17` tests passing in `src/engine/engine.test.ts`.
  - Benchmark: 2,000-line / 155.2 KB noisy document processed well under the 250 ms budget with `0` overlapping spans.

- **Engineering Regressions Caught & Fixed:**
  - **Rejected Decoy Span Reservation:** Initial detector passes logged failed 16-digit Luhn and 12-digit Verhoeff candidates as rejected, but the `PHONE` regex still matched 10-digit substrings inside those rejected IDs. Updated `src/engine/detectors.ts` and `src/engine/resolver.ts` to reserve rejected decoy spans and filter overlapping phone candidates, eliminating substring false positives on failed Order/Tracking IDs.

---

### Sprint 2 — Core Workbench UI, Synced Diff Panes & Live Network Monitor

- **Objective & Model Used:**
  Construct the dark-mode React 19 + Tailwind CSS v4 workbench around `src/engine/` with synchronized dual-pane diffing, interactive audit controls, and runtime network-call telemetry. Executed with **Claude Sonnet 5.5**.

- **Core Prompt Specification:**
  ```text
  Read AGENTS.md and src/engine/index.ts. Build the client-side workbench UI:
  1. Immediate First-Impression Boot:
     - Boot straight into the `support_ticket` preset so judges see live entity detection,
       redaction diffs, rejected decoys, and KPIs immediately on load.
  2. TopBar & Live Network Monitor (src/utils/networkMonitor.ts, src/components/TopBar.tsx):
     - Instrument window.fetch and XMLHttpRequest.prototype.open at runtime.
     - Render live status pill: "100% Client-Side • 0 Network Calls".
     - Sample preset pills, .txt/.csv file upload, drag-and-drop overlay, and Clear action.
  3. ControlStrip & Synchronized DiffPanes (src/components/ControlStrip.tsx, DiffPanes.tsx):
     - Mode selector (FULL [Typed/Generic], PARTIAL, PSEUDONYM), Strict Verhoeff toggle,
       and per-entity-type filter pills with live counts.
     - Dual-pane Source (Inspect/Edit toggle) and Redacted Output with ratio-synchronized scrolling,
       click-to-whitelist spans, Copy to Clipboard, and Blob URL Download.
  4. AuditPanel (src/components/AuditPanel.tsx):
     - KPI cards (Entities Redacted, False Positives Blocked, Whitelisted Spans, Processing Time).
     - Tabs for Detected Entities, Rejected False Positives, and Pseudonym Map.
  5. Verification Gate:
     - Run pnpm typecheck && pnpm test && pnpm build.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `17/17` Vitest tests passing.
  - `pnpm build`: Clean Vite production bundle.

- **Engineering Regressions Caught & Fixed:**
  - **Edit-Mode Whitelist Invalidation:** Because `makeSpanKey` is offset-based (`start:end:type`), editing source text shifts character offsets. Added automatic whitelist reset (`setExcluded`) on manual text edits in `src/App.tsx` so stale offsets never whitelist unintended spans.

---

### Sprint 3 — RFC-4180 CSV Table View, Custom Terms & JSON Audit Export

- **Objective & Model Used:**
  Add zero-dependency RFC-4180 CSV parsing/serialization with a cell-by-cell `CSV Table View`, user-defined Custom Sensitive Terms (`CUSTOM`), and downloadable JSON Audit Reports. Executed with **Gemini 4 Hydrogen**.

- **Core Prompt Specification:**
  ```text
  Read AGENTS.md, src/engine/types.ts, src/App.tsx, and src/components/AuditPanel.tsx.
  1. RFC-4180 CSV Parser & Serializer (src/utils/csv.ts, src/components/CsvTableView.tsx):
     - Handle quoted commas, escaped "" quotes, CRLF/LF line endings, and multi-line quoted cells.
     - Preserve exact column counts on sanitized CSV export.
     - Add Raw Diff / CSV Table View switcher when a .csv file or noisy_csv sample is active.
  2. Custom Sensitive Terms (src/engine/customTerms.ts):
     - Support comma/newline-separated custom terms/codenames with case-insensitive word-boundary
       matching and CUSTOM priority = 0 (always yields to built-in PII entities).
  3. JSON Audit Report Export (src/components/AuditPanel.tsx):
     - Export structured compliance summary (DPDP, GDPR, PCI-DSS), countsByType,
       rejectedCandidates, and opt-in "Include Pseudonym Map" checkbox (default off for safety).
  4. Verification Gate:
     - Add Vitest coverage in src/utils/csv.test.ts and src/engine/engine.test.ts.
     - Run pnpm typecheck && pnpm test && pnpm build.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `26/26` Vitest tests passing (`21` in `src/engine/engine.test.ts`, `5` in `src/utils/csv.test.ts`).
  - `pnpm build`: Clean Vite production bundle.

- **Engineering Regressions Caught & Fixed:**
  - **Single Source of Truth for Pseudonyms:** Caught that `src/utils/output.ts` was recomputing pseudonym tokens independently in the UI layer, risking token drift between the Diff view, CSV Table view, Audit Panel, and downloaded files. Eliminated UI-side token recomputation so `src/engine/redactor.ts` (`entity.replacement` and `result.pseudonymMap`) is the single source of truth everywhere.

---

### Sprint 4 — Visual Polish, Click-to-Jump Cross-Highlighting & Production CSP

- **Objective & Model Used:**
  Add `HowItWorksModal`, centralized entity badge styling (`entityStyles.ts`), keyboard-accessible click-to-jump cross-highlighting between Audit rows and Diff panes, and a production Vite Content Security Policy plugin. Executed with **Claude Opus 5.5**.

- **Core Prompt Specification:**
  ```text
  1. Centralize entity badge styles and labels in src/components/entityStyles.ts.
  2. Add HowItWorksModal.tsx detailing the 5 mathematical/privacy guarantees (Esc & backdrop dismiss).
  3. Add click-to-jump cross-highlighting: clicking or pressing Enter/Space on an AuditPanel row
     switches to Diff Inspect view, smooth-scrolls both panes to [data-anchor], and pulses .vs-focus.
  4. Add productionCspPlugin() in vite.config.ts injecting:
     default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
     img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none';
  ```

- **Verification Gate Output:**
  - Interrupted mid-sprint by a model credit boundary, leaving partial edits requiring a forensic audit before proceeding.

---

### Sprint 4B — Post-Boundary Audit, `.vs-focus` Animation & CSP Entity Fix

- **Objective & Model Used:**
  Forensically audit every file touched in Sprint 4, repair incomplete edits, inspect the compiled `dist/index.html`, and pass the full verification gate. Executed with **Gemini 4 Hydrogen**.

- **Core Prompt Specification:**
  ```text
  Audit all files modified in Sprint 4 (src/index.css, vite.config.ts, src/App.tsx,
  src/components/DiffPanes.tsx, src/components/AuditPanel.tsx, src/components/HowItWorksModal.tsx).
  1. Verify no broken imports, orphaned classes, or half-finished handlers remain.
  2. Run pnpm typecheck && pnpm test && pnpm build.
  3. Inspect the generated dist/index.html CSP <meta> tag byte-for-byte.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `26/26` Vitest tests passing.
  - `pnpm build`: Clean Vite production bundle with verified CSP `<meta>` tag.

- **Engineering Regressions Caught & Fixed:**
  1. **Missing `.vs-focus` CSS Animation:** `App.tsx` and `DiffPanes.tsx` applied `.vs-focus` on click-to-jump, but `@keyframes vs-focus-pulse` had not been added to `src/index.css` before the Sprint 4 boundary. Implemented `@keyframes vs-focus-pulse` and `.vs-focus` (with `prefers-reduced-motion: reduce` support) in `src/index.css`.
  2. **HTML-Encoded Quotes in Production CSP:** Inspected `dist/index.html` and caught that `&#39;` HTML entities were emitted instead of literal single quotes in the CSP `<meta>` tag. Updated `productionCspPlugin()` in `vite.config.ts` to emit literal single quotes (`connect-src 'none'`).

---

### Sprint 5 — Judge-Ready Documentation (`README.md` & `PROMPT_LOG.md`)

- **Objective & Model Used:**
  Produce concise, codebase-verified `README.md` and `PROMPT_LOG.md` without modifying application or engine code. Executed with **Gemini 4 Hydrogen**.

- **Core Prompt Specification:**
  ```text
  Read AGENTS.md, package.json, vite.config.ts, and inspect src/ before writing.
  1. Write README.md with Problem & Privacy Guarantee, Mandatory Requirements Matrix,
     Engineering Differentiators, ASCII Architecture Diagram, Verified Benchmarks, and Quick Start.
  2. Write PROMPT_LOG.md summarizing the 5-sprint methodology, models, verification outputs,
     and caught regressions.
  3. Run pnpm typecheck && pnpm test && pnpm build and cite only observed numbers.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `26/26` Vitest tests passing (`28.2 ms` on 2,000-line / 155.2 KB benchmark).
  - `pnpm build`: Clean Vite production bundle in `690 ms`.

---

### Sprint 6 — Round-1 #1 Polish & Zero-Friction Submission Hardening

- **Objective & Model Used:**
  Eliminate every remaining friction point for Round-1 live-URL and repository judges: fix CLI script parity, add `.gitignore` and inline SVG favicon/metadata, bundle an in-app `Prompt Log` viewer modal, add a 1-click Verhoeff mode assist in `Rejected False Positives`, and upgrade `PROMPT_LOG.md` with full structured prompt transcripts. Executed with **Gemini 4 Hydrogen**.

- **Core Prompt Specification:**
  ```text
  Read AGENTS.md, package.json, index.html, README.md, PROMPT_LOG.md, TopBar.tsx, AuditPanel.tsx, App.tsx.
  1. Fix package.json scripts ("preview": "vite preview") & create .gitignore (node_modules/, dist/, .env*).
  2. Add inline SVG emerald shield data-URI favicon (CSP-safe) & meta description in index.html.
  3. Build PromptLogModal.tsx importing ../../PROMPT_LOG.md?raw at build time (zero network calls),
     with readable markdown rendering, Esc/backdrop dismiss, and 1-click Download PROMPT_LOG.md.
     Add Prompt Log button beside How It Works in TopBar.tsx.
  4. Add compact info banner in AuditPanel.tsx Rejected False Positives tab when strictVerhoeff is active
     and at least one 12-digit AADHAAR candidate was rejected, with 1-click "Switch to Pattern-Only Mode".
  5. Upgrade PROMPT_LOG.md with full structured prompt transcripts for Sprints 1–6.
  6. Run pnpm typecheck && pnpm test && pnpm build, verify pnpm preview, and verify literal
     connect-src 'none' in dist/index.html.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `26/26` Vitest tests passing across 2 test files.
  - `pnpm build`: Clean Vite production bundle with `connect-src 'none'` literal-quote CSP in `dist/index.html`.

- **Engineering Regressions Caught & Fixed:**
  - **`pnpm preview` Script & Missing `.gitignore` Audit:** `README.md` documented `pnpm preview` for local production verification, but `package.json` lacked the `"preview": "vite preview"` script and the repo lacked `.gitignore`. Added `"preview": "vite preview"` and a clean `.gitignore` so all documented commands and `git status` work out of the box.

---

### Sprint 7 — Adversarial Detector Hardening, Local Round-Trip Re-Hydration & Final Polish

- **Objective & Model Used:**
  Harden regex/validation recall against adversarial real-world inputs (dummy PANs, server-log `:port`/`/cidr` IPv4s, Amex `4-6-5`, Mastercard 2-series, plus-addressed emails, parenthesized international phones), add 100% client-side round-trip pseudonym re-hydration (`rehydrateText` + `RehydrateModal.tsx`), add the **Exposure Neutralized** KPI and full-viewport drag-drop overlay, and ensure `npm`/`pnpm` parity. Executed with **Gemini 4 Neon**.

- **Core Prompt Specification:**
  ```text
  Read AGENTS.md, package.json, src/engine/*, AuditPanel.tsx, App.tsx, README.md, PROMPT_LOG.md.
  1. Adversarial Detector Hardening (detectors.ts, validators.ts, types.ts):
     - PAN: Match \b[A-Z]{5}[0-9]{4}[A-Z]\b by default (strictPan?: boolean, default false)
       so dummy PANs like ABCDE1234F are detected ('PAN • Standard Format') while official
       4th-char codes retain rich badges ('PAN • Individual (P)', 'PAN • Company (C)', etc.).
     - IPv4: Detect bare IPs in 192.168.1.10:8080, 10.0.0.5/24, [192.168.1.10] intact without
       corrupting suffixes, while rejecting 1.2.3.4.5 and 999.1.1.1.
     - Cards & Contacts: Verify 15-digit Amex 4-6-5, Mastercard 2-series (2221–2720), compact
       16-digit cards, plus-addressed emails, and parenthesized international phones (+1 (415) 555-0199).
  2. Pure Client-Side Round-Trip Re-Hydration (redactor.ts + RehydrateModal.tsx):
     - Export rehydrateText(sanitizedText, pseudonymMap) -> { restoredText, replacementsCount }
       using single-pass longest-token-first matching with word-character boundary guards.
     - Build RehydrateModal.tsx supporting active session map, Audit JSON upload, 1-click
       "Use Current Sanitized Output", live preview, replacement count badge, and Copy Restored.
  3. UX Polish & Tests:
     - Add Exposure Neutralized KPI card and Re-Hydrate / Restore trigger in AuditPanel.tsx.
     - Add full-viewport file-only drag-and-drop overlay in App.tsx.
     - Add unit tests in engine.test.ts, update README.md & PROMPT_LOG.md, and run full gate.
  ```

- **Verification Gate Output:**
  - `pnpm typecheck`: `0` TypeScript errors.
  - `pnpm test`: `31/31` Vitest tests passing (`26` in `src/engine/engine.test.ts`, `5` in `src/utils/csv.test.ts`; 2,000-line / 155.2 KB benchmark in `38.2 ms`).
  - `pnpm build`: Clean Vite production bundle (`331.40 kB` JS, `46.81 kB` CSS) with literal `connect-src 'none'` CSP in `dist/index.html`.

- **Engineering Regressions Caught & Fixed:**
  1. **International Parenthesized Phone Truncation:** In `PHONE_REGEX`, `+1 (415) 555-0199` previously failed to match `+1 ` because the trailing digit quantifier `{7,12}\d` required 8+ digits *after* `(415) `. Updated the international branch to allow 6–11 trailing digits when preceded by an explicit parenthesized area code.
  2. **Boundary-Safe Token Re-Hydration:** `rehydrateText` sorts tokens longest-first and wraps alphanumeric token boundaries with `(?<![A-Za-z0-9_])` / `(?![A-Za-z0-9_])` in a single regex pass so short tokens (`EMAIL_1`) never corrupt longer tokens (`EMAIL_10`) and restored values are never re-scanned.
