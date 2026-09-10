# AIPER — Super-Phase Plan

---

## Super-Phase Overview

| SP | Name | Items | Goal |
|---|---|---|---|
| SP1 | MVP Delivery | F1, B6, B5, F12, F5, F10, F4, F9, F17, B2, B3 | Ship all platform-critical and client-visible features/bugs |
| SP2 | Core Stability | F14, F13, B1, F8, F15, F2, F18 | Eliminate remaining data integrity bugs, build the shared UI infrastructure (toasts, modals, error handling) |
| SP3 | UX Polish + Infrastructure | F7, F3, F6, B4, B7, C2, C3, C4, C5, C6 | UX improvements, performance chores, UI polish |
| SP4 | Documentation | F11 | Full project documentation in `.agents/` |
| SP5 | Future (Planned — No Start Date) | C1, C7 | DB schema revision, full UI revamp — only when explicitly planned |

---

## SP1 — MVP Delivery

### Phase Order

Dependencies within SP1 dictate this sequence:
- **F12 must precede F9** (F9 restructures the whole engine; tweaks first to set baseline)
- **F10 must precede F1** (F1 reuses the preserve-progress mechanism from F10)
- All other items are independent and ordered by blast radius (smallest changes first)

| Phase | ID | Title | Status |
|---|---|---|---|
| SP1.P1 | B6 | Hand Over / Receive Sample Modal Broken | ✅ Done |
| SP1.P2 | B2 | Timeline State Mismatch on RETURNED | ✅ Done |
| SP1.P3 | B3 | Deadline Lateness Indicator | ✅ Done |
| SP1.P4 | B5 | Retained Job Shows Stale ULR Preview | ✅ Done |
| SP1.P5 | F5 | Accidental Approve Safeguard | ✅ Done |
| SP1.P6 | F10 | Job Reassign Bug Fix | ✅ Done |
| SP1.P7 | F12 | Report Minor Tweaks | ✅ Done |
| SP1.P8 | F9 | New Addition of Special Group — Water 10500 | ⬜ Planned |
| SP1.P9 | F1 | Job Hold | ✅ Done |
| SP1.P10 | F4 | Multi-Job Dispatch | ⬜ Next |
| SP1.P11 | F17 | DB Export / Backup | ⬜ Planned |

---

### SP1.P1 — B6: Hand Over / Receive Sample Modal Broken

**File**: `frontend/src/pages/Head/TransferManagement.jsx`

**Root cause hypothesis**: The modal is positioned absolutely or fixed without a proper z-index/portal, causing it to overflow behind the job list.

| Subphase | Task |
|---|---|
| SP1.P1.1 | Open `TransferManagement.jsx` and locate both the "Hand Over Sample" and "Receive Sample" modal JSX blocks |
| SP1.P1.2 | Identify whether the modal renders inline (in-place) or via a portal. If inline, wrap the modal in a React Portal (`ReactDOM.createPortal`) mounting to `document.body` |
| SP1.P1.3 | Ensure modal overlay uses `position: fixed; inset: 0; z-index: 1000` and the modal box is centered via flexbox |
| SP1.P1.4 | Verify `overflow: hidden` on a parent is not clipping the modal |
| SP1.P1.5 | Test on mobile viewport — tap "Hand Over" and "Receive", confirm modal renders cleanly above all content |
| SP1.P1.6 | Confirm "Confirm" button still triggers the correct transfer action |

---

### SP1.P2 — B2: Timeline State Mismatch on RETURNED

**File**: `frontend/src/components/JobTimeline.jsx`

**Known state**: Line 87 — `RETURNED` falls into a branch, and lines 109–110 show `headApproval || instance.status === 'COMPLETED'` setting s4 to `completed`. If `headApproval` is a truthy object even on returned jobs, s4 incorrectly turns green.

| Subphase | Task |
|---|---|
| SP1.P2.1 | Read the full s4 logic block (lines ~79–114) in `JobTimeline.jsx` |
| SP1.P2.2 | Trace what `headApproval` contains on a `RETURNED` job — verify it is not a stale approval object from a prior review |
| SP1.P2.3 | Fix the s4 condition: `s4_status = 'completed'` must only be set if `dStatus === 'COMPLETED'` (full job), not merely if `headApproval` exists |
| SP1.P2.4 | On `RETURNED` status: explicitly force `s4_status = 'pending'` to override any stale headApproval check |
| SP1.P2.5 | Confirm `PENDING_HEAD_REVIEW` still renders s4 as `active` (clock icon) |
| SP1.P2.6 | Visually verify the full timeline across: DISPATCHED, RETURNED, PENDING_HEAD_REVIEW, COMPLETED |

