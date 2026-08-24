# [AIPER] Feature Backlog — Aug 24, 2026

> **Status**: Recorded, not yet planned or implemented.  
> **Cross-cutting rule**: ALL changes must prioritize **mobile responsiveness** above desktop. Desktop is used by only 1–2 roles; other roles depend entirely on mobile.  
> **Protected concerns**: Do NOT break (1) file layout & architecture, and (2) existing optimizations & caching (fetchWithCache, AbortController, etc.)

---

## Features

### F1 — Job Hold
**Priority**: High  
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

---

### F2 — Search Bar on Head's Pages
**Priority**: Medium  
**Files likely affected**: `DispatcherPage.jsx`, `ReviewQueuePage.jsx`

**Description**:  
Add a search bar to:
- Head's **Dispatcher Page**
- Head's **Review Queue Page**

Should support fuzzy search (fuse.js is already in the stack) on job code, client name, sample serial, etc.

---

### F3 — Transfer List Rework on Dispatcher Page
**Priority**: Medium  
**Files likely affected**: `DispatcherPage.jsx`, `TransferManagement.jsx`

**Description**:  
The sample transfers section within Head's Dispatcher page can grow into a very long list. Needs a rework to handle large volumes gracefully — possibly pagination, collapsing, or a dedicated sub-section within the page.

---

### F4 — Multi-Job Dispatch to Single Analyst
**Priority**: Medium  
**Files likely affected**: `DispatcherPage.jsx`, relevant backend job route

**Description**:  
Allow Head to **select multiple jobs** and dispatch all of them to a **single selected analyst** in one action. All parameters in each selected job would be assigned to that analyst. Requires multi-select UI on the dispatcher cards and a bulk-assign action.

---

### F5 — Accidental Approve Safeguard (Head)
**Priority**: Medium  
**Files likely affected**: `DispatcherPage.jsx`

**Description**:  
Currently, when Head clicks "Approve," the card transitions to an analyst-picker state. If this was accidental, there is no way back.  
Fix: Add a **"Return to Officer"** button on the analyst-picker state of the card so the Head can undo the approval, even after clicking Approve. Any pre-selected analysts should be discarded on return.

---

### F6 — Job Grouping in Officer's Distributor Page
**Priority**: Medium-High  
**Files likely affected**: `JobsPage.jsx` (Admin Officer), possibly a new local-state or backend storage for group config

**Description**:  
Admin Officer has a very long job list (see attached image). Allow officers to create **named folder/accordion groups** and place jobs into them:
- Select jobs → create a named group/folder (accordion UI)
- Can freely rename groups
- Can remove jobs from a group (back to ungrouped) or add more jobs
- Pure **UI-only feature** — does not affect job data or status in any way
- Groups must persist (at minimum per-session, ideally per-user in DB or localStorage)

**Concerns / Open Question**:
- How does **infinite scroll** interact with groups? Feasibility idea: don't pre-load jobs inside closed groups; load on demand when accordion is opened (lazy loading). Needs feasibility analysis before implementation.
- **Activity Logs page**: NO grouping allowed there, that page remains unchanged.

---

### F7 — Dashboard History Revamp (All 3 Roles)
**Priority**: Medium  
**Files likely affected**: Admin dashboard, Admin Officer dashboard, Head dashboard components; `SystemLog.js` (backend)

**Description**:  
Two problems to fix on dashboard history/recent activity panels (see attached image 2):
1. **Job codes are shown incorrectly** — must map and display the correct formatted job code (e.g., `2608071714` format, not raw internal IDs like `2608211741-2b`).
2. **Recent Activity content is wrong** — currently shows a plain list of IDs. Must show real, meaningful activity entries such as:
   - "Job dispatched to [Analyst Name]"
   - "Analyst submitted results for Job #XXXX"
   - "Job approved by Head"
   - etc.

---

### F8 — Toast System Overhaul (Global Toast Daemon)
**Priority**: High  
**Files likely affected**: New global toast component/hook, `App.jsx` or root layout, all notification trigger points, existing in-page toasts

**Description**:  
Build a unified, global **toast daemon** that handles ALL types of notifications (submissions, approvals, WebSocket push notifications, errors, etc.):
- Toasts **slide in/out** with animation
- Each toast auto-dismisses after **5 seconds**
- Multiple toasts **stack** vertically
- If stack reaches screen bottom → **queue** remaining toasts to show after current ones dismiss
- Must **merge with existing toasts** (save/submit feedback toasts) — nothing is lost, everything routes through this single system
- Must not conflict with existing inline feedback patterns

---

### F9 — Report Generation Overhaul
**Priority**: CRITICAL  
**Files likely affected**: Report generation service (backend), `ReportModal.jsx`, export routes, `exportRoutes.js`; sample report in `/temp` is the reference

**Description**:  
The current report output does not match the required NABL-compliant format. Reference document: **"Water 10500 Formate"** located in `/temp`.  
- Priority: **Download/generation quality first** (pixel-perfect DOCX/PDF output matching the reference).
- Report viewer (in-browser preview) is secondary but must also be worked on.
- This is considered the **most critical feature** of the entire platform. Quality must be exceptional.

---

### F10 — Job Reassign Bug Fix
**Priority**: High (Bug)  
**Files likely affected**: TestInstance routes, `DispatcherPage.jsx`, reassign backend logic

