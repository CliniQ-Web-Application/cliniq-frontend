# CliniQ Frontend

CliniQ is a Next.js frontend prototype for appointment booking, queue
management, staff operations, and hospital administration at outpatient
departments.

This repository currently contains UI-focused prototype pages. The admin
screens use local synthetic data so that the flows can be demonstrated before
the backend API and authentication layer are connected.

## Running the project

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The production build also renders the sign-in page. That page currently
requires the Supabase environment variables used by `lib/supabase.ts`.

## Admin pages

The admin UI is split into five routes:

| Route | Purpose |
| --- | --- |
| `/admin` | Analytics dashboard |
| `/admin/queues` | Hospital-wide queue monitoring |
| `/admin/staff` | Staff account and role management |
| `/admin/departments` | Department configuration |
| `/admin/audit-log` | Read-only audit history |

Each route is a small page wrapper that passes an `activePage` value to the
shared `AdminShell` component:

```tsx
// app/admin/page.tsx
import AdminShell from "@/components/admin/AdminShell";

export default function AdminPortal() {
  return <AdminShell activePage="analytics" />;
}
```

The other routes follow the same pattern with `queues`, `staff`,
`departments`, or `audit`.

## Where the admin data comes from today

All current admin data is defined as in-memory constants at the top of
`components/admin/AdminShell.tsx`. There is no fetch request, Supabase query,
database connection, or API integration behind these screens yet.

### Synthetic data currently used

- `staff`: four sample staff accounts containing name, role, department,
  status, and initials.
- `departments`: four sample departments containing name, operating hours,
  staff count, and active state.
- `queue`: four sample queue entries containing position, patient display
  name, department, queue status, and estimated wait.
- `auditEntries`: four sample audit records containing timestamp, action,
  patient display name, actor, reason, and recorded change.
- Analytics values are currently written directly inside `AnalyticsPage`.
  This includes KPI values, department wait times, arrival-hour bar heights,
  and appointment outcome totals.

The data is intentionally small and synthetic. Patient names are abbreviated
in the UI to reflect the project requirements around limiting exposed patient
identifiers. These values should be replaced with typed API responses when the
backend is available.

## How the current interactions work

The shared shell is marked with `"use client"` because the prototype contains
browser-side state and event handlers. Each page uses React `useState` for
temporary UI state:

- **Analytics** stores the selected date range and displays it beside the
  wait-time chart. The department and doctor selectors are visual controls
  until analytics API filtering is connected.
- **Queues** stores the selected department and filters the local `queue`
  array with `queue.filter(...)`. The “Call next patient” button displays a
  local success message; it does not update a backend queue.
- **Staff** stores the search text, selected staff member, and save message.
  The search filters the local `staff` array. Selecting a table row changes
  the profile shown in the edit panel.
- **Departments** stores the selected department and save message. Selecting
  a department changes the edit panel to the matching local object.
- **Audit log** stores the selected action and filters `auditEntries`. Audit
  rows are deliberately read-only in accordance with the design.

For example, the queue filter is currently implemented as:

```tsx
const [selectedDepartment, setSelectedDepartment] =
  useState("All departments");

const visibleQueue = queue.filter(
  (item) =>
    selectedDepartment === "All departments" ||
    item.department === selectedDepartment,
);
```

When the backend is added, the selected filter should become part of the
request query instead of filtering only the browser copy:

```text
GET /api/v1/queues?department_id={id}
```

Similarly, the current save buttons only change local feedback state. They
should later call the relevant mutation endpoints and handle loading,
validation, success, and error states.

## Admin design decisions

### Shared portal shell

`components/admin/AdminShell.tsx` contains the shared header, navigation,
page heading, status badge, and all five admin page views. Keeping the shell
in one component gives every admin route the same:

- CliniQ admin branding
- active navigation state
- responsive mobile menu
- spacing, colours, borders, and button styles
- page width and responsive breakpoints

The `AdminPage` union type limits valid page identifiers:

```tsx
export type AdminPage =
  | "analytics"
  | "queues"
  | "staff"
  | "departments"
  | "audit";
```