---

### SP1.P3 — B3: Deadline Lateness Indicator

**Files**: `frontend/src/pages/AssistantDashboard.jsx` (display), `frontend/src/pages/Head/DispatcherPage.jsx` (input)

| Subphase | Task |
|---|---|
| SP1.P3.1 | Create a shared utility function `isOverdue(deadlineStr): boolean` that returns `new Date(deadlineStr) < new Date()` |
| SP1.P3.2 | In `AssistantDashboard.jsx` line ~477: wrap the deadline display — if `isOverdue(activeTask.deadline)`, render the timestamp in `var(--color-danger)` red with an "Overdue" badge next to it |
| SP1.P3.3 | In `AssistantDashboard.jsx` line ~682: apply the same overdue styling to the task list row deadline |
| SP1.P3.4 | In `DispatcherPage.jsx`: on the deadline date/time inputs, add an `onChange` validation — if the composed datetime string is in the past, show an inline warning: "This deadline has already passed" |
| SP1.P3.5 | Do NOT hard-block form submission for past deadlines (the head may intentionally set a tight deadline). Only warn. |
| SP1.P3.6 | Verify on mobile — badge must not overflow the card |

---

### SP1.P4 — B5: Retained Job Shows Stale ULR Preview

**File**: `frontend/src/pages/AdminOfficer/JobsPage.jsx`

**Root cause**: The `retainForm` block (lines 770–783) does not clear or re-fetch `ulrPreview`, so the stale value from the previous submission persists.

| Subphase | Task |
|---|---|
| SP1.P4.1 | In the `retainForm` block (around line 770), add `setUlrPreview("")` to clear the stale value immediately after submission |
| SP1.P4.2 | For NABL jobs: after clearing, show the text "ULR assigned upon test completion" in the ULR preview display field (not a fetched number) |
| SP1.P4.3 | For Non-NABL opt-in jobs: after clearing, show "Slot reserved on save" — do not fetch the next slot number as a live preview |
| SP1.P4.4 | Also clear `assignUlrToNonNabl`, `ulrEditMode`, `customUlrNumber`, and `ulrValidation` state in the retain block so no stale opt-in state carries over |
| SP1.P4.5 | Verify: create a NABL job, retain form, confirm ULR preview reads "ULR assigned upon completion" not a number |
| SP1.P4.6 | Verify: create a Non-NABL opt-in job, retain form, confirm ULR section is reset cleanly |

---

### SP1.P5 — F5: Accidental Approve Safeguard

**File**: `frontend/src/pages/Head/DispatcherPage.jsx`

| Subphase | Task |
|---|---|
| SP1.P5.1 | Locate the analyst-picker card state in `DispatcherPage.jsx` — the UI block that appears after "Approve" is clicked |
| SP1.P5.2 | Add a "Return to Officer" button styled as a secondary/ghost button at the top-right of the analyst-picker card state |
| SP1.P5.3 | On click: clear all pre-selected analysts for this job's card, and revert the card state back to its pre-approval view (clear any `approved`, `pickerOpen`, or equivalent local state for that job ID) |
| SP1.P5.4 | Ensure "Return to Officer" does NOT call any API — this is a pure frontend state revert |
| SP1.P5.5 | Socket: no socket events needed — nothing has been committed to the backend |
| SP1.P5.6 | Verify on mobile — the button must be tappable and not overlap the analyst picker dropdown |

---

### SP1.P6 — F10: Job Reassign Bug Fix

**Files**: Backend reassign routes, `TestInstance.js`

| Subphase | Task |
|---|---|
| SP1.P6.1 | Read and map the full reassign flow: find the route that handles "Head reassigns analyst" (likely in `testResultRoutes.js` or `testAssignmentRoutes.js`) |
| SP1.P6.2 | Locate exactly where `TestInstance` data is set/overwritten during a reassign. Identify if the route creates a new TestInstance or updates the existing one |
| SP1.P6.3 | If it creates a new TestInstance: change to update the existing one, preserving `results`, `method`, and `notes` fields. Only update `assignedTo` |
| SP1.P6.4 | If it updates in place: verify `results`, `method`, `notes` are not being cleared by a `$set` or `Object.assign` that overwrites them with empty values |
| SP1.P6.5 | Add a `reviewHistory` entry for the reassignment: `{ action: 'REASSIGN', by: req.user._id, note: 'Reassigned to [analyst name]', date: now }` |
| SP1.P6.6 | Frontend: verify that when analyst receives a reassigned job, previously saved values are visible in the input fields |
| SP1.P6.7 | Test edge case: reassign a job that has zero saved progress — must still work cleanly |

