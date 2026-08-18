# TODO: Add Loading Guards to All Action Buttons

> **Priority**: Medium — prevents confusing error toasts from double-clicks (confirmed recurring issue via logs for user Monika Pali).

## Problem

Action buttons across the app fire `axios.put/post/delete` inline without disabling themselves during the request. Double-clicks send duplicate requests — the first succeeds, the second hits a backend guard and shows a scary error to the user.

## Scope (~20+ files)

### PUT handlers (mutating actions)
- `DispatcherPage.jsx` — approve-review, assign-analyst, etc.
- `ReviewQueuePage.jsx`
- `TransferManagement.jsx`
- `AssistantsPage.jsx`
- `JobsPage.jsx`
- `UsersPage.jsx`
- `AssistantDashboard.jsx`
- `SerialSettings.jsx`
- `GroupSettings.jsx`
- `NotificationsPage.jsx`
- `Header.jsx`
- `NotificationBell.jsx`
- `CascadingParameterSelector.jsx`

### POST handlers (create/submit actions)
- `JobsPage.jsx`
- `BugReportPage.jsx`
- `ReportModal.jsx`
- `AdminDashboard.jsx`

### DELETE handlers
- `UsersPage.jsx`
- `GroupSettings.jsx`
- `AssistantsPage.jsx`
- `AssistantDashboard.jsx`

## Suggested Approach

Create a reusable `useActionGuard` hook:

```javascript
// hooks/useActionGuard.js
export function useActionGuard() {
  const [activeAction, setActiveAction] = useState(null);

  const guard = useCallback(async (actionId, fn) => {
    if (activeAction) return;
    setActiveAction(actionId);
    try {
      await fn();
    } finally {
      setActiveAction(null);
    }
  }, [activeAction]);

  const isActive = useCallback((actionId) => activeAction === actionId, [activeAction]);

  return { guard, isActive };
}
```

Then in each component:
```jsx
const { guard, isActive } = useActionGuard();

<button
  onClick={() => guard(`approve-${job._id}`, async () => {
    await axios.put(...);
    fetchJobs();
  })}
  disabled={isActive(`approve-${job._id}`)}
>
```

## Estimated Effort

~2-3 hours to do it properly across all files with testing.
