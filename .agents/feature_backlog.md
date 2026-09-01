# [AIPER] Feature Backlog — Aug 24, 2026

> **Status**: Recorded, not yet planned or implemented.
> **Cross-cutting rule**: ALL changes must prioritize **mobile responsiveness** above desktop. Desktop is used by only 1–2 roles; other roles depend entirely on mobile.
> **Protected concerns**: Do NOT break (1) file layout & architecture, and (2) existing optimizations & caching (fetchWithCache, AbortController, etc.)

---

## ULR Architecture Note (as of Aug 30 commit `66e2e9c`)

ULR assignment is now **deferred** — it is no longer assigned at job creation time. Instead it is assigned by `attemptUlrAssignment()` in `ulrService.js` at the moment the Head approves the final test result, once all required departments have completed (`isJobFullyTested()`). Two paths exist:

- **NABL auto-assign**: counter increments at approval time (`getNextUlr()`).
- **Non-NABL opt-in**: a slot is reserved at form submission (`reservedUlrSlot` + `reservedUlrYear` on the Job), and the actual ULR string is built and finalized at approval time.

Any UI text, bug description, or feature that assumed "ULR is assigned at job creation" is now stale and must be updated to reflect this deferred model.

---

## Execution Order (Priority-First)

Items sorted by **business priority first**, dependencies respected.

| Order | ID | Title | Priority |
|---|---|---|---|
| 1 | F9 | Report Generation Overhaul | CRITICAL |
| 2 | F1 | Job Hold | High |
| 3 | B6 | Hand Over / Receive Sample Modal Broken | Critical Bug |
| 4 | B5 | Retained Job Shows Stale ULR Preview | Medium Bug |
| 5 | F12 | Report Minor Tweaks | High (compliance) |
| 6 | F5 | Accidental Approve Safeguard | Medium |
| 7 | F10 | Job Reassign Bug Fix | High Bug |
| 8 | F4 | Multi-Job Dispatch | Medium |
| 9 | B2 | Timeline State Mismatch on RETURNED | High Bug |
| 10 | B3 | Deadline Lateness Indicator | Medium |
| 11 | F14 | Cross-Analyst Reassign Duplication | Critical Bug |
| 12 | F13 | Analyst Reassignment Tracking | Medium |
| 13 | F15 | Global Modal Daemon | Medium |
| 14 | F8 | Toast System Overhaul | High |
| 15 | F7 | Dashboard History Revamp | Medium |
| 16 | F2 | Search Bar on Head's Pages | Medium |
| 17 | F3 | Transfer List Rework | Medium |
| 18 | F6 | Job Grouping in Officer's Page | Medium-High |
| 19 | B1 | ULR Preview Staleness (Concurrent Jobs) | High Bug |
| 20 | B4 | Analyst Task Modal Visibility (Narrow) | Medium UX |
| 21 | B7 | Cancellation Modal — Sentence Rework | Low |
| 22 | C2 | Clean Up `/temp` | Trivial Chore |
| 23 | C3 | Add HTTP Compression Middleware | Trivial Chore |
| 24 | C4 | Tune MongoDB Connection Pool | Trivial Chore |
| 25 | C5 | Scope 50mb JSON Body Limit | Low Chore |
| 26 | C6 | Scope Socket.IO to Auth Users | Low Chore |
| 27 | F11 | Comprehensive Documentation | Ongoing |

---

## Planned for Future (Scope Risk — Do Not Start Without a Dedicated Sprint)

| ID | Title | Why Deferred |
|---|---|---|
| C1 | DB Schema Revision | Can scale into a full migration. Time-box risk is extremely high. Plan a dedicated sprint. |
| C7 | Full UI Revamp | Must wait for full feature freeze. Starting during active feature work causes double rework. |

---

## Features

### F9 — Report Generation Overhaul
**Priority**: CRITICAL
**Depends on**: F12 (small fixes first to establish a clean baseline before restructuring the engine)
**Files likely affected**: `backend/services/reportGenerator.js`, `ReportModal.jsx`, `exportRoutes.js`

