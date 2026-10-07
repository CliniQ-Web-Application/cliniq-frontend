import Link from "next/link";
import { ArrowLeft, Building2, Settings, Users, BarChart3, AlertCircle, CheckCircle2 } from "lucide-react";

const metrics = [
  { label: "Active staff", value: "24", icon: Users, trend: "+2 this week" },
  { label: "Clinic locations", value: "3", icon: Building2, trend: "All operational" },
  { label: "Open settings", value: "8", icon: Settings, trend: "3 require review" },
];

const recentActivity = [
  { icon: CheckCircle2, text: "Clinic A — queue cleared", time: "2 min ago", color: "text-success" },
  { icon: AlertCircle, text: "Staff shortage flagged at Clinic B", time: "14 min ago", color: "text-error" },
  { icon: BarChart3, text: "Daily report generated", time: "1 hr ago", color: "text-primary" },
];

export default function AdminPortal() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1280px]">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary no-underline transition hover:text-primary-hover"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Back to portals
        </Link>

        {/* Page header */}
        <header className="mt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            Admin portal
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">
            Clinic overview
          </h1>
          <p className="mt-4 max-w-[70ch] text-lg text-neutral-600">
            Manage the people and settings that keep CliniQ running.
          </p>
        </header>

        {/* Metric cards */}
        <section
          aria-label="Clinic metrics"
          className="mt-10 grid gap-4 sm:grid-cols-3"
        >
          {metrics.map(({ label, value, icon: Icon, trend }) => (
            <article
              key={label}
              className="rounded-xl border border-primary/20 bg-surface p-6 shadow-sm"
            >
              <span className="flex w-fit items-center justify-center rounded-lg bg-accent-surface p-3">
                <Icon aria-hidden="true" className="text-primary" size={22} />
              </span>
              <p className="mt-5 text-3xl font-bold">{value}</p>
              <p className="mt-1 font-medium text-neutral-800">{label}</p>
              <p className="mt-1 text-sm text-neutral-500">{trend}</p>
            </article>
          ))}
        </section>

        {/* Recent activity */}
        <section aria-label="Recent activity" className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Recent activity</h2>
          <ul className="space-y-3">
            {recentActivity.map(({ icon: Icon, text, time, color }) => (
              <li
                key={text}
                className="flex items-center gap-4 rounded-xl border border-primary/20 bg-surface px-5 py-4 shadow-sm"
              >
                <Icon aria-hidden="true" className={`shrink-0 ${color}`} size={20} />
                <span className="flex-1 text-sm font-medium">{text}</span>
                <span className="shrink-0 text-xs text-neutral-500">{time}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