**Description**:  
**Bug reported by client**: When a job is reassigned to a different analyst, the previously saved data (test methods, result values, etc.) is being wiped — this should NOT happen. Saved progress should be preserved and shown to the new analyst (same as the intended behavior described in F1).

**Note**: Developer needs a refresher on the existing reassign implementation before fixing. Must review the relevant backend routes and `TestInstance.js` handling before touching anything.

---

### F11 — Comprehensive Documentation
**Priority**: Medium (ongoing)  
**Files likely affected**: New docs in `.agents/` directory

**Description**:  
Full project documentation to be written and stored in `.agents/`. Divided into three levels:
1. **High-Level Docs**: Features as a whole, what they do and why.
2. **Low-Level Docs**: Deep-dive into each feature — code structure, logic, data flows, model shapes.
3. **History/Purpose Docs**: Journey of how and why features were implemented, including git log references.

---

### F12 — Report Minor Tweaks
**Priority**: High (accuracy/compliance)  
**Files likely affected**: Report generation service (backend), `exportRoutes.js` or relevant docx builder

**Description**:  
Two specific fixes observed from comparing actual report outputs vs. expected:

1. **"Contact Details" field split into two rows**  
   - **Current output** (wrong): Single row labeled `Contact details:` containing contact person name, phone number, and email all merged together (e.g., `Ms. Babli Namdev 9893648426 amarmotiagro@gmail.com`).  
   - **Expected output** (correct): Two separate labeled rows:  
     - `Contact Person:` → contact person name only  
     - `Email:` → email address only  
   - Phone number row not shown separately in the reference — verify whether it's dropped or moved.

2. **"Ms." prefix missing from authorized signatory names**  
   - The signature section at the bottom currently shows `Monika Pali` without an honorific.  
   - Must become `Ms. Monika Pali`.  
   - Also check **Jyoti Pathak** — likely the same issue (suspected to be hardcoded in the docx builder).  
   - Verify whether these names are pulled from the DB (User model) or are hardcoded strings in the report template; fix at the source.

---

## Chores

### C1 — DB Schema Revision (Understanding Phase)
**Description**:  
Developer wants to understand and then potentially revise the current database schemas. This is a **planning/understanding task** first (no code changes). Cover:
- All current Mongoose models and their relationships
- Pain points or inefficiencies in current schema
- Proposed revisions (to be done as a separate task after review)

---

### C2 — Clean Up `/temp` Directory
**Description**:  
Remove useless/stale scripts from `/home/archani/Projects/AIPER/temp`. Review each file and delete those no longer needed.

---

### C3 — Add HTTP Compression Middleware
**Files affected**: `backend/server.js`, `backend/package.json`  
**Description**:  
Install the `compression` npm package and add `app.use(compression())` before the route middlewares. This will gzip all JSON responses > 1kb automatically. Typical reduction is **60–80%** on large job list responses — critical for mobile users on slower connections. Zero risk change.

---

### C4 — Tune MongoDB Connection Pool Size
**Files affected**: `backend/server.js`  
**Description**:  
`mongoose.connect()` currently uses the default pool of **5 connections**. With concurrent users (heads, analysts, officers) hitting the API simultaneously, requests queue behind these 5 slots. Increase `maxPoolSize` to `20` and add `serverSelectionTimeoutMS` + `socketTimeoutMS` guards to prevent silent hangs on DB hiccups.

---

### C5 — Scope the 50mb JSON Body Limit
**Files affected**: `backend/server.js`, `backend/routes/exportRoutes.js`  
**Description**:  
Currently `express.json({ limit: '50mb' })` is applied **globally** — every request, including simple GETs, can allocate 50MB of RAM. This must be scoped: drop the global limit to `2mb` and only apply the `50mb` limit to the specific `/api/export` route that actually handles docx blobs. Requires verifying that no other route sends large payloads first.

---

### C6 — Socket.IO: Scope Connections to Authenticated Users Only
**Files affected**: `backend/server.js`, `frontend/src/context/SocketContext.jsx`  
**Description**:  
**Issue identified**: `SocketProvider` is mounted unconditionally at app root in `main.jsx` — even before login. The socket connects on app load regardless of auth state, and the server logs every connect/disconnect to stdout (`console.log`). Additionally, the socket is initialized without auth handshaking, meaning unauthenticated clients can hold open connections.

**Fixes**:
1. Move socket initialization inside `SocketContext` to only connect **after** `user` is available (tie it to `AuthContext`).
2. Disconnect the socket on logout.
3. Remove the `console.log` on connect/disconnect from `server.js` (or gate it behind `DEBUG` env var) — currently logs to Railway stdout on every tab open/close.
4. Consider adding Socket.IO auth middleware on the server to reject unauthenticated upgrade requests entirely.

**Note**: The current architecture (one singleton `SocketProvider` wrapping the app) is actually correct and healthy — all 8 components consuming `useSocket()` share the **same single connection**. This is not connection overuse. The only real issue is the pre-auth connection and the noisy logging.

---

## Cross-Cutting Requirements

| Requirement | Detail |
|---|---|
| 📱 **Mobile First** | ALL changes must prioritize mobile layout. Roles relying on mobile must not have degraded UX. |
| 🏗️ **Architecture Safety** | Do not restructure file layout unless explicitly planned and reviewed. |
| ⚡ **Caching Safety** | Do not break `fetchWithCache`, `invalidateCache`, `AbortController` patterns. Cache keys must be updated wherever new data is fetched. |
| 🔌 **Socket Safety** | New features that change job state must emit and listen to appropriate socket events. |