**Description**:
The current report output does not match the required NABL-compliant format. Reference document: **"DRINKING WATER 1741 as per 10500.docx"** located in `/temp`.
- Priority: **Download/generation quality first** (pixel-perfect DOCX/PDF output matching the reference).
- Report viewer (in-browser preview) is secondary but must also be worked on.
- This is considered the **most critical feature** of the entire platform. Quality must be exceptional.

**Inline code notes**: Two `NOTE` comments exist in the report pipeline:
- `reportGenerator.js:88` — "TEST RESULT title only appears on the first page" (intentional layout constraint, not a bug)
- `exportRoutes.js:69` — "We intentionally do NOT append orphaned TestInstance results" (design decision, verify this still holds after F9 restructure)

---

### F1 — Job Hold
**Priority**: High
**Depends on**: F10 (shares the "preserve analyst progress" mechanism)
**Files likely affected**: `JobsPage.jsx` (officer), `DispatcherPage.jsx`, `AssistantDashboard.jsx`, job routes (backend), `Job.js` model

**Description**:
Admin Officer can place a job on "Hold" in response to a client request. When held:
- The job is **recalled from Head's dispatcher** and from **analysts** if already dispatched.
- Any **saved analyst progress** (results, method, notes) must be **preserved** — similar to how reassignment works. Analysts see their past work when the job is re-sent to them later.
- If **parameters change** after a hold, the relevant saved data should be cleared/flagged for those parameters only.
- A "Hold" button should appear on the **individual job cards** in the Admin Officer's distributor page.

**Concerns**:
- Must gracefully handle jobs in all stages: newly created, at head, dispatched to analyst, partially completed.
- May need a new job status (e.g. `ON_HOLD`) in `Job.js`.
- Socket events must notify heads and analysts when a hold is placed.
- **ULR note**: If a Non-NABL job has a `reservedUlrSlot` and is placed on hold, decide whether the reservation is cleared or preserved. Document this clearly.

---

### F12 — Report Minor Tweaks
**Priority**: High (accuracy/compliance)
**Depends on**: — (do before F9 to establish a clean baseline)
**Files likely affected**: `backend/services/reportGenerator.js`, `exportRoutes.js`

**Description**:
Two specific fixes observed from comparing actual report outputs vs. expected:

1. **"Contact Details" field split into two rows**
   - **Current output** (wrong): Single row labeled `Contact details:` containing contact person name, phone number, and email all merged.
   - **Expected output** (correct): Two separate labeled rows:
     - `Contact Person:` → contact person name only
     - `Email:` → email address only
   - Phone number: verify whether it's dropped or moved per the reference doc.

2. **"Ms." prefix missing from authorized signatory names**
   - The signature section currently shows `Monika Pali` without an honorific.
   - Must become `Ms. Monika Pali`.
   - Also check **Jyoti Pathak** — likely the same issue.
   - Verify: is this pulled from the User model or hardcoded in the report template?

---

### F5 — Accidental Approve Safeguard (Head)
**Priority**: Medium
**Depends on**: —
**Files likely affected**: `DispatcherPage.jsx`

**Description**:
Currently, when Head clicks "Approve," the card transitions to an analyst-picker state with no way back.
Fix: Add a **"Return to Officer"** button on the analyst-picker state so the Head can undo the approval. Any pre-selected analysts should be discarded on return.

---

### F10 — Job Reassign Bug Fix
**Priority**: High (Bug)
**Depends on**: —
**Files likely affected**: TestInstance routes, `DispatcherPage.jsx`, reassign backend logic

**Description**:
**Bug reported by client**: When a job is reassigned to a different analyst, the previously saved data (test methods, result values, etc.) is being wiped — this should NOT happen. Saved progress must be preserved and shown to the new analyst.

**Note**: Review the relevant backend routes and `TestInstance.js` handling before touching anything.

