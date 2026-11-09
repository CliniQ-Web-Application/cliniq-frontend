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

Useful checks (the regression tests use Node.js 22.18+ or 24 for native TypeScript stripping):

```bash
npm test
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

## Operator-run initial admin setup

`scripts/bootstrap-admin.mjs` is a standalone Node operator tool, not a Next.js
route or browser feature. It uses the existing `@supabase/supabase-js` dependency
to create the first administrator directly in Supabase Auth and the backend's
`staff` table. It bypasses normal application authorization using a service-role
key: run it only from a trusted operator machine against the intended project.
Do not deploy it as a public endpoint or run it automatically at app startup,
in builds, or in CI. Running it writes to the selected remote project.

### Prerequisites and configuration

1. Install the frontend dependencies with `npm install`. No additional dependency
   is required. Use Node.js 22 LTS or newer; the command requires Node's native
   `--env-file` support (introduced in Node 20.6).
2. Ensure the backend schema already exists and that at least one real department
   exists in `department`. Obtain its `department_id` UUID using an authorized
   administration workflow. This script never creates departments or runs
   migrations.
3. Copy `.env` to `.env.local` in `cliniq-frontend` and fill in the empty
   values privately. If `.env.local` already exists, **merge only the missing
   keys**; do not overwrite existing application configuration.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | URL of the intended Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged service-role key for that same project |
| `CLINIQ_ADMIN_EMAIL` | Initial admin's email, normalized to lowercase |
| `CLINIQ_ADMIN_PASSWORD` | Operator-chosen password, at least 8 characters and compliant with the project's Auth policy; whitespace is preserved |
| `CLINIQ_ADMIN_FIRST_NAME` | First name, up to 100 characters |
| `CLINIQ_ADMIN_LAST_NAME` | Last name, up to 100 characters |
| `CLINIQ_ADMIN_DEPARTMENT_ID` | UUID of an existing department |

These are **server/operator-only** environment variables. Never use
`NEXT_PUBLIC_` prefixes for them, import the script into application code, commit
`.env.local`, or share the service-role key/password in logs or screenshots.
The blank `.env` contains no credentials and is explicitly allowed by
`.gitignore`. Real environment files remain ignored. Quote values containing `#` in `.env.local`
according to Node's env-file syntax. Existing process environment variables take
precedence over file values, so verify the target project before running.

### Run manually

From `cliniq-frontend`, after reviewing the project and department:

```bash
npm run setup:admin
```

The npm script runs exactly:

```bash
node --env-file=.env.local scripts/bootstrap-admin.mjs
```

The file must exist; the command deliberately uses `--env-file`, not the newer
optional `--env-file-if-exists` flag. If a secret manager already supplies every
required variable, the operator can instead run
`node scripts/bootstrap-admin.mjs` without an environment file.

### Safety and repeat runs

- Configuration and the department are checked before any writes. The script
  searches all Auth user pages, then checks staff by email and Auth user ID.
- An existing `ADMIN` profile matching both the email and Auth ID is a no-op.
  The script does not reset passwords, change names/departments, reactivate
  accounts, or modify any other existing fields on repeat runs.
- Any existing non-admin, orphaned Auth account, conflicting staff email, or
  mismatched Auth ID stops setup for manual review. Existing accounts are never
  promoted, linked, repaired, or deleted by this tool.
- For a new account, `auth.admin.createUser` creates an email-confirmed user
  (there is no invitation/email-verification flow). The staff insert contains
  `auth_user_id`, `first_name`, `last_name`, `email`, `staff_role: ADMIN`,
  `department_id`, `is_active: true`, and `availability_status: AVAILABLE`.
  These columns follow the backend `Staff.java` model; a UUID `staff_id` is
  generated by the script because Hibernate's ID generator is not a database default.
- If the staff insert fails, the script attempts to delete **only** the Auth user
  created by that invocation. A cleanup failure is reported with the Auth user
  ID for manual remediation, and any failure exits nonzero. Auth and database
  writes are not one transaction: run only one operator invocation at a time.
  After a network interruption or uncertain write result, inspect both Auth and
  staff before retrying; do not assume rollback or completion succeeded.
