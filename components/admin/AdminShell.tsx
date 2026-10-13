"use client";

import Link from "next/link";
import { useState } from "react";
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

const navigation: { label: string; href: string; page: AdminPage; icon: typeof BarChart3 }[] = [
  { label: "Analytics", href: "/admin", page: "analytics", icon: BarChart3 },
  { label: "Queues", href: "/admin/queues", page: "queues", icon: Activity },
  { label: "Staff", href: "/admin/staff", page: "staff", icon: Users },
  { label: "Departments", href: "/admin/departments", page: "departments", icon: LayoutDashboard },
  { label: "Audit log", href: "/admin/audit-log", page: "audit", icon: FileText },
];

const staff = [
  { name: "Dr. Molefe", role: "Doctor", department: "General", status: "Active", initials: "DM" },
  { name: "Dr. Kgosi", role: "Doctor", department: "Paediatrics", status: "Active", initials: "DK" },
  { name: "N. Seretse", role: "Nurse", department: "General", status: "Active", initials: "NS" },
  { name: "Dr. Percy", role: "Doctor", department: "Dental", status: "Deactivated", initials: "DP" },
];

const departments = [
  { name: "General practice", hours: "07:30 to 16:30", staff: 5, active: true },
  { name: "Paediatrics", hours: "07:30 to 16:30", staff: 3, active: true },
  { name: "Eye clinic", hours: "00:00 to 23:30", staff: 6, active: true },
  { name: "Dental", hours: "08:00 to 14:00", staff: 2, active: false },
];

const queue = [
  { position: 1, patient: "M. Dube", department: "General", status: "In consultation", wait: "Now" },
  { position: 2, patient: "K. Phiri", department: "Paediatrics", status: "Waiting", wait: "8 min" },
  { position: 3, patient: "P. Tau", department: "General", status: "Waiting", wait: "15 min" },
  { position: 4, patient: "L. Madi", department: "Dental", status: "Checked-in", wait: "22 min" },
];

