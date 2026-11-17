"use client";

import Link from "next/link";
import AdminSchedules from "./AdminSchedules";
import AdminAppointments from "./AdminAppointments";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { staffApi } from "@/lib/api-client";
import { useAdminQueues, useAnalytics, useAuditLogs, useDepartments, useStaffList } from "@/lib/queries";
import { StaffApiError, type QueueEntry } from "@/lib/staff";
import type { Department } from "@/types/Department";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import PageHeader from "@/components/ui/PageHeader";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Clock3,
  Download,
  FileText,
  Filter,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

export type AdminPage = "analytics" | "queues" | "staff" | "departments" | "audit" | "schedules" | "appointments";

type AdminStaff = {
  staffId: string;
  firstName: string;
  lastName: string;
  staffRole: string;
  email: string;
  active: boolean;
  availabilityStatus: string;
  department: Department | null;
};

type AuditEntry = {
  logId: string;
  action: string;
  reason: string | null;
  entityName: string;
  entityId: string;
  createdAt: string;
  staff: Pick<AdminStaff, "firstName" | "lastName"> | null;
};

type AdminDepartment = Department & {
  operatingHours: string;
};

type AnalyticsPayload = {
  metrics: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShows: number;
    averageWaitMinutes: number;
  };
  waitByDepartment: Array<{ department: string; averageWaitMinutes: number }>;
  peakArrivalHours: Array<{ hour: number; count: number }>;
  outcomes: Array<{ status: string; count: number }>;
  departments: Array<{ id: string; label: string }>;
  doctors: Array<{ id: string; label: string }>;
};

const navigation: { label: string; href: string; page: AdminPage; icon: typeof BarChart3 }[] = [
  { label: "Analytics", href: "/admin", page: "analytics", icon: BarChart3 },
  { label: "Queues", href: "/admin/queues", page: "queues", icon: Activity },
  { label: "Staff", href: "/admin/staff", page: "staff", icon: Users },
  { label: "Schedules", href: "/admin/schedules", page: "schedules", icon: Clock3 },
  { label: "Appointments", href: "/admin/appointments", page: "appointments", icon: Stethoscope },
  { label: "Departments", href: "/admin/departments", page: "departments", icon: LayoutDashboard },
  { label: "Audit log", href: "/admin/audit-log", page: "audit", icon: FileText },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const adminError = (cause: unknown, fallback: string) =>
  cause instanceof StaffApiError ? cause.message : fallback;

function StatusBadge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cx(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
      active ? "bg-success-background text-success" : "bg-neutral-100 text-neutral-500",
    )}>
      {active ? <Check size={13} /> : <X size={13} />}
      {children}
    </span>
  );
}