The navigation array uses that type to keep the route label, icon, URL, and
active state together. This avoids duplicating navigation markup in every
route.

### Visual language

The admin pages follow the existing CliniQ design tokens from
`app/globals.css`:

- `bg-background` for the warm page background
- `bg-surface` for cards and panels
- `text-primary` and `bg-primary` for the main blue action colour
- `bg-accent-surface` for selected or highlighted states
- `success`, `error`, and neutral colours for status communication

Cards use light borders, rounded corners, and restrained shadows so that
tables and operational information remain the visual focus. The layout uses
Tailwind responsive classes rather than a separate stylesheet.

### Analytics

The analytics page is based on the supplied administrator mockup. It
prioritises:

1. Date, department, and doctor filters.
2. High-value operational metrics: waiting time, appointments, completion
   rate, and no-show rate.
3. Department comparison through horizontal bars.
4. Arrival-volume comparison through a compact bar chart.
5. Appointment outcome details in a table.

The charts are deliberately CSS/Tailwind visualisations rather than a chart
library. This keeps the prototype lightweight and makes the intended layout
clear before deciding whether the production version needs a charting
dependency.

### Staff and department management

The staff and department pages use a two-column desktop layout:

- the left side provides searchable/selectable records;
- the right side provides the edit form for the selected record.

On smaller screens, the grid collapses into one column. This reflects the
mockups while keeping the pages usable on laptop and tablet widths.

Status badges use one reusable `StatusBadge` component. The component shows
both colour and an icon so that active/inactive status is not communicated by
colour alone.

### Queues and audit history

The queues page is operational rather than analytical. It exposes the current
position, patient display name, department, status, estimated wait, and a
future action area. The page intentionally does not make clinical priority
decisions automatically; prioritisation remains a staff-controlled workflow.

The audit page is read-only. Its filters mirror the administrator mockup and
the project requirements around recording priority changes, status changes,
cancellations, the responsible user, the reason, and the resulting change.

## Important implementation files

| File | Responsibility |
| --- | --- |
| `components/admin/AdminShell.tsx` | Shared admin shell, local prototype data, page views, and interactions |
| `app/admin/page.tsx` | Analytics route entry point |
| `app/admin/queues/page.tsx` | Queue route entry point |
| `app/admin/staff/page.tsx` | Staff route entry point |
| `app/admin/departments/page.tsx` | Department route entry point |
| `app/admin/audit-log/page.tsx` | Audit route entry point |
| `app/globals.css` | Global CliniQ colour tokens and base control styles |

There is also an older `app/admin/departments.tsx` file in the repository.
The active App Router route is `app/admin/departments/page.tsx`; the older
file is not used by the current `/admin/departments` route and can be removed
or repurposed during cleanup.

## Planned backend integration

The admin UI should eventually consume the API described in the system design
documents. The main integration surfaces are:

| UI area | Likely backend data |
| --- | --- |
| Analytics | Appointment, queue, cancellation, no-show, waiting-time, and attendance aggregates |
| Queues | Current queue entries filtered by department |
| Staff | Staff accounts, roles, permissions, schedules, and department assignments |
| Departments | Department records, services, operating hours, and assigned staff |
| Audit log | Read-only audit records with date, action, actor, reason, and change |

The intended API is versioned under `/api/v1/`. The system design describes
department, staff, schedule, queue, appointment, and audit-log resources.
When connecting the frontend:

1. Replace the constants in `AdminShell.tsx` with typed response models.
2. Move data loading into route-specific server components or a shared data
   layer where appropriate.
3. Add authenticated requests with the admin role and server-side
   authorisation.
4. Replace local save/call actions with mutations and explicit loading and
   error states.
5. Subscribe to aggregate or queue updates where real-time behaviour is
   required.
6. Keep sensitive patient identifiers out of broad list responses.

The current buttons are therefore prototype interactions, not completed
business operations. The backend must remain the source of truth for account
changes, queue transitions, department configuration, analytics calculations,
and audit records.
