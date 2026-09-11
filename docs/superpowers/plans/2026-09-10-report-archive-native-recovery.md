# Native Report Archive Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore complete saved reports through their original visual report surfaces, while retaining a compact readable fallback for legacy or incomplete archives.

**Architecture:** `ReportArchiveDetail` remains responsible for loading, deletion, report-linked Agent entry, and related sessions. It delegates saved payloads to `ArchivedReportView`, which selects a read-only renderer by report type. The first recovery slice gives Huangli and Tarot snapshot-specific views, retains the existing schema renderer for Bazi/Ziwei/Qimen, and guarantees safe legacy fallback formatting for pillar data.

**Tech Stack:** React 18, Vite 6, Node built-in test runner, jsdom test helper.

**Spec:** `docs/superpowers/specs/2026-09-10-report-archive-native-recovery-design.md`

## Global Constraints

- Historical views must render only the saved snapshot; they must not recompute, charge, save, or mutate the archive.
- Report-linked Agent entry always receives the current archive ID.
- Existing report deletion and related-session behavior remains owned by `ReportArchiveDetail`.
- Legacy/incomplete records use a compact fallback and must never coerce a structured pillar object to `[object Object]`.
- Preserve unrelated, currently dirty user changes.

---

### Task 1: Add recovery regression tests

**Files:**
- Modify: `src/components/tests/my-reports-page.test.mjs`

- [x] Add a complete Huangli snapshot case that expects the archive-native Huangli root and rejects raw Markdown heading output.
- [x] Add a complete Tarot snapshot case that expects its spread/card surface and its saved interpretation, rather than generic card chips.
- [x] Add a legacy chart case that expects formatted four pillars and rejects `[object Object]`.
- [x] Run the focused test file and confirm the new assertions fail before implementation.

### Task 2: Create read-only archive renderers

**Files:**
- Create: `src/components/ArchivedReportView.jsx`
- Modify: `src/components/TarotReading.jsx`
- Modify: `src/components/FusedHuangliCard.jsx`
- Modify: `src/components/MyReportsPage.jsx`

- [x] Export/reuse the Tarot revealed-card and reading presentation as a read-only archive renderer with no shuffle, re-draw, save, or charge controls.
- [x] Extend the Huangli card with a snapshot/history mode that consumes the saved result, hides mutable date controls, and never calls the generator.
- [x] Add a coordinator that selects schema, Huangli, Tarot, and fallback views from the saved report type and payload completeness.
- [x] Replace generic detail-body rendering with the coordinator while retaining Agent, session, delete, and back actions.
- [x] Run focused tests and make them pass.

### Task 3: Improve legacy fallback readability

**Files:**
- Modify: `src/components/MyReportsPage.jsx`
- Modify: `src/styles/global.css`

- [x] Format primitive/object pillar facts into `干支` or a safe textual form before rendering.
- [x] Give fallback records a deliberately compact archival layout so incomplete data is not mistaken for a full report.
- [x] Re-run focused tests.

### Task 4: Save recovery metadata for new records

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/SubscribePage.jsx`
- Modify: `src/components/TarotReading.jsx`

- [x] Attach minimal `report.archive` metadata to new Huangli and Tarot snapshots without changing server schema.
- [x] Ensure metadata contains only submitted input/UI context, not runtime or credential state.
- [x] Re-run archive adapter/component tests.

### Task 5: Verify the delivered surface

**Files:**
- Modify only if validation reveals a report-recovery defect.

- [x] Run the complete test suite with `npm test`.
- [x] Build the production bundle with `npm run build`.
- [x] Run `git diff --check`.
- [x] Manually open saved Huangli, Tarot, schema, and legacy chart records in the browser and check narrow mobile layout.
