"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {useRouter} from "next/navigation";

export default function SigninPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleLogin(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setMessage(error.message);
        } else if (data.session) {
            setMessage("Login successful!");
            router.push("/patient");
        }

        setLoading(false);
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center">
                <div className="w-full max-w-md">
                    <Link
                        href="/"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary no-underline transition hover:text-primary-hover"
                    >
                        <ArrowLeft aria-hidden="true" size={18} />
                        Back to home
                    </Link>

                    <form
                        onSubmit={handleLogin}
                        className="mt-8 space-y-6 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm sm:p-8"
                    >
                        <div>
                            <div className="flex items-center gap-3 text-primary">
                                <HeartPulse aria-hidden="true" size={27} />
                                <span className="text-xl font-bold">CliniQ</span>
                            </div>
                            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                                Welcome back
                            </p>
                            <h1 className="mt-2 text-3xl font-bold tracking-tight">
                                Sign in to CliniQ
                            </h1>
                            <p className="mt-2 text-sm text-neutral-600">
                                Access your appointments, queue updates, and care information.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="signin-email" className="mb-1.5 block text-sm font-semibold">
                                    Email address
                                </label>
                                <input
                                    id="signin-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition placeholder:text-neutral-500 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label htmlFor="signin-password" className="mb-1.5 block text-sm font-semibold">
                                    Password
                                </label>
                                <input
                                    id="signin-password"
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition placeholder:text-neutral-500 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Sign in"}
                        </button>

                        {message && (
                            <p
                                role="status"
                                aria-live="polite"
                                className="rounded-lg border border-error/20 bg-error-background px-3 py-2.5 text-sm font-medium text-error"
                            >
                                {message}
                            </p>
                        )}

                        <p className="text-center text-sm text-neutral-600">
                            Don&apos;t have an account?{" "}
                            <Link href="/auth/signup" className="font-semibold text-primary hover:text-primary-hover">
                                Create one
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </main>
    );
}