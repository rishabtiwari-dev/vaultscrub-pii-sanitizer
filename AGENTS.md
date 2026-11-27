# VaultScrub — Engineering & Architecture Guide

## Overview
**VaultScrub** is a 100% client-side, zero-network browser PII detection, mathematical validation, and data sanitization web application.

## Tech Stack
- **Build Tool**: Vite
- **UI Framework**: React 19 + TypeScript (`strict: true`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Icons**: Lucide React
- **Testing**: Vitest
- **Package Manager**: `pnpm`

## Strict Zero-Network Privacy Constraint
- **Zero outbound network requests**: Never add `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, external API calls, third-party analytics/telemetry, external font links, or external CDN scripts.
- **Local in-memory processing only**: All PII detection, checksum validation (Luhn, Verhoeff), overlap resolution, and redaction must execute synchronously and deterministically in browser memory.
- **Synthetic test & sample data**: Never hardcode real personal identifiers, cards, or government IDs. All demo presets and test fixtures must be generated programmatically using `generateValidLuhn` and `generateValidVerhoeff12`.

## Folder Structure
- `src/engine/` — Pure, framework-agnostic TypeScript PII engine (no React, DOM, or browser storage imports):
  - `types.ts` — Core entity, validation, redaction, and result interfaces (`EntityType`, `RedactionMode`, `DetectedEntity`, `RejectedCandidate`, `RedactionOptions`, `SanitizationResult`, `makeSpanKey`).
  - `validators.ts` — Luhn, card network detection, dihedral $D_5$ Verhoeff checksum, PAN holder type decoder, strict IPv4/IPv6 validators, and synthetic valid ID generators.
  - `detectors.ts` — Multi-entity regex/rule detectors, canonical normalization, and rejected-candidate logging.
  - `resolver.ts` — Deterministic non-overlapping span resolver (`CREDIT_CARD > EMAIL > AADHAAR > IP_ADDRESS > PAN > PHONE`, ties broken by longest match then earliest start).
  - `redactor.ts` — `FULL`, `PARTIAL`, and normalized `PSEUDONYM` sanitization with span whitelisting (`excludedSpanKeys`) and type toggles (`enabledTypes`).
  - `samples.ts` — Programmatically generated noisy presets (`support_ticket`, `hr_resume`, `clinical_note`, `noisy_csv`).
  - `engine.test.ts` — Vitest unit test suite covering validators, detectors, span resolution, redaction modes, normalization, whitelisting, and sample presets.
  - `index.ts` — Clean barrel exports for the engine.
- `src/components/` — React UI components (Sprint 2+).

## Coding Standards
- **Strict TypeScript**: Keep `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Avoid `any`.
- **Offset Integrity**: Every resolved `DetectedEntity` must satisfy `text.slice(entity.start, entity.end) === entity.value` and non-overlap `entities[i - 1].end <= entities[i].start`.
- **Whitelist Keys**: Always use `makeSpanKey(entity)` (`${start}:${end}:${type}`) when referencing span exclusions.
- **Pseudonym Mapping**: `pseudonymMap` maps deterministic placeholder tokens (e.g., `EMAIL_01`, `CARD_01`) to their canonical normalized original values so format variations map to the exact same placeholder.
- **Pure Engine Boundary**: Keep `src/engine/` 100% pure TypeScript so it runs identically in Node (Vitest) and the browser.
