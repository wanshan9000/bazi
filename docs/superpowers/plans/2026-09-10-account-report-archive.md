# Account Report Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every signed-in user one “我的报告” archive where all completed test reports can be saved, restored, consulted through 元气 AI, and deleted without deleting the underlying chat history.

**Architecture:** Add a dedicated JSON-backed `report_archives.json` store with account-scoped CRUD and one-time legacy migration, exposed through authenticated report routes. The React app will normalize report results into a stable archive draft, persist them after generation, present one unified report manager inside the profile area, and pass `reportId` into Agent sessions so the server can record the association.

**Tech Stack:** Node.js 20, Express 5, JSON atomic-file persistence, React 18, Vite 6, Node’s built-in test runner, jsdom test helpers.

**Spec:** `docs/superpowers/specs/2026-09-10-account-report-archive-design.md`

## Global Constraints

- All report APIs require a valid Bearer token and must derive identity from `req.uid`; never accept client-supplied user IDs.
- Store full result only in `GET /api/reports/:id`; report listing returns summaries, counts, and linked-session counts only.
- Preserve report data indefinitely until the user deletes that report or deletes their account.
- Deleting a report removes its archive and report-to-session association only; it must not delete AI session messages.
- The initial migration only consumes explicitly whitelisted fields from `sanmen-history` and `sanmen-tarot-history`, and claims each account only once.
- Support types: `bazi`, `ziwei`, `qimen`, `huangli`, `tarot`, `chenggu`, `name`, `fengshui`, `horoscope`, and `chart`.
- A user can keep at most 120 report archives; a single archive request payload must remain below 240 KB.
- Follow existing JSON temporary-file + rename persistence semantics; do not alter unrelated user changes or make commits.

---

### Task 1: Add account-scoped report archive persistence

**Files:**
- Create: `server/reportArchive.js`
- Create: `server/tests/report-archive.test.mjs`
- Modify: `server/config.js`

**Interfaces:**
- Produces `createReportArchiveStore(file, { sessionStore? })` with `saveReport`, `listReports`, `getReport`, `deleteReport`, `appendSession`, `migrateLegacy`, and `deleteAllReports`.
- Produces `sharedReportArchive()` using `config.reports.file`.

- [x] **Step 1: Write failing persistence tests**

```js
const archive = createReportArchiveStore(file)
const saved = archive.saveReport('u-a', { type: 'bazi', title: '八字报告', summary: '甲木日主', report: { chart: {} } })
assert.equal(archive.listReports('u-a').reports[0].id, saved.id)
assert.equal(archive.getReport('u-b', saved.id), null)
assert.equal(archive.deleteReport('u-a', saved.id), true)
```

Add cases for invalid type, report size, 120-item limit, session association ownership, one-time legacy migration plus content fingerprint dedupe, and `deleteAllReports`.

- [x] **Step 2: Run the new test file and verify it fails because the module does not exist**

Run: `node --test server/tests/report-archive.test.mjs`

- [x] **Step 3: Implement the minimal JSON store**

Use `randomUUID`, schema validation, per-user filtering, `report_archives.json.tmp-<pid>` then rename persistence, and a restricted summary projection that excludes `report`.

- [x] **Step 4: Add the configured report archive file path**

Add `config.reports.file`, defaulting to `server/data/report_archives.json`, with `REPORT_ARCHIVE_FILE` as its environment override.

- [x] **Step 5: Re-run the persistence tests**

Run: `node --test server/tests/report-archive.test.mjs`

Expected: PASS.

### Task 2: Expose authenticated report archive APIs and account-cleanup integration

**Files:**
- Create: `server/routes/reports.js`
- Create: `server/tests/report-route.test.mjs`
- Modify: `server/index.js`
- Modify: `server/routes/auth.js` only if a composed cleanup callback is required

**Interfaces:**
- Produces `createReportsRouter({ archives, accounts, sessions })` with list, detail, save, migration, attach-session, and delete endpoints.
- Consumes `requireAuth`, `createReportArchiveStore`, `createAgentStore`.