- After provisioning, sign in through the normal application flow. Remove the
  bootstrap password and service-role key from the local file when no longer
  needed, and keep privileged credentials in approved secret storage.

### Adding subsequent staff

Use the authenticated staff-registration workflow rather than rerunning the
bootstrap tool for routine staff management. Sign in as the administrator, open
`/admin/staff`, then select **Add account** to open `/admin/staff/register`.
The legacy `/staff/register` route redirects administrators to the same page;
non-admin staff cannot access registration. The staff list is still demo data
and does not display newly created accounts.

That form already calls `POST /api/staff/register` with the signed-in user's
Bearer access token and `firstName`, `lastName`, `email`, `password`, `staffRole`,
and `departmentId`. The existing backend controller checks that the caller's
staff role is `ADMIN`. The first-admin script exists to bootstrap that
prerequisite; it does not replace the existing registration API.

## Patient live booking

`/patient/book-appointment` requires a signed-in patient and a configured
`NEXT_PUBLIC_API_URL` pointing to the backend origin (without `/api`). All booking
and profile requests use the patient's bearer token. An explicit 401 triggers
one token refresh and retry; token changes do not reset the selection or success.
No credentials or patient ownership identifiers are supplied by the form.

`NEXT_PUBLIC_SUPABASE_URL` must identify the **same** Supabase project as the
backend's `JWT_ISSUER_URI`. If they differ, sign-in still succeeds in the
browser but every backend request is rejected with 401 because the token's
issuer and signing key belong to another project. Changing this value requires
restarting the Next.js dev/production process so the inlined public variables
are rebuilt.

The page checks `GET /api/patients/me`. A 404 shows a required profile form
(first name, surname, National ID, phone), prefilled from signup metadata for the
patient to review. Only submitting that form calls `POST /api/patients/me` with
`{patientName,patientSurname,nationalID,phone}`. The server derives email and
ownership from the JWT. Signup itself only creates the auth account; it no
longer inserts patients directly or syncs a second patient record. This also
supports users signing in after email confirmation without an existing profile.

Availability comes exclusively from `GET /api/bookings/availability`, not staff
schedules. Departments and doctors are derived from its minimal display data.
The server filters future OPEN slots for active doctors in the clinic timezone
(default UTC); the browser displays those dates/times unchanged and does not
exclude dates using the browser's timezone.

Confirm booking sends exactly `{slotId}` to `POST /api/bookings`. A synchronous
in-flight guard prevents double submission and selection controls freeze while
saving. Only a verified backend BOOKED response shows a confirmation, including
the returned appointment ID, clinic date/time, department, and doctor. A 409 or
404 clears the stale slot and refreshes availability without hiding the error.
Profile checks, availability, and appointment lists have independent loading,
error, empty, and retry states.

The **My appointments** section (`#my-bookings`, also linked from the portal)
loads the signed-in patient's `GET /api/bookings` list. A lost response, server
failure, or invalid booking response is treated as uncertain, never as success
or an automatic rebooking opportunity. Booking remains paused while the patient
checks their appointments. A matching BOOKED slot recovers the confirmation;
otherwise the patient is asked to check again or contact the clinic rather than
risk a duplicate. Reloading/navigation does not automatically repeat any POST;
patients should check this list before starting another booking after an error.

Run `npm test`, `npm run lint`, and `node node_modules/typescript/bin/tsc --noEmit
--incremental false` for local checks. No backend files are changed by this
frontend implementation.


## Check-in QR and /check-in

Patients see a "Check-in QR" button on the patient booking page (per BOOKED appointment). The modal fetches the QR PNG from the backend with the caller's bearer token and shows it for reception to scan; the QR encodes a link to `/check-in?id=<appointmentId>`. `/check-in` is a shared page (not role-gated by the proxy): patients see their appointment (via `GET /api/bookings/{id}`) and can check themselves in, while staff/admin scanning it see the appointment (via `GET /api/appointments/{id}`) and can also check the patient in. Anyone signed out is sent to sign in and returned to the link afterwards (`isRouteAllowed` allows `/check-in` for all roles and ignores query strings when matching paths).