---

### SP1.P7 — F12: Report Minor Tweaks

**File**: `backend/services/reportGenerator.js`

| Subphase | Task |
|---|---|
| SP1.P7.1 | Locate the "Contact details" row builder in `reportGenerator.js` — find where contact person, phone, and email are composed into one string |
| SP1.P7.2 | Split into two separate table rows: `Contact Person:` → contact person name only; `Email:` → email only. Remove the merged row |
| SP1.P7.3 | Verify against the reference doc (`DRINKING WATER 1741 as per 10500.docx`) whether the phone number row appears separately or is dropped. Implement accordingly |
| SP1.P7.4 | Locate where authorized signatory names appear in the report footer/signature block |
| SP1.P7.5 | Check if names are hardcoded strings or pulled from User model. If hardcoded, update `Monika Pali` → `Ms. Monika Pali` and `Jyoti Pathak` → `Ms. Jyoti Pathak`. If from DB, add a `honorific` field or derive from gender |
| SP1.P7.6 | Generate a test report and visually verify both fixes match the reference doc |

---

### SP1.P8 — F9: New Addition of Special Group — Water 10500

**Files**: Backend parameter/group routes, Admin seed scripts, `reportGenerator.js`

> Similar to the pesticides panel grouping. This adds the IS 10500:2012 drinking water standard as a special parameter group with its full set of chemical, physical, and microbiological parameters. Analysis work (structural diff, font audit, python-docx extraction of target report format) is preserved in `/temp/report/`.

---

### SP1.P9 — F1: Job Hold

**Files**: `Job.js`, `JobsPage.jsx` (officer), `DispatcherPage.jsx`, `AssistantDashboard.jsx`, backend job routes

| Subphase | Task |
|---|---|
| SP1.P9.1 | **Model**: Add `ON_HOLD` to the `Job.js` status enum. Add an optional `holdReason` string field |
| SP1.P9.2 | **Backend — Hold route**: Create `POST /api/jobs/:id/hold`. Logic: set `job.status = 'ON_HOLD'`, clear `job.distribution.*.assignedHead` if not yet dispatched to analyst, record in `job.history` |
| SP1.P9.3 | **Backend — Recall from analysts**: If job was already dispatched, find all `TestInstance` documents for this job. Set their status to `HELD` (or equivalent). Do NOT clear `results`, `method`, or `notes` — preserve all progress |
| SP1.P9.4 | **Backend — ULR reservation decision**: If job has a `reservedUlrSlot` at hold time, **clear it**. The slot should not be held indefinitely. Document this in the route as a comment |
| SP1.P9.5 | **Backend — Unhold route**: Create `POST /api/jobs/:id/unhold`. Logic: set job status back to `PENDING_REVIEW` (back to officer/head queue). Emit socket event |
| SP1.P9.6 | **Socket events**: Emit `job:held` event on hold (with job ID). Head and analyst clients must listen and remove the job from their active views. Emit `job:unheld` on unhold |
| SP1.P9.7 | **Officer UI**: Add "Hold" button to the individual job card in `JobsPage.jsx`. Show only when job status is NOT already `ON_HOLD`, `COMPLETED`, or `CANCELLED`. Add a confirmation modal before triggering |
| SP1.P9.8 | **Officer UI — Held job state**: Show held jobs in the job list with a distinct "HELD" badge. Add "Release Hold" button on held job cards |
| SP1.P9.9 | **Head UI**: `DispatcherPage.jsx` — listen for `job:held` socket event and remove the job card from the dispatcher list in real-time |
| SP1.P9.10 | **Analyst UI**: `AssistantDashboard.jsx` — listen for `job:held` socket event and remove the affected task card. When job is later unheld and re-dispatched, prior saved progress is visible |
| SP1.P9.11 | **Test all stages**: hold a job at (a) officer stage, (b) head stage, (c) analyst stage. Verify correct recall behaviour at each |

---

### SP1.P10 — F4: Multi-Job Dispatch to Single Analyst

**Files**: `frontend/src/pages/Head/DispatcherPage.jsx`, backend dispatch route

