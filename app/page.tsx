import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="flex w-full max-w-2xl flex-col items-center text-center">
        {/* Brand wordmark */}
        <h1 className="text-[3.25rem] font-bold leading-tight tracking-tight text-primary sm:text-6xl">
          CliniQ
        </h1>

        {/* Tagline */}
        <p className="mt-6 max-w-150 text-xl leading-8 text-neutral-600 sm:text-2xl sm:leading-9">
          Book appointments, check in with QR, and track your place in the
          queue at public outpatient departments.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/signin"
            className="flex h-12 w-full items-center justify-center rounded-md px-6 text-lg bg-primary font-semibold text-white no-underline shadow-sm transition hover:bg-primary-hover sm:w-auto"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="flex h-12 w-full items-center justify-center rounded-md border-2 border-primary bg-transparent px-6 text-lg font-semibold text-primary no-underline transition hover:bg-accent-surface active:bg-accent-surface sm:w-auto"
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