- [x] **Step 1: Write failing route tests**

```js
const created = await fetch(`${base}/api/reports`, { method: 'POST', headers: bearer(a.token), body: JSON.stringify(draft) })
assert.equal(created.status, 201)
assert.equal((await fetch(`${base}/api/reports/${id}`, { headers: bearer(b.token) })).status, 404)
assert.equal((await fetch(`${base}/api/reports/${id}`, { method: 'DELETE', headers: bearer(a.token) })).status, 200)
assert.equal(sessionStore.getSession(a.id, sessionId).id, sessionId)
```

Include unauthenticated `401`, oversized `413/400`, migration idempotency, forged session rejection, and account-deletion cleanup.

- [x] **Step 2: Run the route tests and verify they fail because the route module does not exist**

Run: `node --test server/tests/report-route.test.mjs`

- [x] **Step 3: Implement the route module**

Use `requireAuth(accounts)` and only `req.uid`. Validate `type` query values, use 404 for an inaccessible report or session, and return compact user-facing messages.

- [x] **Step 4: Register routes and compose deletion cleanup**

Create one shared archive instance in `server/index.js`, mount `/api` reports routes, and change `onRemoveUser` to remove both report archives and AI sessions.

- [x] **Step 5: Re-run route and existing account/agent tests**

Run: `node --test server/tests/report-route.test.mjs server/tests/auth-route.test.mjs server/tests/agent-route.test.mjs`

Expected: PASS.

### Task 3: Add frontend archive API and safe archive-draft adapters

**Files:**
- Create: `src/api/reports.js`
- Create: `src/engine/reportArchive.js`
- Create: `src/engine/tests/report-archive.test.mjs`
- Create: `src/api/tests/reports.test.mjs`

**Interfaces:**
- Produces `createReportApi()` with `list`, `get`, `save`, `migrate`, `linkSession`, and `remove`.
- Produces `createArchiveDraft({ type, result, chart, title, summary, createdAt })` and `legacyArchiveDrafts()`.
- Draft output has `{ clientKey, type, title, summary, report, chart, facts, createdAt }` and excludes unknown local-storage data.

- [ ] **Step 1: Write failing draft adapter tests**

```js
const draft = createArchiveDraft({ type: 'tarot', result: reading })
assert.equal(draft.type, 'tarot')
assert.ok(draft.summary.length <= 180)
assert.deepEqual(Object.keys(draft.chart || {}), ['year', 'month', 'day', 'hour', 'gender'])
```

Add an assertion that legacy data only reads known keys and that identical legacy records produce matching client keys.

- [ ] **Step 2: Run archive engine tests and verify they fail**

Run: `node --import ./src/test/setup.mjs --test src/engine/tests/report-archive.test.mjs src/api/tests/reports.test.mjs`

- [ ] **Step 3: Implement client APIs and archive normalization**

Use the existing auth-header conventions. Keep page-specific result snapshots JSON-safe and compact; never send raw `localStorage` objects.

- [ ] **Step 4: Re-run frontend archive tests**

Run: `node --import ./src/test/setup.mjs --test src/engine/tests/report-archive.test.mjs src/api/tests/reports.test.mjs`

Expected: PASS.

### Task 4: Build the unified “我的报告” manager and report-detail recovery view

