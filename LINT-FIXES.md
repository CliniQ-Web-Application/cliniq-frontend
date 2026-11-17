# ESLint errors and fixes

`npm run lint` initially reported **17 problems (14 errors, 3 warnings)**. All are now resolved; `npm run lint` exits with code 0 and no output.

## Summary

| Rule | Count | Files | Fix |
| --- | --- | --- | --- |
| `react-hooks/set-state-in-effect` | 9 | `AdminShell.tsx`, `Header.tsx`, `CheckInQr.tsx`, `patient/check-in/page.tsx` | Deferred loader calls with `queueMicrotask`; replaced effect-synced state with derived values / optimistic overrides |
| `react/no-unescaped-entities` | 3 | `staff/page.tsx`, `Header.tsx` | Replaced raw apostrophes in JSX text with `&apos;` |
| `react-hooks/refs` | 1 | `CheckInQrScanner.tsx` | Moved ref assignment out of render into an effect |
| `@typescript-eslint/no-unused-vars` | 2 warnings | `AdminShell.tsx` | Deleted unused prototype component and unused `refreshing` state |
| `react-hooks/exhaustive-deps` | 1 warning | `CheckInQrScanner.tsx` | Captured `videoRef.current` in a local variable for cleanup |

## Errors

### 1. `react-hooks/set-state-in-effect` — `AdminShell.tsx` (6 occurrences)

**Lines:** 285, 393, 491, 605, 709 (data loaders) and 496, 610 (form sync).

The effects called `loadAnalytics()`, `loadQueue()`, `loadStaff()`, `loadDepartments()` and `loadAudit()` directly. Those callbacks set state synchronously before their first `await`, which React flags as a cascading render. Two more effects copied `selected.staffRole` / `selected.name` etc. into form state.

**Fix:**
- Wrapped loader calls in `queueMicrotask(() => { void loadX(); })`. This matches the pattern already used elsewhere in the codebase and moves the state update out of the effect body.
- Replaced the two form-sync effects with derived values plus a keyed optimistic override (`staffForm` / `departmentForm`). The form now follows the selected row automatically, and user edits are kept without an effect:

```tsx
const selectedRole = staffForm?.staffId === selectedId
  ? staffForm.role
  : (selected?.staffRole ?? "");
```

### 2. `react-hooks/set-state-in-effect` — `components/Header.tsx:59`

Availability was copied from `profile.availabilityStatus` into local state in an effect.

**Fix:** derived the value and kept a nullable override only for the optimistic toggle (with rollback on error):

```tsx
const [availabilityOverride, setAvailabilityOverride] = useState<boolean | null>(null);
const available = availabilityOverride
  ?? (String(profile?.availabilityStatus ?? "").toUpperCase() === "AVAILABLE");
```

The now-unused `useEffect` import was removed.

### 3. `react-hooks/set-state-in-effect` — `app/patient/check-in/page.tsx:81`

The QR-generation effect set `qrImage` / `qrLoading` synchronously.

**Fix:** deferred both resets with `queueMicrotask` and guarded them with the existing `cancelled` flag, so state only updates after the effect body completes.

### 4. `react-hooks/set-state-in-effect` — `components/booking/CheckInQr.tsx:23`

Opening the modal reset `loading`, `error` and `src` inside the effect.

**Fix:** moved those resets into the button's `onClick` handler. The effect now only owns the controller, the async fetch and object-URL cleanup.

### 5. `react/no-unescaped-entities` (3 errors)

- `app/staff/page.tsx:258` and `:276` — `Today's appointments`
- `components/Header.tsx:285` — `department's waiting queue`

**Fix:** escaped the apostrophes as `Today&apos;s` and `department&apos;s`.

### 6. `react-hooks/refs` — `components/staff/CheckInQrScanner.tsx:28`

`callbackRef.current = onDetected` ran during render, which React warns can produce stale values.

**Fix:** moved the assignment into its own effect declared before the camera effect:

```tsx
useEffect(() => {
  callbackRef.current = onDetected;
}, [onDetected]);
```

### 7. Warning: unused `LegacyAnalyticsPage` — `AdminShell.tsx:180`

A leftover prototype analytics view (hard-coded demo data) was defined but never rendered. **Fix:** removed the function; the live `AnalyticsPage` is unchanged.

### 8. Warning: unused `refreshing` — `AdminShell.tsx:451`

The staff-management page declared `refreshing` state but never displayed it. **Fix:** removed the state and its two setters (the queue page still uses its own `refreshing` value).

### 9. Warning: `react-hooks/exhaustive-deps` — `CheckInQrScanner.tsx:95`

The cleanup read `videoRef.current`, which may have changed by unmount time.

**Fix:** captured the node at effect start and used that in cleanup:

```tsx
const videoElement = videoRef.current;
// ...
return () => { if (videoElement) videoElement.srcObject = null; };
```

## Verification

| Command | Result |
| --- | --- |
| `npm run lint` | ✅ 0 problems |
| `npm run type-check` | ✅ passes |
| `npm test` | ✅ 43/43 pass |
| `npm run build` | ✅ succeeds |

No runtime behavior was intentionally changed: the form/availability refactors are equivalent derivations of the same source data, and the `queueMicrotask` wrappers preserve the original load order.
