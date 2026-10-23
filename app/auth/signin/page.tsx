"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchUserProfile, getRoleDestination, isRouteAllowed } from "@/lib/auth";

function SigninForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleLogin(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setIsError(false);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) {
                setIsError(true);
                setMessage(error.message);
                setLoading(false);
                return;
            }

            if (data.session && data.user) {
                setMessage("Login successful! Identifying role and redirecting...");
                
                // Identify the user and their role under RLS
                const profile = await fetchUserProfile(data.user.id);
                const role = profile.role;
                const defaultDest = getRoleDestination(role);

                const redirectParam = searchParams.get("redirect");
                if (redirectParam && isRouteAllowed(redirectParam, role)) {
                    router.push(redirectParam);
                } else {
                    router.push(defaultDest);
                }
            }
        } catch (err) {
            setIsError(true);
            setMessage(
                err instanceof Error ? err.message : "An unexpected error occurred during sign in."
            );
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-primary/20 bg-surface p-8 shadow-sm">
                <div>
                    <Link
                        href="/"
                        className="inline-flex text-xs font-semibold text-primary transition hover:underline"
                    >
                        ← Back to home
                    </Link>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                        Sign in to CliniQ
                    </h1>
                    <p className="mt-2 text-sm text-neutral-600">
                        Enter your credentials to access your portal.
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <label
                            htmlFor="email"
                            className="block text-sm font-semibold text-foreground"
                        >
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-lg border border-primary/25 bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label
                            htmlFor="password"
                            className="block text-sm font-semibold text-foreground"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-lg border border-primary/25 bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>

                    {message && (
                        <div
                            role="status"
                            className={`rounded-lg p-3 text-sm font-medium ${
                                isError
                                    ? "border border-red-200 bg-red-50 text-red-700"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            }`}
                        >
                            {message}
                        </div>
                    )}
                </form>

                <div className="border-t border-primary/10 pt-4 text-center text-sm text-neutral-600">
                    Don&apos;t have an account?{" "}
                    <Link
                        href="/auth/signup"
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                        Create patient account
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function SigninPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        }>
            <SigninForm />
        </Suspense>
    );
}