| Subphase | Task |
|---|---|
| SP1.P10.1 | Add a checkbox (or long-press on mobile) to each dispatcher job card to toggle multi-select mode |
| SP1.P10.2 | When 2+ jobs are selected, show a sticky bottom action bar: "Dispatch X jobs to…" with an analyst picker dropdown |
| SP1.P10.3 | The analyst picker in the action bar should show only analysts from the relevant department(s) of the selected jobs |
| SP1.P10.4 | On confirm: call `POST /api/jobs/bulk-dispatch` (new endpoint) with `{ jobIds: [...], analystId, deadline }` |
| SP1.P10.5 | Backend: iterate `jobIds`, for each job approve and create/update `TestInstance` documents assigning all parameters to `analystId` |
| SP1.P10.6 | Emit individual `job:dispatched` socket events for each job (not one bulk event — keeps existing listeners working) |
| SP1.P10.7 | Frontend: clear selection, show success toast for each dispatched job, refresh job list |
| SP1.P10.8 | Edge case: if one job in the bulk fails (e.g. already dispatched), report a partial failure without rolling back successful ones |
| SP1.P10.9 | Verify on mobile — the bottom action bar must not obstruct the job list and must be easily dismissible |

---

### SP1.P11 — F17: DB Export / Backup

**Files**: New backend route, Admin UI

> A one-click export button for the admin to download a full backup of all MongoDB collections as a single archive.

| Subphase | Task |
|---|---|
| SP1.P11.1 | **Backend route**: Create `GET /api/admin/export` (admin-only). Use `mongoose.connection.db.listCollections()` to enumerate all collections, then `find({})` on each to dump all documents |
| SP1.P11.2 | **Format**: Output as a single `.json` file containing `{ collectionName: [documents...], ... }` for all collections. Stream the response with `Content-Disposition: attachment` header |
| SP1.P11.3 | **Filename**: Auto-generate as `aiper_backup_YYYY-MM-DD_HHmmss.json` |
| SP1.P11.4 | **Frontend button**: Add an "Export Database" button on the Admin dashboard. On click, trigger a download via the export endpoint |
| SP1.P11.5 | **Loading state**: Show a spinner/progress indicator while the export is being prepared (large DBs may take a few seconds) |
| SP1.P11.6 | **Authorization**: Ensure the route is strictly `protect + authorize('ADMIN')` |
| SP1.P11.7 | **Test**: Export from `local_db`, verify all collections are present and documents match count |

---

## SP2–SP4 Overview (Detail to be planned after SP1 is complete)

### SP2 — Core Stability
| Phase | ID | Title |
|---|---|---|
| SP2.P1 | F14 | Cross-Analyst Reassign Duplication Bug |
| SP2.P2 | B1 | ULR Preview Staleness (Concurrent Jobs) |
| SP2.P3 | F8 | Toast System Overhaul |
| SP2.P4 | F15 | Global Modal Daemon |
| SP2.P5 | F13 | Analyst Reassignment Tracking |
| SP2.P6 | F2 | Head Pages — Search, Filter & Sort |
| SP2.P7 | F16 | Hide Test Code Suffixes in UI |
| SP2.P8 | F18 | Error Handling & Modal Overhaul (Bonus) |

### SP3 — UX Polish + Infrastructure
| Phase | ID | Title |
|---|---|---|
| SP3.P1 | B4 | Analyst Task Modal Visibility (Narrow) |
| SP3.P2 | B7 | Cancellation Modal Sentence Rework |
| SP3.P3 | C2 | Clean Up `/temp` |
| SP3.P4 | C3 | HTTP Compression Middleware |
| SP3.P5 | C4 | MongoDB Connection Pool Tuning |
| SP3.P6 | C5 | Scope 50mb JSON Body Limit |
| SP3.P7 | C6 | Socket.IO Auth Scope |
| SP3.P8 | F7 | Dashboard History Revamp |
| SP3.P9 | F3 | Transfer List Rework |
| SP3.P10 | F6 | Job Grouping in Officer's Page |

### SP4 — Documentation
| Phase | ID | Title |
|---|---|---|
| SP4.P1 | F11 | Comprehensive Documentation |

### SP5 — Planned for Future
| Phase | ID | Title | Note |
|---|---|---|---|
| — | C1 | DB Schema Revision | Dedicated sprint only |
| — | C7 | Full UI Revamp | Only after feature freeze |