function AdminHeader({ activePage }: { activePage: AdminPage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { profile, user, signOut } = useAuth();

  const adminName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.email || user?.email || "Admin";

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-primary/15 bg-surface/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/admin" className="shrink-0 text-lg font-bold text-primary no-underline">
          CliniQ <span className="hidden font-normal text-neutral-500 sm:inline">| Admin portal</span>
        </Link>
        <nav className="order-last hidden w-full items-center gap-1 overflow-x-auto xl:flex" aria-label="Admin navigation">
          {navigation.map(({ label, href, page, icon: Icon }) => (
            <Link
              key={page}
              href={href}
              className={cx(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold no-underline transition",
                activePage === page ? "bg-accent-surface text-primary" : "text-neutral-600 hover:bg-background hover:text-primary",
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary sm:inline">
            {adminName} · Admin
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary transition hover:bg-accent-surface disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
          >
            {signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {signingOut ? "Signing out..." : "Logout"}
          </button>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-lg p-2 xl:hidden" aria-label="Toggle admin navigation">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-primary/15 bg-surface px-4 py-3 xl:hidden" aria-label="Admin mobile navigation">
          <div className="grid gap-1 sm:grid-cols-2">
            {navigation.map(({ label, href, page, icon: Icon }) => (
              <Link key={page} href={href} onClick={() => setMenuOpen(false)} className={cx("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold no-underline", activePage === page ? "bg-accent-surface text-primary" : "text-neutral-700")}>
                <Icon size={17} /> {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void handleSignOut();
              }}
              disabled={signingOut}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-600 no-underline hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
              {signingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <PageHeader title={title} description={description} action={action} />;
}

function LegacyAnalyticsPage() {
  const [range, setRange] = useState("1 Oct – 7 Oct");
  return (
    <>
      <PageHeading
        title="Analytics"
        description="Track waiting times, appointments and attendance across Nyangabgwe Referral Hospital."
        action={<button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"><Download size={16} /> Generate report</button>}
      />
      <div className="mt-8 grid gap-3 rounded-xl border border-primary/15 bg-surface p-3 shadow-sm sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Clock3 size={16} className="text-primary" /><span className="sr-only">Date range</span><select value={range} onChange={(event) => setRange(event.target.value)} className="h-10 w-full bg-transparent outline-none"><option>1 Oct – 7 Oct</option><option>8 Oct – 14 Oct</option><option>1 Sep – 30 Sep</option></select></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Filter size={16} className="text-primary" /><span className="sr-only">Department</span><select className="h-10 w-full bg-transparent outline-none"><option>All departments</option><option>General practice</option><option>Paediatrics</option><option>Dental</option></select></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Stethoscope size={16} className="text-primary" /><span className="sr-only">Doctor</span><select className="h-10 w-full bg-transparent outline-none"><option>All doctors</option><option>Dr. Molefe</option><option>Dr. Kgosi</option></select></label>
      </div>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        {[
          ["28 min", "Average waiting time", "↓ 6% from last period", Clock3],
          ["214", "Appointments", "↑ 12% from last period", FileText],
          ["82%", "Completion rate", "175 completed visits", Check],
          ["9%", "No-show rate", "19 missed appointments", AlertTriangle],
        ].map(([value, label, trend, Icon]) => (
          <article key={label as string} className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="rounded-lg bg-accent-surface p-2.5 text-primary"><Icon size={19} /></span><span className="text-xs font-semibold text-success">{trend as string}</span></div>
            <p className="mt-5 text-3xl font-bold">{value as string}</p>
            <p className="mt-1 text-sm font-medium text-neutral-600">{label as string}</p>
          </article>
        ))}
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="font-bold">Average wait by department</h2><span className="text-xs text-neutral-500">{range}</span></div>
          <div className="mt-6 space-y-5">
            {[["General", 34, "w-[86%]"], ["Paediatrics", 26, "w-[67%]"], ["Dental", 19, "w-[49%]"], ["Eye clinic", 23, "w-[59%]"]].map(([name, minutes, width]) => (
              <div key={name as string} className="grid grid-cols-[90px_1fr_48px] items-center gap-3 text-sm"><span className="font-medium">{name as string}</span><div className="h-3 overflow-hidden rounded-full bg-background"><div className={cx("h-full rounded-full bg-primary", width as string)} /></div><span className="text-right font-semibold">{minutes as number} min</span></div>
            ))}
          </div>
        </article>
        <article className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">
          <h2 className="font-bold">Peak arrival hours</h2>
          <div className="mt-6 flex h-32 items-end justify-between gap-2 border-b border-primary/15 px-2">
            {[42, 22, 62, 44, 87, 56, 28].map((height, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-10 rounded-t-md bg-primary" style={{ height: `${height}%` }} /><span className="text-xs text-neutral-500">{index + 8}</span></div>)}
          </div>
          <p className="mt-4 text-sm text-neutral-500">Most arrivals are recorded between 11:00 and 13:00.</p>
        </article>
      </section>
      <section className="mt-5 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">
        <h2 className="font-bold">Appointment outcomes</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Count</th><th className="px-3 py-3 font-semibold">Share</th><th className="px-3 py-3 font-semibold">Trend</th></tr></thead><tbody>{[["Completed", "175", "82%", "↑ 4%"], ["Cancelled", "20", "9%", "↓ 2%"], ["No-show", "19", "9%", "↓ 1%"]].map(([status, count, share, trend]) => <tr key={status} className="border-b border-primary/10 last:border-0"><td className="px-3 py-3 font-semibold">{status}</td><td className="px-3 py-3">{count}</td><td className="px-3 py-3">{share}</td><td className="px-3 py-3 text-success">{trend}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}

function AnalyticsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (departmentId) params.set("departmentId", departmentId);
  if (doctorId) params.set("doctorId", doctorId);
  const paramsString = params.toString();

  // Changing filters changes the query key, so the shared cache refetches automatically.
  const {
    data,
    isPending: loading,
    error: queryError,
    refetch,
  } = useAnalytics<AnalyticsPayload>(paramsString, {
    enabled: !authLoading && Boolean(user) && role === "ADMIN",
  });
  const invalidRange = Boolean(from && to && from > to);
  const error = invalidRange
    ? "The start date must be before or equal to the end date."
    : queryError
      ? adminError(queryError, "Could not load analytics. Please try again.")
      : "";

  function exportReport() {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Appointments", data.metrics.appointments],
      ["Completed", data.metrics.completed],
      ["Cancelled", data.metrics.cancelled],
      ["No-shows", data.metrics.noShows],
      ["Average wait minutes", data.metrics.averageWaitMinutes],
      ...data.waitByDepartment.map((item) => [`Average wait - ${item.department}`, item.averageWaitMinutes]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "cliniq-analytics-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (authLoading) return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  if (!user || role !== "ADMIN") return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can view analytics.</p>;

  const metrics = data?.metrics;
  const maxWait = Math.max(...(data?.waitByDepartment.map((item) => item.averageWaitMinutes) ?? [1]), 1);
  const maxArrivals = Math.max(...(data?.peakArrivalHours.map((item) => item.count) ?? [1]), 1);
  const totalOutcomes = data?.outcomes.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const metricCards: Array<{ value: string | number; label: string; Icon: typeof Clock3 }> = [
    { value: metrics ? `${metrics.averageWaitMinutes} min` : "—", label: "Average waiting time", Icon: Clock3 },
    { value: metrics?.appointments ?? "—", label: "Appointments", Icon: FileText },
    { value: metrics ? `${metrics.appointments ? Math.round(metrics.completed / metrics.appointments * 100) : 0}%` : "—", label: "Completion rate", Icon: Check },
    { value: metrics ? `${metrics.appointments ? Math.round(metrics.noShows / metrics.appointments * 100) : 0}%` : "—", label: "No-show rate", Icon: AlertTriangle },
  ];

  return (
    <>
      <PageHeading title="Analytics" description="Track waiting times, appointments and attendance from live clinic data." action={<button type="button" onClick={exportReport} disabled={loading || !data} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"><Download size={16} /> Generate report</button>} />
      <div className="mt-8 grid gap-3 rounded-xl border border-primary/15 bg-surface p-3 shadow-sm sm:grid-cols-4">
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Clock3 size={16} className="text-primary" /><span className="sr-only">From date</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-full bg-transparent outline-none" /></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Clock3 size={16} className="text-primary" /><span className="sr-only">To date</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 w-full bg-transparent outline-none" /></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Filter size={16} className="text-primary" /><span className="sr-only">Department</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-10 w-full bg-transparent outline-none"><option value="">All departments</option>{data?.departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Stethoscope size={16} className="text-primary" /><span className="sr-only">Doctor</span><select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="h-10 w-full bg-transparent outline-none"><option value="">All doctors</option>{data?.doctors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" disabled={loading} onClick={() => void refetch()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold disabled:opacity-50">{loading ? "Retrying..." : "Retry"}</button></div>}
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        {metricCards.map(({ value, label, Icon }) => <article key={label} className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><span className="inline-flex rounded-lg bg-accent-surface p-2.5 text-primary"><Icon size={19} /></span><p className="mt-5 text-3xl font-bold">{value}</p><p className="mt-1 text-sm font-medium text-neutral-600">{label}</p></article>)}
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Average wait by department</h2><span className="text-xs text-neutral-500">{from} to {to}</span></div><div className="mt-6 space-y-5">{(data?.waitByDepartment ?? []).map((item) => <div key={item.department} className="grid grid-cols-[90px_1fr_48px] items-center gap-3 text-sm"><span className="truncate font-medium">{item.department}</span><div className="h-3 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${item.averageWaitMinutes / maxWait * 100}%` }} /></div><span className="text-right font-semibold">{item.averageWaitMinutes} min</span></div>)}{!loading && !data?.waitByDepartment.length && <p className="text-sm text-neutral-500">No wait samples for this period.</p>}</div></article>
        <article className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><h2 className="font-bold">Peak arrival hours</h2><div className="mt-6 flex h-32 items-end justify-between gap-2 border-b border-primary/15 px-2">{(data?.peakArrivalHours ?? []).map((item) => <div key={item.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-10 rounded-t-md bg-primary" style={{ height: `${item.count / maxArrivals * 100}%` }} /><span className="text-xs text-neutral-500">{item.hour}:00</span></div>)}</div><p className="mt-4 text-sm text-neutral-500">Arrival volume uses check-in times, falling back to booking creation time.</p></article>
      </section>
      <section className="mt-5 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><h2 className="font-bold">Appointment outcomes</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Count</th><th className="px-3 py-3 font-semibold">Share</th></tr></thead><tbody>{(data?.outcomes ?? []).map((item) => <tr key={item.status} className="border-b border-primary/10 last:border-0"><td className="px-3 py-3 font-semibold">{item.status}</td><td className="px-3 py-3">{item.count}</td><td className="px-3 py-3">{totalOutcomes ? Math.round(item.count / totalOutcomes * 100) : 0}%</td></tr>)}</tbody></table></div></section>
    </>
  );
}

function QueuePage() {
  const { user, role, loading: authLoading } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState("All departments");
  const [actionError, setActionError] = useState("");
  const [calledPatient, setCalledPatient] = useState("");
  const [busy, setBusy] = useState(false);

  // Shared queue cache, kept fresh by Supabase Realtime events.
  const {
    data,
    isPending: loading,
    isFetching: refreshing,
    error: queryError,
    refetch,
  } = useAdminQueues({ enabled: !authLoading && Boolean(user) && role === "ADMIN" });
  const queue = data?.queue ?? [];
  const departments = data?.departments ?? [];
  const error = queryError ? adminError(queryError, "Could not load the hospital queue. Please try again.") : "";

  async function callNext() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setCalledPatient("");
    try {
      const result = await staffApi("/queues/call-next", { method: "POST" }) as QueueEntry["appointment"] | null;
      const patient = result?.patient;
      setCalledPatient(patient ? `${patient.patientName} ${patient.patientSurname}`.trim() : "the next eligible patient");
      await refetch();
    } catch (cause) {
      setActionError(cause instanceof StaffApiError ? cause.message : "Could not call the next patient. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  }

  if (!user || role !== "ADMIN") {
    return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can view hospital queues.</p>;
  }

  const visibleQueue = queue
    .filter((entry) => selectedDepartment === "All departments" || entry.department?.name === selectedDepartment)
    .filter((entry) => ["WAITING", "INCONSULTATION", "CHECKEDIN"].includes(entry.appointment?.appointmentStatus));
  const waitingCount = visibleQueue.filter((entry) => entry.appointment?.appointmentStatus === "WAITING").length;
  const consultationCount = visibleQueue.filter((entry) => entry.appointment?.appointmentStatus === "INCONSULTATION").length;

  return (
    <>
      <PageHeading title="Hospital queues" description="Monitor the current queue across departments. Queue actions remain under staff control." action={<button type="button" disabled={busy || loading} onClick={() => void callNext()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"><Activity size={16} /> {busy ? "Calling..." : "Call next patient"}</button>} />
      {calledPatient && <div role="status" className="mt-6 flex items-center justify-between rounded-xl border border-success/20 bg-success-background px-4 py-3 text-sm font-semibold text-success"><span>Called {calledPatient}.</span><button type="button" onClick={() => setCalledPatient("")} aria-label="Dismiss notification"><X size={16} /></button></div>}
      {actionError && <p role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background px-4 py-3 text-sm text-error">{actionError}</p>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background px-4 py-4 text-sm text-error"><p>{error}</p><button type="button" disabled={loading} onClick={() => void refetch()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold disabled:opacity-50">{loading ? "Retrying..." : "Retry"}</button></div>}
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">Waiting now</p><p className="mt-2 text-3xl font-bold">{loading ? "—" : waitingCount}</p></div><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">In consultation</p><p className="mt-2 text-3xl font-bold">{loading ? "—" : consultationCount}</p></div><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">Last refresh</p><p className="mt-2 text-lg font-bold">{refreshing ? "Refreshing..." : "Up to date"}</p></div></div>
      <section className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">Current queue</h2>
          <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="h-10 rounded-lg border border-primary/25 bg-background px-3 text-sm">
            <option>All departments</option>
            {departments.map((department) => <option key={department.departmentId}>{department.name}</option>)}
          </select>
        </div>
        {loading ? <p role="status" className="mt-6 text-sm text-neutral-500">Loading queue...</p>
          : visibleQueue.length === 0 ? <p className="mt-6 rounded-lg bg-background p-4 text-sm text-neutral-600">No patients are currently in this queue.</p>
          : <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleQueue.map((entry) => {
                const patient = entry.appointment?.patient;
                return (
                  <AppointmentCard
                    key={entry.queueId}
                    title={patient ? `${patient.patientName} ${patient.patientSurname}` : "Unknown patient"}
                    subtitle={entry.department?.name ?? "Unknown department"}
                    status={entry.appointment?.appointmentStatus ?? "UNKNOWN"}
                    details={[
                      { label: "Position", value: `#${entry.position}` },
                      { label: "Checked in", value: entry.appointment?.checkInTime ? new Date(entry.appointment.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—" },
                    ]}
                  />
                );
              })}
            </div>}
      </section>
    </>
  );
}

function StaffPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [staffForm, setStaffForm] = useState<{ staffId: string; role: string; departmentId: string } | null>(null);
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"save" | "toggle" | null>(null);

  const enabled = !authLoading && Boolean(user) && role === "ADMIN";
  const {
    data: staff = [],
    isPending: loading,
    isFetching: refreshing,
    error: queryError,
    refetch,
  } = useStaffList<AdminStaff>({ enabled });
  const { data: departments = [] } = useDepartments<Department[]>({ enabled });
  const error = saveError || (queryError ? adminError(queryError, "Could not load staff accounts. Please try again.") : "");

  useEffect(() => {
    queueMicrotask(() => setSelectedId((current) => current && staff.some((member) => member.staffId === current) ? current : staff[0]?.staffId ?? ""));
  }, [staff]);

  const selected = staff.find((member) => member.staffId === selectedId) ?? null;
  // Form values follow the selected row, unless the user is editing them.
  const selectedRole = staffForm?.staffId === selectedId ? staffForm.role : (selected?.staffRole ?? "");
  const selectedDepartmentId = staffForm?.staffId === selectedId
    ? staffForm.departmentId
    : (selected?.department?.departmentId ?? "");

  const visibleStaff = staff.filter((member) => `${member.firstName} ${member.lastName} ${member.staffRole} ${member.department?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  async function saveSelected() {
    if (!selected || busy) return;
    const department = departments.find((item) => item.departmentId === selectedDepartmentId);
    if (!department) {
      setSaveError("Select a department before saving.");
      return;
    }
    setBusy(true);
    setBusyAction("save");
    setSaved("");
    setSaveError("");
    try {
      await staffApi(`/staff/${selected.staffId}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, staffRole: selectedRole, department }),
      });
      setSaved(`Changes saved for ${selected.firstName} ${selected.lastName}.`);
      await refetch();
    } catch (cause) {
      setSaveError(cause instanceof StaffApiError ? cause.message : "Could not save this staff account.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function toggleActive() {
    if (!selected || busy) return;
    setBusy(true);
    setBusyAction("toggle");
    setSaved("");
    setSaveError("");
    try {
      await staffApi(`/staff/${selected.staffId}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, active: !selected.active }),
      });
      setSaved(`${selected.firstName} ${selected.lastName} is now ${selected.active ? "deactivated" : "active"}.`);
      await refetch();
    } catch (cause) {
      setSaveError(cause instanceof StaffApiError ? cause.message : "Could not change this account's status.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  if (authLoading) return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  if (!user || role !== "ADMIN") return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can manage staff accounts.</p>;

  return (
    <>
      <PageHeading title="Staff accounts" description="Manage staff profiles, roles, department assignments and account status." action={<Link href="/admin/staff/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"><Plus size={16} /> Add account</Link>} />
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" disabled={loading} onClick={() => void refetch()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold disabled:opacity-50">{loading ? "Retrying..." : "Retry"}</button></div>}
      {saved && <p role="status" className="mt-6 rounded-xl border border-success/20 bg-success-background p-4 text-sm font-semibold text-success">{saved}</p>}
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role or department" className="h-11 w-full rounded-lg border border-primary/25 bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /></div>{loading ? <p role="status" className="mt-6 text-sm text-neutral-500">Loading staff accounts...</p> : visibleStaff.length === 0 ? <p className="mt-6 rounded-lg bg-background p-4 text-sm text-neutral-600">No staff accounts match this search.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{visibleStaff.map((member) => { const name = `${member.firstName} ${member.lastName}`.trim(); return <tr key={member.staffId} onClick={() => { setSelectedId(member.staffId); setSaved(""); }} className={cx("cursor-pointer border-b border-primary/10 last:border-0 hover:bg-background", selectedId === member.staffId && "bg-accent-surface/50")}><td className="px-3 py-4"><span className="inline-flex items-center gap-2 font-semibold"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{`${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`}</span>{name}</span></td><td className="px-3 py-4">{member.staffRole}</td><td className="px-3 py-4">{member.department?.name ?? "Unassigned"}</td><td className="px-3 py-4"><StatusBadge active={Boolean(member.active)}>{member.active ? "Active" : "Deactivated"}</StatusBadge></td></tr>; })}</tbody></table></div>}</section>
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">{selected ? <><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Edit profile</p><h2 className="mt-1 text-lg font-bold">{selected.firstName} {selected.lastName}</h2><p className="text-sm text-neutral-500">{selected.email}</p></div><Pencil size={18} className="text-neutral-500" /></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Role<select value={selectedRole} onChange={(event) => setStaffForm({ staffId: selectedId, role: event.target.value, departmentId: selectedDepartmentId })} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal"><option value="ADMIN">Admin</option><option value="DOCTOR">Doctor</option><option value="NURSE">Nurse</option><option value="RECEPTIONIST">Reception</option></select></label><label className="block text-sm font-semibold">Department<select value={selectedDepartmentId} onChange={(event) => setStaffForm({ staffId: selectedId, role: selectedRole, departmentId: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal"><option value="">Select department</option>{departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</select></label><div><p className="text-sm font-semibold">Weekly schedule</p><p className="mt-2 text-sm text-neutral-500">Schedule management will be connected when the staff schedule API is available.</p></div></div><div className="mt-7 flex gap-3"><button type="button" disabled={busy} onClick={() => void toggleActive()} className="min-h-10 flex-1 rounded-lg border border-error px-3 text-sm font-semibold text-error hover:bg-error-background disabled:opacity-50">{busyAction === "toggle" ? "Working..." : selected.active ? "Deactivate" : "Activate"}</button><button type="button" disabled={busy} onClick={() => void saveSelected()} className="min-h-10 flex-1 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{busyAction === "save" ? "Saving..." : "Save changes"}</button></div></> : <p className="text-sm text-neutral-600">Select a staff account to edit it.</p>}</section>
      </div>
    </>
  );
}

function DepartmentsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [departmentForm, setDepartmentForm] = useState<{ id: string; name: string; operatingHours: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"save" | "delete" | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState("");

  const {
    data: departments = [],
    isPending: loading,
    error: queryError,
    refetch,
  } = useDepartments<AdminDepartment[]>({ enabled: !authLoading && Boolean(user) && role === "ADMIN" });
  const error = saveError || (queryError ? adminError(queryError, "Could not load departments. Please try again.") : "");

  useEffect(() => {
    queueMicrotask(() => setSelectedId((current) => current && departments.some((item) => item.departmentId === current) ? current : departments[0]?.departmentId ?? ""));
  }, [departments]);

  const selected = departments.find((item) => item.departmentId === selectedId) ?? null;
  // Form values follow the selected row, unless the user is editing them.
  const name = departmentForm?.id === selectedId ? departmentForm.name : (selected?.name ?? "");
  const operatingHours = departmentForm?.id === selectedId
    ? departmentForm.operatingHours
    : (selected?.operatingHours ?? "");

  async function saveDepartment() {
    if (!name.trim() || !operatingHours.trim() || busy) {
      setSaveError("Department name and operating hours are required.");
      return;
    }
    setBusy(true);
    setBusyAction("save");
    setSaveError("");
    setSaved("");
    try {
      await staffApi(selected ? `/departments/${selected.departmentId}` : "/departments", {
        method: selected ? "PUT" : "POST",
        body: JSON.stringify({ ...(selected ?? {}), name: name.trim(), operatingHours: operatingHours.trim() }),
      });
      setSaved(selected ? "Department changes saved." : "Department created.");
      await refetch();
    } catch (cause) {
      setSaveError(cause instanceof StaffApiError ? cause.message : "Could not save the department.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function deleteDepartment() {
    if (!selected || busy || !window.confirm(`Delete ${selected.name}?`)) return;
    setBusy(true);
    setBusyAction("delete");
    setSaveError("");
    setSaved("");
    try {
      await staffApi(`/departments/${selected.departmentId}`, { method: "DELETE" });
      setSaved("Department deleted.");
      await refetch();
    } catch (cause) {
      setSaveError(cause instanceof StaffApiError ? cause.message : "Could not delete the department.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  if (authLoading) return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  if (!user || role !== "ADMIN") return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can manage departments.</p>;

  return (
    <>
      <PageHeading title="Departments" description="Manage hospital services and operating hours. Staff assignments are managed from staff accounts." action={<button type="button" onClick={() => { setSelectedId(""); setDepartmentForm(null); setSaved(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Plus size={16} /> Add department</button>} />
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" disabled={loading} onClick={() => void refetch()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold disabled:opacity-50">{loading ? "Retrying..." : "Retry"}</button></div>}
      {saved && <p role="status" className="mt-6 rounded-xl border border-success/20 bg-success-background p-4 text-sm font-semibold text-success">{saved}</p>}
      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">{loading ? <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5 text-sm text-neutral-500">Loading departments...</p> : departments.length === 0 ? <p className="rounded-xl border border-primary/15 bg-surface p-5 text-sm text-neutral-600">No departments have been created.</p> : departments.map((item) => <button type="button" key={item.departmentId} onClick={() => { setSelectedId(item.departmentId); setSaved(""); }} className={cx("flex w-full items-center justify-between rounded-xl border p-4 text-left transition", selectedId === item.departmentId ? "border-primary bg-accent-surface/60 shadow-sm" : "border-primary/15 bg-surface hover:border-primary/35")}><div><p className="font-bold">{item.name}</p><p className="mt-1 text-sm text-neutral-600">{item.operatingHours}</p></div><LayoutDashboard size={19} className="text-neutral-500" /></button>)}</section>
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{selected ? "Edit department" : "New department"}</p><h2 className="mt-1 text-lg font-bold">{selected?.name ?? "Create department"}</h2></div><LayoutDashboard size={19} className="text-neutral-500" /></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Department name<input value={name} onChange={(event) => setDepartmentForm({ id: selectedId, name: event.target.value, operatingHours })} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Operating hours<input value={operatingHours} onChange={(event) => setDepartmentForm({ id: selectedId, name, operatingHours: event.target.value })} placeholder="07:30 to 16:30" className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label></div><div className="mt-7 flex gap-3"><button type="button" disabled={!selected || busy} onClick={() => void deleteDepartment()} className="min-h-10 rounded-lg border border-error px-4 text-sm font-semibold text-error hover:bg-error-background disabled:opacity-50">{busyAction === "delete" ? "Deleting..." : "Delete"}</button><button type="button" disabled={busy} onClick={() => void saveDepartment()} className="min-h-10 flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{busyAction === "save" ? (selected ? "Saving..." : "Creating...") : selected ? "Save changes" : "Create department"}</button></div></section>
      </div>
    </>
  );
}

function AuditPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [action, setAction] = useState("All actions");
  const [userFilter, setUserFilter] = useState("All users");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const {
    data: entries = [],
    isPending: loading,
    error: queryError,
    refetch,
  } = useAuditLogs<AuditEntry>({ enabled: !authLoading && Boolean(user) && role === "ADMIN" });
  const error = queryError ? adminError(queryError, "Could not load the audit log. Please try again.") : "";

  if (authLoading) return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  if (!user || role !== "ADMIN") return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can view the audit log.</p>;

  const visibleEntries = entries.filter((entry) => {
    const date = entry.createdAt?.slice(0, 10) ?? "";
    const actor = entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}`.trim() : "System";
    return (action === "All actions" || entry.action === action)
      && (userFilter === "All users" || actor === userFilter)
      && (!from || date >= from)
      && (!to || date <= to);
  });
  const actions = Array.from(new Set(entries.map((entry) => entry.action).filter(Boolean)));
  const users = Array.from(new Set(entries.map((entry) => entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}`.trim() : "System")));

  function exportLog() {
    const rows = [
      ["Date and time", "Action", "Entity", "Done by", "Reason"],
      ...visibleEntries.map((entry) => [
        entry.createdAt,
        entry.action,
        `${entry.entityName} ${entry.entityId}`,
        entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}`.trim() : "System",
        entry.reason ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "cliniq-audit-log.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHeading title="Audit log" description="Review administrative and operational changes. Log entries are read-only." action={<button type="button" onClick={exportLog} disabled={loading || visibleEntries.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary hover:bg-accent-surface disabled:opacity-50"><Download size={16} /> Export log</button>} />
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" disabled={loading} onClick={() => void refetch()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold disabled:opacity-50">{loading ? "Retrying..." : "Retry"}</button></div>}
      <section className="mt-8 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-4"><label className="text-sm font-semibold">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Action<select value={action} onChange={(event) => setAction(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal"><option>All actions</option>{actions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-semibold">User<select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal"><option>All users</option>{users.map((item) => <option key={item}>{item}</option>)}</select></label></div>{loading ? <p role="status" className="mt-6 text-sm text-neutral-500">Loading audit records...</p> : visibleEntries.length === 0 ? <p className="mt-6 rounded-lg bg-background p-4 text-sm text-neutral-600">No audit records match the selected filters.</p> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-primary/15 bg-background text-neutral-600"><tr><th className="px-3 py-3">Date and time</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Entity</th><th className="px-3 py-3">Done by</th><th className="px-3 py-3">Reason</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.logId} className="border-b border-primary/10 last:border-0"><td className="px-3 py-4 whitespace-nowrap">{entry.createdAt}</td><td className="px-3 py-4"><span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs font-semibold"><ShieldCheck size={13} />{entry.action}</span></td><td className="px-3 py-4 font-semibold">{entry.entityName} #{entry.entityId}</td><td className="px-3 py-4">{entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}`.trim() : "System"}</td><td className="px-3 py-4">{entry.reason ?? "—"}</td></tr>)}</tbody></table></div>}<p className="mt-5 flex items-center gap-2 text-sm text-neutral-500"><ShieldCheck size={16} /> Log entries are read-only and generated by the server.</p></section>
    </>
  );
}

export default function AdminShell({ activePage, children }: { activePage: AdminPage; children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader activePage={activePage} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children ?? <>
          {activePage === "analytics" && <AnalyticsPage />}
          {activePage === "queues" && <QueuePage />}
          {activePage === "staff" && <StaffPage />}
          {activePage === "schedules" && <AdminSchedules />}
          {activePage === "appointments" && <AdminAppointments />}
          {activePage === "departments" && <DepartmentsPage />}
          {activePage === "audit" && <AuditPage />}
        </>}
      </main>
    </div>
  );
}