> **Must be done before F1 and F13** — F1's "preserve progress on hold" logic is the same mechanism. F13 adds visibility on top of the reassign history, so the underlying data must be correct first.

---

### F4 — Multi-Job Dispatch to Single Analyst
**Priority**: Medium
**Depends on**: F3 (both touch `DispatcherPage.jsx` heavily — safer to finalize F3's layout first)
**Files likely affected**: `DispatcherPage.jsx`, relevant backend job route

**Description**:
Allow Head to **select multiple jobs** and dispatch all of them to a **single selected analyst** in one action. All parameters in each selected job would be assigned to that analyst. Requires multi-select UI on the dispatcher cards and a bulk-assign action.

---

### F14 — Cross-Analyst Reassign Duplication Bug
**Priority**: CRITICAL (Bug)
**Depends on**: — (Investigate alongside F10)
**Files likely affected**: `reviewRoutes.js` / `jobRoutes.js`, `TestInstance.js`, `Job.js`, Analyst Dashboard frontend

**Description**:
When the Head reviews an analyst's submission and reassigns specific parameters to a *different* analyst, the system breaks job consolidation and status tracking.

**Scenario**:
- Job has 6 params. Head assigns 3 to Analyst A, 3 to Analyst B.
- B submits their 3 params.
- Head reassigns 2 back to B, and sends 1 to A.
- **Expected**: B sees the same job with 2 params left. A sees the same job, now with 4 params (3 original + 1 reassigned).
- **Actual Bug**: B sees that 1 parameter as "Approved" (wrong state). A sees a completely *new/duplicate* job card (e.g. `JobCode-v2`) containing just that 1 parameter, fragmenting the job UI.

**Note**: This reveals a fundamental flaw in how `TestInstance` assignment updates are handled when crossing analyst boundaries. Parameters must append to existing analyst assignments rather than cloning job views.

---

### F13 — Analyst Reassignment History Tracking
**Priority**: Medium
**Depends on**: F10, F14 (reassign bugs must be fixed and data must be reliable before surfacing it in UI)
**Files likely affected**: `DispatcherPage.jsx`, `JobsPage.jsx` (officer), `TestInstance.js`, possibly a new job detail/timeline component

**Description**:
Heads and Admin Officers need an efficient way to see and track **which analysts were assigned or reassigned** to a specific job over time.

**What to show**:
- Per-job timeline of analyst assignments: who was assigned, when, and who reassigned them
- Visible to both **Head** and **Admin Officer** roles
- `TestInstance.reviewHistory` already stores `REASSIGN` entries with actor, date, and note — data likely exists, work is mainly surfacing it cleanly

**Possible UI approaches**:
- A collapsible "Assignment History" section within the job's detail/expand card
- A dedicated timeline view on the job modal

---

### F15 — Global Modal Daemon
**Priority**: Medium
**Depends on**: F8 (align with the toast system so both daemons share a consistent UX)
**Files likely affected**: New global modal component/hook, `App.jsx` or root layout

**Description**:
A global, singleton modal system — the modal equivalent of the toast daemon (F8). Instead of each page/component managing its own `useState` for "show modal", any part of the app can imperatively trigger a modal via a shared context or hook.

**Use cases**:
- Confirmation dialogs (approve, hold, cancel job)
- Destructive action warnings
- Info modals triggered by socket events

**Mechanics** (modelled after F8 toast daemon):
- Single `<ModalDaemon />` mounted once at app root
- All modals queue through a single context (`useModal()`)
- Supports: title, body content, confirm/cancel actions, severity levels
- Supports modal stacking or blocking (second modal waits until first resolves)
- Must not conflict with any existing inline modal patterns

---

### F8 — Toast System Overhaul (Global Toast Daemon)
**Priority**: High
**Depends on**: —
**Files likely affected**: New global toast component/hook, `App.jsx` or root layout, all notification trigger points, existing in-page toasts

**Description**:
Build a unified, global **toast daemon** that handles ALL types of notifications:
- Toasts **slide in/out** with animation
- Each toast auto-dismisses after **5 seconds**
- Multiple toasts **stack** vertically
- If stack reaches screen bottom → **queue** remaining toasts to show after current ones dismiss
- Must **merge with existing toasts** — nothing is lost, everything routes through this single system
- Must not conflict with existing inline feedback patterns

---

### F7 — Dashboard History Revamp (All 3 Roles)
**Priority**: Medium
**Depends on**: F8 (dashboard revamp should use the new toast system for any feedback)
**Files likely affected**: Admin dashboard, Admin Officer dashboard, Head dashboard components; `SystemLog.js` (backend)

**Description**:
Two problems to fix on dashboard history/recent activity panels:
1. **Job codes are shown incorrectly** — must display the correct formatted job code (e.g., `2608071714` format, not raw internal IDs like `2608211741-2b`).
2. **Recent Activity content is wrong** — currently shows a plain list of IDs. Must show real, meaningful activity entries such as:
   - "Job dispatched to [Analyst Name]"
   - "Analyst submitted results for Job #XXXX"
   - "Job approved by Head"

---

### F2 — Search Bar on Head's Pages
**Priority**: Medium
**Depends on**: —
**Files likely affected**: `DispatcherPage.jsx`, `ReviewQueuePage.jsx`

**Description**:
Add a search bar to:
- Head's **Dispatcher Page**
- Head's **Review Queue Page**

Should support fuzzy search (fuse.js is already in the stack) on job code, client name, sample serial, etc.

---

### F3 — Transfer List Rework on Dispatcher Page
**Priority**: Medium
**Depends on**: —
**Files likely affected**: `DispatcherPage.jsx`, `TransferManagement.jsx`

**Description**:
The sample transfers section within Head's Dispatcher page can grow into a very long list. Needs a rework to handle large volumes gracefully — possibly pagination, collapsing, or a dedicated sub-section within the page.

---

### F6 — Job Grouping in Officer's Distributor Page
**Priority**: Medium-High
**Depends on**: —
**Files likely affected**: `JobsPage.jsx` (Admin Officer), possibly a new local-state or backend storage for group config

**Description**:
Allow officers to create **named folder/accordion groups** and place jobs into them:
- Select jobs → create a named group/folder (accordion UI)
- Can freely rename groups
- Can remove jobs from a group (back to ungrouped) or add more jobs
- Pure **UI-only feature** — does not affect job data or status
- Groups must persist (at minimum per-session, ideally per-user in DB or localStorage)

**Concerns**:
- How does **infinite scroll** interact with groups? Feasibility idea: lazy loading on accordion open.
- **Activity Logs page**: NO grouping allowed there, that page remains unchanged.

---

### F11 — Comprehensive Documentation
**Priority**: Medium (ongoing)
**Depends on**: All features above
**Files likely affected**: New docs in `.agents/` directory

**Description**:
Full project documentation to be written and stored in `.agents/`. Divided into three levels:
1. **High-Level Docs**: Features as a whole, what they do and why.
2. **Low-Level Docs**: Deep-dive into each feature — code structure, logic, data flows, model shapes.
3. **History/Purpose Docs**: Journey of how and why features were implemented, including git log references.

---

## Bugs

### B6 — Hand Over Sample Modal Broken (Micro Head) / Receive Modal Broken (Chemical Head)
**Priority**: Critical (Blocks sample transfer workflow)
**Depends on**: —
**Files likely affected**: Sample transfer modal component(s), possibly `SampleTransferRoutes.js`

**Description**:
The "Hand Over Sample" confirmation modal for the Micro Head is rendering incorrectly — the modal content overlaps the job list below it and the layout is broken. Tapping Confirm may still work functionally, but the UI is unusable visually.

Similarly, the "Receive Sample" modal for the Chemical Head is also broken.

This blocks the physical sample handover workflow for sequential (dual-department) jobs entirely.

---

### B5 — Retained Job Form Data Shows Stale ULR Preview After Submission
**Priority**: Medium
**Depends on**: —
**Files likely affected**: `JobsPage.jsx` or `JobForm.jsx` form reset logic

**Description**:
After successfully creating a job, if the form is populated by retaining the previous job's data ("retain" feature), the ULR preview still shows the old job's preview even though a ULR is **not actually assigned at creation time anymore** (deferred model, see architecture note above). The display is misleading.

**Fix direction**: When the form is reset/retained after a successful submission, the ULR preview state must be cleared entirely. For Non-NABL opt-in, show "Slot reserved on save" after submit rather than carrying forward a stale slot number. For NABL jobs, show "ULR will be assigned upon completion."

---

### B2 — Timeline State Mismatch: Head Stage Shows Green on RETURNED
**Priority**: High (Confusing to users)
**Depends on**: —
**Files likely affected**: `frontend/src/components/JobTimeline.jsx`

**Description**:
In the job timeline, the "Dept Head Review" stage (s4) incorrectly turns **green** when a job is in the `RETURNED` state (Head has sent it back to the analyst). It should remain grey (pending), since the Head has not approved the job.

Only `COMPLETED` status should show s4 as green. `PENDING_HEAD_REVIEW` should show s4 as active (clock icon). All other states including `RETURNED` should show s4 as grey.

---

### B3 — No Lateness Indication for Passed Deadlines
**Priority**: Medium
**Depends on**: —
**Files likely affected**: Analyst task modal component, any deadline display component

**Description**:
When a deadline has already passed by the time it is viewed, there is no visual indicator that it is overdue. The deadline is displayed as-is with no urgency styling.

Also, there is no validation at the *setting* stage to prevent entering a deadline in the past.

**Fix direction**:
1. On deadline display: if `deadline < now`, show the timestamp in red with an "Overdue" or "Late" badge.
2. On deadline input: add a client-side check that the selected datetime is in the future, show an inline warning if not.

---

### B1 — ULR Preview Staleness on Concurrent Jobs
**Priority**: High (Data Integrity)
**Depends on**: —
**Files likely affected**: `JobForm.jsx` or `JobsPage.jsx` (ULR preview fetch), `jobListRoutes.js`

**Description**:
When creating a NABL or Non-NABL opt-in job, the form fetches and displays a preview of the next ULR slot. However, since ULR is now **deferred**, what is shown is a *reservation preview* — not a guaranteed assignment. If another job completes and gets approved in between, the counter may shift.

**Fix direction**: Update the preview label to clearly say "Estimated slot — actual ULR assigned on test completion" (NABL) or "Slot reserved on save" (Non-NABL opt-in). Remove any language implying the ULR is final at form submission.

---

### B4 — Analyst Task Modal: Input Invisible in Shrunken Window
**Priority**: Medium (UX)
**Depends on**: —
**Files likely affected**: Analyst test submission modal component

**Description**:
When the browser window is shrunk horizontally (narrow viewport), the "Observed Result" input field in the analyst's test parameter entry modal becomes invisible or too small to see what is being typed. The label and unit suffix overlap the input field.

**Fix direction**: Ensure the input row uses a responsive flex/grid layout that stacks vertically on narrow viewports. The number input, unit label, and suffix should each have proper `min-width` and wrap gracefully.

---

### B7 — Cancellation Modal — Sentence Rework
**Priority**: Low
**Depends on**: —
**Files likely affected**: Job cancellation confirmation modal component

**Description**:
The cancellation confirmation modal currently contains a sentence along the lines of: *"The job code will be permanently bound to this cancelled job and the serial number sequence will be maintained."*

Two problems with this:
1. It contains an **em dash (—)**, which must be removed per the project-wide no-em-dash rule.
2. The sentence is **factually wrong** given the deferred ULR model. A ULR is no longer bound to the job at creation — it is only assigned upon test completion approval. If a job is cancelled before that point, no ULR is ever assigned to it.

**Fix direction**: Rewrite the sentence to simply warn the user that cancellation is permanent and the job code cannot be reused, without making any claim about ULR or serial number sequences.

---

## Chores

### C2 — Clean Up `/temp` Directory
**Complexity**: Trivial
**Depends on**: —
**Description**:
Remove useless/stale scripts from `/home/archani/Projects/AIPER/temp`. Review each file and delete those no longer needed.

---

### C3 — Add HTTP Compression Middleware
**Complexity**: Trivial
**Depends on**: —
**Files affected**: `backend/server.js`, `backend/package.json`
**Description**:
Install the `compression` npm package and add `app.use(compression())` before the route middlewares. This will gzip all JSON responses > 1kb automatically. Typical reduction is **60–80%** on large job list responses — critical for mobile users on slower connections. Zero risk change.

---

### C4 — Tune MongoDB Connection Pool Size
**Complexity**: Trivial
**Depends on**: —
**Files affected**: `backend/server.js`
**Description**:
`mongoose.connect()` currently uses the default pool of **5 connections**. Increase `maxPoolSize` to `20` and add `serverSelectionTimeoutMS` + `socketTimeoutMS` guards to prevent silent hangs on DB hiccups.

---

### C5 — Scope the 50mb JSON Body Limit
**Complexity**: Low
**Depends on**: —
**Files affected**: `backend/server.js`, `backend/routes/exportRoutes.js`
**Description**:
Currently `express.json({ limit: '50mb' })` is applied **globally**. Drop the global limit to `2mb` and only apply the `50mb` limit to the specific `/api/export` route that handles docx blobs. Verify no other route sends large payloads first.

---

### C6 — Socket.IO: Scope Connections to Authenticated Users Only
**Complexity**: Low
**Depends on**: —
**Files affected**: `backend/server.js`, `frontend/src/context/SocketContext.jsx`
**Description**:
`SocketProvider` is mounted unconditionally at app root in `main.jsx` — even before login. The socket connects on app load regardless of auth state.

**Fixes**:
1. Move socket initialization inside `SocketContext` to only connect **after** `user` is available (tie to `AuthContext`).
2. Disconnect the socket on logout.
3. Remove or gate the `console.log` on connect/disconnect from `server.js`.
4. Consider adding Socket.IO auth middleware on the server to reject unauthenticated upgrade requests.

**Note**: The current architecture (one singleton `SocketProvider` wrapping the app) is correct — all 8 components consuming `useSocket()` share the **same single connection**. Only the pre-auth connection and noisy logging are problems.

---

## Inline TODO Report (as of Sep 1, 2026)

Scanned all `.js` and `.jsx` source files (excluding `node_modules` and `temp`). Found **2 noteworthy inline comments**, both in the report pipeline:

| File | Line | Comment | Action |
|---|---|---|---|
| `backend/services/reportGenerator.js` | 88 | `// NOTE: TEST RESULT title only appears on the first page` | Intentional layout constraint. Verify this is still the desired behavior during F9. |
| `backend/routes/exportRoutes.js` | 69 | `// NOTE: We intentionally do NOT append orphaned TestInstance results here.` | Intentional design decision. Re-verify this holds after F14 (cross-analyst reassign fix) is done. |

No `TODO`, `FIXME`, or `HACK` markers found in project source code. Codebase is clean.

---

## Cross-Cutting Requirements

| Requirement | Detail |
|---|---|
| Mobile First | ALL changes must prioritize mobile layout. Roles relying on mobile must not have degraded UX. |
| Architecture Safety | Do not restructure file layout unless explicitly planned and reviewed. |
| Caching Safety | Do not break `fetchWithCache`, `invalidateCache`, `AbortController` patterns. Cache keys must be updated wherever new data is fetched. |
| Socket Safety | New features that change job state must emit and listen to appropriate socket events. |
| ULR Safety | Never assume ULR is assigned at job creation. All ULR-related UI must reflect the deferred assignment model. |
