# Architecture & Code Quality TODO
> Based on debugging sessions from Aug 17–18, 2026

---

## 1. Extract Shared Filter Logic into Utils

**Why**: The `filterActiveHeadJobs` pattern (filtering by `user.department`) was copy-pasted across 3 files independently — `DispatcherPage.jsx`, `ReviewQueuePage.jsx`, `HeadStats.jsx`. When the bug hit, it needed to be fixed in 3 places. A shared utility would've been one fix.

**What to do**:
- Create `frontend/src/utils/jobFilters.js`
- Move department-based filter functions there
- Import them in all Head pages

---

## 2. Add Source Maps to Production Build

**Why**: The crash stack trace in prod logs showed `index-032lcRNk.js:65:113751` — completely unreadable. Had to cross-reference the source manually to find the exact crash line. Source maps would've given the exact file + line instantly.

**What to do**:
- Enable source map upload to Railway (or a service like Sentry)
- Or at minimum: configure Vite to generate source maps and serve them privately
- Even a self-hosted Sentry instance on Railway would transform future debugging

---

## 3. Add `useCallback` / Memoization to Heavy Filter Functions

**Why**: `filterActiveHeadJobs` is re-created on every render inside `DispatcherPage`. Fine now, but as the jobs list grows this becomes expensive.

**What to do**:
- Wrap `filterActiveHeadJobs` in `useCallback` with `[user]` dependency
- Same for any other inline filter/sort functions in large list pages

---

## 4. Add Loading Guards to All Action Buttons (existing TODO)

> See [`TODO-button-loading-guards.md`](file:///home/archani/Projects/AIPER/TODO-button-loading-guards.md)

**Why**: Double-clicks fire duplicate API requests. Backend guards catch them correctly but the user sees a confusing error toast. Confirmed recurring pattern via logs for at least 4 jobs.

**What to do**:
- Create a `useActionGuard` hook
- Apply across all ~20 PUT/POST/DELETE button handlers

---

## 5. Normalize `user` Null-Safety at the Source

**Why**: The `user` from `AuthContext` can be `null` if `localStorage.user` is missing (old session predating the key being stored). Today's crash was `user._id` without optional chaining — we patched 4 instances reactively. The underlying risk is that any new dev can write `user.anything` and it'll work in their browser (fresh login) but crash for stale-session users.

**What to do** (pick one or both):
- **Option A — Defensive AuthContext**: In `AuthContext`, if `token` exists but `localStorage.user` is missing/null, force a logout instead of silently setting `user = null`. This eliminates the null state entirely.
  ```js
  // In AuthContext useEffect:
  if (!storedUser) {
    localStorage.removeItem('token');
    setUser(null);
    setLoading(false);
    return;
  }
  ```
- **Option B — ESLint rule**: Add an ESLint rule or custom lint that warns on `user.` without `user?.` in components that pull from `AuthContext`

Option A is simpler and solves it at the root.

---

## 6. Centralize Axios Error Handling

**Why**: Every action button does its own `catch (err) { alert(err.response?.data?.message || "Error") }`. This means error presentation is inconsistent and any change to how errors are shown requires touching every file.

**What to do**:
- Create an Axios interceptor that handles common error cases (401 → logout, 429 → rate limit toast, 5xx → generic error)
- Use a toast library instead of `alert()` for non-blocking UX

---

## 7. Consider a `useHeadJobs` Custom Hook

**Why**: `DispatcherPage` is 1130 lines. The job fetching, filtering, socket updates, and infinite scroll logic is all co-located making it hard to navigate and test.

**What to do**:
- Extract job-fetching + socket update logic into `hooks/useHeadJobs.js`
- The component then just handles rendering
- Target: get `DispatcherPage` under ~600 lines

---

## Priority Order (suggested)

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Fix `AuthContext` null user (Option A) | 15 min | 🔴 High — eliminates crash class |
| 2 | Source maps / Sentry | 1–2 hrs | 🔴 High — transforms future debugging |
| 3 | Button loading guards | 2–3 hrs | 🟡 Medium — UX polish |
| 4 | Extract shared filter utils | 1 hr | 🟡 Medium — maintainability |
| 5 | Axios error interceptor | 1–2 hrs | 🟡 Medium — consistency |
| 6 | `useCallback` memoization | 30 min | 🟢 Low — premature until scale |
| 7 | `useHeadJobs` hook refactor | 3–4 hrs | 🟢 Low — nice to have |
