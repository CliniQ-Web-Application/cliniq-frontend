"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { createStaffApi, StaffApiError, type QueueEntry } from "@/lib/staff";
import type { Department } from "@/types/Department";
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

export type AdminPage = "analytics" | "queues" | "staff" | "departments" | "audit";

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
  { label: "Departments", href: "/admin/departments", page: "departments", icon: LayoutDashboard },
  { label: "Audit log", href: "/admin/audit-log", page: "audit", icon: FileText },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  const { profile, user, signOut } = useAuth();

  const adminName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile?.email || user?.email || "Admin";

  return (
    <header className="sticky top-0 z-30 border-b border-primary/15 bg-surface/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="shrink-0 text-lg font-bold text-primary no-underline">
          CliniQ <span className="hidden font-normal text-neutral-500 sm:inline">| Admin portal</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Admin navigation">
          {navigation.map(({ label, href, page, icon: Icon }) => (
            <Link
              key={page}
              href={href}
              className={cx(
                "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold no-underline transition",
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
            onClick={() => signOut()}
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary transition hover:bg-accent-surface sm:flex"
          >
            <LogOut size={16} />
            Logout
          </button>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-lg p-2 lg:hidden" aria-label="Toggle admin navigation">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-primary/15 bg-surface px-4 py-3 lg:hidden" aria-label="Admin mobile navigation">
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
                signOut();
              }}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-600 no-underline hover:bg-red-50"
            >
              <LogOut size={17} /> Logout
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 sm:text-base">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AnalyticsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const api = useMemo(() => createStaffApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
    refreshToken: async () => {
      const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
      const session = sessionData.session;
      if (refreshError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
  }), [user?.id]);

  const loadAnalytics = useCallback(async () => {
    if (!user || role !== "ADMIN") return;
    if (from && to && from > to) {
      setError("The start date must be before or equal to the end date.");
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (departmentId) params.set("departmentId", departmentId);
    if (doctorId) params.set("doctorId", doctorId);
    try {
      setData(await api(`/analytics?${params.toString()}`) as AnalyticsPayload);
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [api, departmentId, doctorId, from, role, to, user]);

  useEffect(() => {
    if (authLoading || !user || role !== "ADMIN") return;
    queueMicrotask(() => { void loadAnalytics(); });
  }, [authLoading, loadAnalytics, role, user]);

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
      <PageHeading eyebrow="Hospital overview" title="Analytics" description="Track waiting times, appointments and attendance from live clinic data." action={<button type="button" onClick={exportReport} disabled={loading || !data} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"><Download size={16} /> Generate report</button>} />
      <div className="mt-8 grid gap-3 rounded-xl border border-primary/15 bg-surface p-3 shadow-sm sm:grid-cols-4">
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Clock3 size={16} className="text-primary" /><span className="sr-only">From date</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-full bg-transparent outline-none" /></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Clock3 size={16} className="text-primary" /><span className="sr-only">To date</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 w-full bg-transparent outline-none" /></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Filter size={16} className="text-primary" /><span className="sr-only">Department</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-10 w-full bg-transparent outline-none"><option value="">All departments</option>{data?.departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium"><Stethoscope size={16} className="text-primary" /><span className="sr-only">Doctor</span><select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="h-10 w-full bg-transparent outline-none"><option value="">All doctors</option>{data?.doctors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" onClick={() => void loadAnalytics()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold">Retry</button></div>}
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
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [calledPatient, setCalledPatient] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useMemo(() => createStaffApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
    refreshToken: async () => {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      const session = data.session;
      if (refreshError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
  }), [user?.id]);

  const loadQueue = useCallback(async (quiet = false) => {
    if (!user || role !== "ADMIN") return;
    if (!quiet) setLoading(true);
    setRefreshing(true);
    setError("");
    try {
      const [queueData, departmentData] = await Promise.all([
        api("/queues"),
        api("/departments"),
      ]);
      setQueue(Array.isArray(queueData) ? queueData as QueueEntry[] : []);
      setDepartments(Array.isArray(departmentData) ? departmentData as Department[] : []);
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not load the hospital queue. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, role, user]);

  useEffect(() => {
    if (authLoading || !user || role !== "ADMIN") return;
    queueMicrotask(() => { void loadQueue(); });
    const interval = window.setInterval(() => void loadQueue(true), 15000);
    return () => window.clearInterval(interval);
  }, [authLoading, loadQueue, role, user]);

  async function callNext() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setCalledPatient("");
    try {
      const result = await api("/queues/call-next", { method: "POST" }) as QueueEntry["appointment"] | null;
      const patient = result?.patient;
      setCalledPatient(patient ? `${patient.patientName} ${patient.patientSurname}`.trim() : "the next eligible patient");
      await loadQueue(true);
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
      <PageHeading eyebrow="Live operations" title="Hospital queues" description="Monitor the current queue across departments. Queue actions remain under staff control." action={<button type="button" disabled={busy || loading} onClick={() => void callNext()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"><Activity size={16} /> {busy ? "Calling..." : "Call next patient"}</button>} />
      {calledPatient && <div role="status" className="mt-6 flex items-center justify-between rounded-xl border border-success/20 bg-success-background px-4 py-3 text-sm font-semibold text-success"><span>Called {calledPatient}.</span><button type="button" onClick={() => setCalledPatient("")} aria-label="Dismiss notification"><X size={16} /></button></div>}
      {actionError && <p role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background px-4 py-3 text-sm text-error">{actionError}</p>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background px-4 py-4 text-sm text-error"><p>{error}</p><button type="button" onClick={() => void loadQueue()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold">Retry</button></div>}
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">Waiting now</p><p className="mt-2 text-3xl font-bold">{loading ? "—" : waitingCount}</p></div><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">In consultation</p><p className="mt-2 text-3xl font-bold">{loading ? "—" : consultationCount}</p></div><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">Last refresh</p><p className="mt-2 text-lg font-bold">{refreshing ? "Refreshing..." : "Up to date"}</p></div></div>
      <section className="mt-5 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-bold">Current queue</h2><select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="h-10 rounded-lg border border-primary/25 bg-background px-3 text-sm"><option>All departments</option>{departments.map((department) => <option key={department.departmentId}>{department.name}</option>)}</select></div>{loading ? <p role="status" className="mt-6 text-sm text-neutral-500">Loading queue...</p> : visibleQueue.length === 0 ? <p className="mt-6 rounded-lg bg-background p-4 text-sm text-neutral-600">No patients are currently in this queue.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3">Position</th><th className="px-3 py-3">Patient</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Checked in</th></tr></thead><tbody>{visibleQueue.map((entry) => { const patient = entry.appointment?.patient; const status = entry.appointment?.appointmentStatus ?? "UNKNOWN"; return <tr key={entry.queueId} className="border-b border-primary/10 last:border-0"><td className="px-3 py-4 font-bold text-primary">#{entry.position}</td><td className="px-3 py-4 font-semibold">{patient ? `${patient.patientName} ${patient.patientSurname}` : "Unknown patient"}</td><td className="px-3 py-4">{entry.department?.name ?? "Unknown department"}</td><td className="px-3 py-4"><span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", status === "INCONSULTATION" ? "bg-accent-surface text-primary" : "bg-background text-neutral-600")}>{status === "INCONSULTATION" ? "In consultation" : status === "CHECKEDIN" ? "Checked in" : "Waiting"}</span></td><td className="px-3 py-4">{entry.appointment?.checkInTime ? new Date(entry.appointment.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td></tr>; })}</tbody></table></div>}</section>
    </>
  );
}

function StaffPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [staffForm, setStaffForm] = useState<{ staffId: string; role: string; departmentId: string } | null>(null);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const api = useMemo(() => createStaffApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
    refreshToken: async () => {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      const session = data.session;
      if (refreshError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
  }), [user?.id]);

  const loadStaff = useCallback(async (quiet = false) => {
    if (!user || role !== "ADMIN") return;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [staffData, departmentData] = await Promise.all([api("/staff"), api("/departments")]);
      const nextStaff = Array.isArray(staffData) ? staffData as AdminStaff[] : [];
      setStaff(nextStaff);
      setDepartments(Array.isArray(departmentData) ? departmentData as Department[] : []);
      setSelectedId((current) => current && nextStaff.some((member) => member.staffId === current) ? current : nextStaff[0]?.staffId ?? "");
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not load staff accounts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [api, role, user]);

  useEffect(() => {
    if (authLoading || !user || role !== "ADMIN") return;
    queueMicrotask(() => { void loadStaff(); });
  }, [authLoading, loadStaff, role, user]);

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
      setError("Select a department before saving.");
      return;
    }
    setBusy(true);
    setSaved("");
    setError("");
    try {
      await api(`/staff/${selected.staffId}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, staffRole: selectedRole, department }),
      });
      setSaved(`Changes saved for ${selected.firstName} ${selected.lastName}.`);
      await loadStaff(true);
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not save this staff account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!selected || busy) return;
    setBusy(true);
    setSaved("");
    setError("");
    try {
      await api(`/staff/${selected.staffId}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, active: !selected.active }),
      });
      setSaved(`${selected.firstName} ${selected.lastName} is now ${selected.active ? "deactivated" : "active"}.`);
      await loadStaff(true);
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not change this account's status.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  if (!user || role !== "ADMIN") return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can manage staff accounts.</p>;

  return (
    <>
      <PageHeading eyebrow="Access management" title="Staff accounts" description="Manage staff profiles, roles, department assignments and account status." action={<Link href="/admin/staff/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"><Plus size={16} /> Add account</Link>} />
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" onClick={() => void loadStaff()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold">Retry</button></div>}
      {saved && <p role="status" className="mt-6 rounded-xl border border-success/20 bg-success-background p-4 text-sm font-semibold text-success">{saved}</p>}
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role or department" className="h-11 w-full rounded-lg border border-primary/25 bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /></div>{loading ? <p role="status" className="mt-6 text-sm text-neutral-500">Loading staff accounts...</p> : visibleStaff.length === 0 ? <p className="mt-6 rounded-lg bg-background p-4 text-sm text-neutral-600">No staff accounts match this search.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{visibleStaff.map((member) => { const name = `${member.firstName} ${member.lastName}`.trim(); return <tr key={member.staffId} onClick={() => { setSelectedId(member.staffId); setSaved(""); }} className={cx("cursor-pointer border-b border-primary/10 last:border-0 hover:bg-background", selectedId === member.staffId && "bg-accent-surface/50")}><td className="px-3 py-4"><span className="inline-flex items-center gap-2 font-semibold"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{`${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`}</span>{name}</span></td><td className="px-3 py-4">{member.staffRole}</td><td className="px-3 py-4">{member.department?.name ?? "Unassigned"}</td><td className="px-3 py-4"><StatusBadge active={Boolean(member.active)}>{member.active ? "Active" : "Deactivated"}</StatusBadge></td></tr>; })}</tbody></table></div>}</section>
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm">{selected ? <><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Edit profile</p><h2 className="mt-1 text-lg font-bold">{selected.firstName} {selected.lastName}</h2><p className="text-sm text-neutral-500">{selected.email}</p></div><Pencil size={18} className="text-neutral-500" /></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Role<select value={selectedRole} onChange={(event) => setStaffForm({ staffId: selectedId, role: event.target.value, departmentId: selectedDepartmentId })} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal"><option value="ADMIN">Admin</option><option value="DOCTOR">Doctor</option><option value="NURSE">Nurse</option><option value="RECEPTIONIST">Reception</option></select></label><label className="block text-sm font-semibold">Department<select value={selectedDepartmentId} onChange={(event) => setStaffForm({ staffId: selectedId, role: selectedRole, departmentId: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal"><option value="">Select department</option>{departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</select></label><div><p className="text-sm font-semibold">Weekly schedule</p><p className="mt-2 text-sm text-neutral-500">Schedule management will be connected when the staff schedule API is available.</p></div></div><div className="mt-7 flex gap-3"><button type="button" disabled={busy} onClick={() => void toggleActive()} className="min-h-10 flex-1 rounded-lg border border-error px-3 text-sm font-semibold text-error hover:bg-error-background disabled:opacity-50">{selected.active ? "Deactivate" : "Activate"}</button><button type="button" disabled={busy} onClick={() => void saveSelected()} className="min-h-10 flex-1 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button></div></> : <p className="text-sm text-neutral-600">Select a staff account to edit it.</p>}</section>
      </div>
    </>
  );
}

function DepartmentsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [departmentForm, setDepartmentForm] = useState<{ id: string; name: string; operatingHours: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const api = useMemo(() => createStaffApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
    refreshToken: async () => {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      const session = data.session;
      if (refreshError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
  }), [user?.id]);

  const loadDepartments = useCallback(async () => {
    if (!user || role !== "ADMIN") return;
    setLoading(true);
    setError("");
    try {
      const data = await api("/departments");
      const next = Array.isArray(data) ? data as AdminDepartment[] : [];
      setDepartments(next);
      setSelectedId((current) => current && next.some((item) => item.departmentId === current) ? current : next[0]?.departmentId ?? "");
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not load departments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [api, role, user]);

  useEffect(() => {
    if (authLoading || !user || role !== "ADMIN") return;
    queueMicrotask(() => { void loadDepartments(); });
  }, [authLoading, loadDepartments, role, user]);

  const selected = departments.find((item) => item.departmentId === selectedId) ?? null;
  // Form values follow the selected row, unless the user is editing them.
  const name = departmentForm?.id === selectedId ? departmentForm.name : (selected?.name ?? "");
  const operatingHours = departmentForm?.id === selectedId
    ? departmentForm.operatingHours
    : (selected?.operatingHours ?? "");

  async function saveDepartment() {
    if (!name.trim() || !operatingHours.trim() || busy) {
      setError("Department name and operating hours are required.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api(selected ? `/departments/${selected.departmentId}` : "/departments", {
        method: selected ? "PUT" : "POST",
        body: JSON.stringify({ ...(selected ?? {}), name: name.trim(), operatingHours: operatingHours.trim() }),
      });
      setSaved(selected ? "Department changes saved." : "Department created.");
      await loadDepartments();
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not save the department.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDepartment() {
    if (!selected || busy || !window.confirm(`Delete ${selected.name}?`)) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api(`/departments/${selected.departmentId}`, { method: "DELETE" });
      setSaved("Department deleted.");
      await loadDepartments();
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not delete the department.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <p role="status" className="mt-8 rounded-xl border border-primary/15 bg-surface p-5">Verifying administrator access...</p>;
  if (!user || role !== "ADMIN") return <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-error-background p-5 text-error">Only signed-in administrators can manage departments.</p>;

  return (
    <>
      <PageHeading eyebrow="Configuration" title="Departments" description="Manage hospital services and operating hours. Staff assignments are managed from staff accounts." action={<button type="button" onClick={() => { setSelectedId(""); setDepartmentForm(null); setSaved(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Plus size={16} /> Add department</button>} />
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" onClick={() => void loadDepartments()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold">Retry</button></div>}
      {saved && <p role="status" className="mt-6 rounded-xl border border-success/20 bg-success-background p-4 text-sm font-semibold text-success">{saved}</p>}
      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">{loading ? <p role="status" className="rounded-xl border border-primary/15 bg-surface p-5 text-sm text-neutral-500">Loading departments...</p> : departments.length === 0 ? <p className="rounded-xl border border-primary/15 bg-surface p-5 text-sm text-neutral-600">No departments have been created.</p> : departments.map((item) => <button type="button" key={item.departmentId} onClick={() => { setSelectedId(item.departmentId); setSaved(""); }} className={cx("flex w-full items-center justify-between rounded-xl border p-4 text-left transition", selectedId === item.departmentId ? "border-primary bg-accent-surface/60 shadow-sm" : "border-primary/15 bg-surface hover:border-primary/35")}><div><p className="font-bold">{item.name}</p><p className="mt-1 text-sm text-neutral-600">{item.operatingHours}</p></div><LayoutDashboard size={19} className="text-neutral-500" /></button>)}</section>
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{selected ? "Edit department" : "New department"}</p><h2 className="mt-1 text-lg font-bold">{selected?.name ?? "Create department"}</h2></div><LayoutDashboard size={19} className="text-neutral-500" /></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Department name<input value={name} onChange={(event) => setDepartmentForm({ id: selectedId, name: event.target.value, operatingHours })} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Operating hours<input value={operatingHours} onChange={(event) => setDepartmentForm({ id: selectedId, name, operatingHours: event.target.value })} placeholder="07:30 to 16:30" className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label></div><div className="mt-7 flex gap-3"><button type="button" disabled={!selected || busy} onClick={() => void deleteDepartment()} className="min-h-10 rounded-lg border border-error px-4 text-sm font-semibold text-error hover:bg-error-background disabled:opacity-50">Delete</button><button type="button" disabled={busy} onClick={() => void saveDepartment()} className="min-h-10 flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{busy ? "Saving..." : selected ? "Save changes" : "Create department"}</button></div></section>
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
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const api = useMemo(() => createStaffApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
    refreshToken: async () => {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      const session = data.session;
      if (refreshError || !session || session.user.id !== user?.id) return null;
      return session.access_token;
    },
  }), [user?.id]);

  const loadAudit = useCallback(async () => {
    if (!user || role !== "ADMIN") return;
    setLoading(true);
    setError("");
    try {
      const data = await api("/audit-logs");
      setEntries(Array.isArray(data) ? data as AuditEntry[] : []);
    } catch (cause) {
      setError(cause instanceof StaffApiError ? cause.message : "Could not load the audit log. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [api, role, user]);

  useEffect(() => {
    if (authLoading || !user || role !== "ADMIN") return;
    queueMicrotask(() => { void loadAudit(); });
  }, [authLoading, loadAudit, role, user]);

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
      <PageHeading eyebrow="Accountability" title="Audit log" description="Review administrative and operational changes. Log entries are read-only." action={<button type="button" onClick={exportLog} disabled={loading || visibleEntries.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary hover:bg-accent-surface disabled:opacity-50"><Download size={16} /> Export log</button>} />
      {error && <div role="alert" className="mt-6 rounded-xl border border-error/20 bg-error-background p-4 text-sm text-error"><p>{error}</p><button type="button" onClick={() => void loadAudit()} className="mt-3 rounded-lg border border-error/30 px-3 py-2 font-semibold">Retry</button></div>}
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
          {activePage === "departments" && <DepartmentsPage />}
          {activePage === "audit" && <AuditPage />}
        </>}
      </main>
    </div>
  );
}