const auditEntries = [
  { date: "05/10/2026 09:45", action: "Priority change", patient: "M. Dube", by: "A. Sephiri (Admin)", reason: "Pregnant, bleeding", change: "Position 2 to 1" },
  { date: "05/10/2026 10:00", action: "Priority change", patient: "K. Phiri", by: "Dr. Seretse (Doctor)", reason: "Infant with high fever", change: "Position 4 to 2" },
  { date: "03/10/2026 14:03", action: "Status change", patient: "P. Tau", by: "S. Thaku (Nurse)", reason: "Elderly patient, fainting", change: "Waiting to Consultation" },
  { date: "02/10/2026 11:27", action: "Cancellation", patient: "L. Madi", by: "A. Sephiri (Admin)", reason: "Patient request", change: "Scheduled to Cancelled" },
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
            A. Sephiri · Admin
          </span>
          <button type="button" className="hidden min-h-10 items-center gap-2 rounded-lg border border-primary/25 px-3 text-sm font-semibold text-primary transition hover:bg-accent-surface sm:flex">
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
  const [range, setRange] = useState("1 Oct – 7 Oct");
  return (
    <>
      <PageHeading
        eyebrow="Hospital overview"
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

function QueuePage() {
  const [selectedDepartment, setSelectedDepartment] = useState("All departments");
  const [called, setCalled] = useState(false);
  return (
    <>
      <PageHeading eyebrow="Live operations" title="Hospital queues" description="Monitor the current queue across departments. Queue actions remain under staff control." action={<button type="button" onClick={() => setCalled(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"><Activity size={16} /> Call next patient</button>} />
      {called && <div className="mt-6 flex items-center justify-between rounded-xl border border-success/20 bg-success-background px-4 py-3 text-sm font-semibold text-success"><span>Next eligible patient has been called in General practice.</span><button type="button" onClick={() => setCalled(false)} aria-label="Dismiss notification"><X size={16} /></button></div>}
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">Waiting now</p><p className="mt-2 text-3xl font-bold">3</p></div><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">In consultation</p><p className="mt-2 text-3xl font-bold">1</p></div><div className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><p className="text-sm text-neutral-500">Average wait</p><p className="mt-2 text-3xl font-bold">18 min</p></div></div>
      <section className="mt-5 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-bold">Current queue</h2><select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="h-10 rounded-lg border border-primary/25 bg-background px-3 text-sm"><option>All departments</option><option>General</option><option>Paediatrics</option><option>Dental</option></select></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3">Position</th><th className="px-3 py-3">Patient</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Estimated wait</th><th className="px-3 py-3">Action</th></tr></thead><tbody>{queue.filter((item) => selectedDepartment === "All departments" || item.department === selectedDepartment).map((item) => <tr key={item.patient} className="border-b border-primary/10 last:border-0"><td className="px-3 py-4 font-bold text-primary">#{item.position}</td><td className="px-3 py-4 font-semibold">{item.patient}</td><td className="px-3 py-4">{item.department}</td><td className="px-3 py-4"><span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", item.status === "In consultation" ? "bg-accent-surface text-primary" : "bg-background text-neutral-600")}>{item.status}</span></td><td className="px-3 py-4">{item.wait}</td><td className="px-3 py-4"><button type="button" className="rounded-lg border border-primary/25 px-3 py-2 text-xs font-semibold text-primary hover:bg-accent-surface">View</button></td></tr>)}</tbody></table></div></section>
    </>
  );
}

function StaffPage() {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState("Dr. Molefe");
  const [saved, setSaved] = useState(false);
  const selected = staff.find((member) => member.name === selectedName) ?? staff[0];
  const visibleStaff = staff.filter((member) => `${member.name} ${member.role} ${member.department}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <PageHeading eyebrow="Access management" title="Staff accounts" description="Manage staff profiles, roles, department assignments and account status." action={<button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"><Plus size={16} /> Add account</button>} />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role or department" className="h-11 w-full rounded-lg border border-primary/25 bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-primary/15 text-neutral-500"><tr><th className="px-3 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{visibleStaff.map((member) => <tr key={member.name} onClick={() => { setSelectedName(member.name); setSaved(false); }} className={cx("cursor-pointer border-b border-primary/10 last:border-0 hover:bg-background", selectedName === member.name && "bg-accent-surface/50")}><td className="px-3 py-4"><span className="inline-flex items-center gap-2 font-semibold"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{member.initials}</span>{member.name}</span></td><td className="px-3 py-4">{member.role}</td><td className="px-3 py-4">{member.department}</td><td className="px-3 py-4"><StatusBadge active={member.status === "Active"}>{member.status}</StatusBadge></td></tr>)}</tbody></table></div></section>
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Edit profile</p><h2 className="mt-1 text-lg font-bold">{selected.name}</h2></div><Pencil size={18} className="text-neutral-500" /></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Role<select className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal"><option>{selected.role}</option><option>Admin</option><option>Nurse</option><option>Reception</option></select></label><label className="block text-sm font-semibold">Department<select className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal"><option>{selected.department}</option><option>General</option><option>Paediatrics</option><option>Dental</option><option>Eye clinic</option></select></label><div><p className="text-sm font-semibold">Weekly schedule</p><div className="mt-2 flex flex-wrap gap-2">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <button type="button" key={day} className="rounded-md bg-accent-surface px-2.5 py-1.5 text-xs font-semibold text-primary">{day}</button>)}</div></div></div><div className="mt-7 flex gap-3"><button type="button" className="min-h-10 flex-1 rounded-lg border border-error px-3 text-sm font-semibold text-error hover:bg-error-background">Deactivate</button><button type="button" onClick={() => setSaved(true)} className="min-h-10 flex-1 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover">Save changes</button></div>{saved && <p className="mt-3 text-center text-sm font-semibold text-success">Changes saved for {selected.name}.</p>}</section>
      </div>
    </>
  );
}

function DepartmentsPage() {
  const [selected, setSelected] = useState("General practice");
  const [saved, setSaved] = useState(false);
  const department = departments.find((item) => item.name === selected) ?? departments[0];
  return (
    <>
      <PageHeading eyebrow="Configuration" title="Departments" description="Manage hospital services, operating hours and the staff assigned to each department." action={<button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Plus size={16} /> Add department</button>} />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">{departments.map((item) => <button type="button" key={item.name} onClick={() => { setSelected(item.name); setSaved(false); }} className={cx("flex w-full items-center justify-between rounded-xl border p-4 text-left transition", selected === item.name ? "border-primary bg-accent-surface/60 shadow-sm" : "border-primary/15 bg-surface hover:border-primary/35")}><div><p className="font-bold">{item.name}</p><p className="mt-1 text-sm text-neutral-600">{item.hours}, {item.staff} staff</p></div><StatusBadge active={item.active}>{item.active ? "Active" : "Inactive"}</StatusBadge></button>)}</section>
        <section className="rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Edit department</p><h2 className="mt-1 text-lg font-bold">{department.name}</h2></div><LayoutDashboard size={19} className="text-neutral-500" /></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Department name<input defaultValue={department.name} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Operating hours<input defaultValue={department.hours} className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label><label className="block text-sm font-semibold">Assigned doctors and staff<input defaultValue="Dr. Molefe, N. Seretse, K. Moses" className="mt-1.5 h-11 w-full rounded-lg border border-primary/25 bg-background px-3 font-normal" /></label></div><button type="button" onClick={() => setSaved(true)} className="mt-7 min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Save changes</button>{saved && <p className="mt-3 text-sm font-semibold text-success">Department changes saved.</p>}</section>
      </div>
    </>
  );
}

function AuditPage() {
  const [action, setAction] = useState("All actions");
  const visibleEntries = auditEntries.filter((entry) => action === "All actions" || entry.action === action);
  return (
    <>
      <PageHeading eyebrow="Accountability" title="Audit log" description="Review administrative and operational changes. Log entries are read-only." action={<button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary hover:bg-accent-surface"><Download size={16} /> Export log</button>} />
      <section className="mt-8 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-4"><label className="text-sm font-semibold">From<input type="date" defaultValue="2026-10-01" className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">To<input type="date" defaultValue="2026-10-07" className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal" /></label><label className="text-sm font-semibold">Action<select value={action} onChange={(event) => setAction(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal"><option>All actions</option><option>Priority change</option><option>Status change</option><option>Cancellation</option></select></label><label className="text-sm font-semibold">User<select className="mt-1.5 h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal"><option>All users</option><option>A. Sephiri</option><option>Dr. Seretse</option></select></label></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-primary/15 bg-background text-neutral-600"><tr><th className="px-3 py-3">Date and time</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Patient</th><th className="px-3 py-3">Done by</th><th className="px-3 py-3">Reason</th><th className="px-3 py-3">Change</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={`${entry.date}-${entry.patient}`} className="border-b border-primary/10 last:border-0"><td className="px-3 py-4 whitespace-nowrap">{entry.date}</td><td className="px-3 py-4"><span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs font-semibold"><ShieldCheck size={13} />{entry.action}</span></td><td className="px-3 py-4 font-semibold">{entry.patient}</td><td className="px-3 py-4">{entry.by}</td><td className="px-3 py-4">{entry.reason}</td><td className="px-3 py-4">{entry.change}</td></tr>)}</tbody></table></div><p className="mt-5 flex items-center gap-2 text-sm text-neutral-500"><ShieldCheck size={16} /> Log entries are read-only.</p></section>
    </>
  );
}

export default function AdminShell({ activePage }: { activePage: AdminPage }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader activePage={activePage} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {activePage === "analytics" && <AnalyticsPage />}
        {activePage === "queues" && <QueuePage />}
        {activePage === "staff" && <StaffPage />}
        {activePage === "departments" && <DepartmentsPage />}
        {activePage === "audit" && <AuditPage />}
      </main>
    </div>
  );
}