**Files:**
- Create: `src/components/MyReportsPage.jsx`
- Create: `src/components/tests/my-reports-page.test.mjs`
- Modify: `src/components/ProfilePage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- `MyReportsPage({ user, onBack, onOpenReport, onAskAgent, onOpenSession })` loads account reports and exposes filter choices “全部 / 命盘 / 塔罗 / 黄历 / 其他”.
- `App` adds `reports` and `report-detail` hash views and owns selected archive id/detail state.

- [ ] **Step 1: Write failing UI tests**

```js
const r = render(MyReportsPage, { user, onBack() {}, onOpenReport: id => opened = id })
await flush()
assert.ok(r.findByText('我的报告'))
r.click(r.findByText('塔罗'))
assert.ok(r.text().includes('单卡直答'))
```

Add delete confirmation coverage and an empty-state case that makes clear reports appear after completed tests.

- [ ] **Step 2: Run the component test and verify it fails because the component does not exist**

Run: `node --import ./src/test/setup.mjs --test src/components/tests/my-reports-page.test.mjs`

- [ ] **Step 3: Implement the profile entry and manager**

Replace “命盘记录 / 塔罗足迹” with one clickable “我的报告” card, list every archive type, and restore an archive into a read-only `ReportView`-compatible detail screen. The detail view offers “咨询元气 AI”, “查看关联会话”, “删除报告”, and “返回我的报告”.

- [ ] **Step 4: Add responsive styling**

Keep tabs horizontally scrollable on narrow phones; make report cards content-height and make destructive actions visually secondary.

- [ ] **Step 5: Re-run the component test and existing profile tests**

Run: `node --import ./src/test/setup.mjs --test src/components/tests/my-reports-page.test.mjs src/components/tests/auth-flow.test.mjs`

Expected: PASS.

### Task 5: Save completed reports and connect report-originated Agent sessions

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/BaziPage.jsx`
- Modify: `src/components/ZiweiPage.jsx`
- Modify: `src/components/QimenPage.jsx`
- Modify: `src/components/SubscribePage.jsx`
- Modify: `src/components/TarotReading.jsx`
- Modify: `src/components/ChengguPage.jsx`
- Modify: `src/components/NamePage.jsx`
- Modify: `src/components/FengshuiPage.jsx`
- Modify: `src/components/HoroscopePage.jsx`
- Modify: `src/components/AgentChatDsh.jsx`
- Modify: `src/api/agent.js`
- Create: `src/components/tests/report-archive-flow.test.mjs`
- Modify: `server/routes/agent.js`
- Modify: `server/tests/agent-route.test.mjs`

**Interfaces:**
- Result pages call `onReportReady(createArchiveDraft(...))` only after a complete result exists.
- `openReportAgent({ chart, prompt, reportId })` seeds the chat with its archive ID.
- `streamChat({ ..., reportId })` sends `reportId`; after the server creates or verifies the session it associates it with the report.

- [ ] **Step 1: Write failing integration tests**

```js
assert.ok(reportCalls.some(call => call.path === '/api/reports' && call.body.type === 'bazi'))
assert.equal(linkCall.body.sessionId, createdSessionId)
assert.equal((await api.list()).counts.tarot, 1)
```

Add a server test proving a session for another account cannot be linked through a valid report ID.

- [ ] **Step 2: Run focused report-flow and agent tests; confirm new cases fail**

Run: `node --import ./src/test/setup.mjs --test src/components/tests/report-archive-flow.test.mjs && node --test server/tests/agent-route.test.mjs`

- [ ] **Step 3: Implement automatic save with client-side de-duplication**

Keep an App-level map from `clientKey` to archive ID for the active account. A failed save must leave the report visible and expose a one-time retry message, never block reading.

- [ ] **Step 4: Implement report-to-session association**

Only attempt it after receiving the server-created session event. If linking fails, preserve the chat and show no false “linked” state.

- [ ] **Step 5: Migrate legacy browser histories on successful login**

Call `reports.migrate(legacyArchiveDrafts())` once after guest-session claiming. Keep local history as offline fallback.

- [ ] **Step 6: Re-run focused integration tests**

Run: `node --import ./src/test/setup.mjs --test src/components/tests/report-archive-flow.test.mjs && node --test server/tests/agent-route.test.mjs`

Expected: PASS.

### Task 6: Validate the full feature and check the delivered surface

**Files:**
- Modify only if a test exposes a defect in the preceding tasks.

- [ ] **Step 1: Run all report archive, component, and server tests**

Run: `npm test`

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

- [ ] **Step 3: Check patch integrity**

Run: `git diff --check`

- [ ] **Step 4: Manually verify the essential paths**

Log in, complete a report, open “我的报告”, restore it, start a report consultation, confirm the linked conversation appears, delete the report, and confirm the conversation remains in “会话历史”.
