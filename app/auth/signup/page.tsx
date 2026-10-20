"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSignup(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setMessage("");

        if (password !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setMessage("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            });

            if (error) {
                setMessage(error.message);
                return;
            }

            if (data.session) {
                setMessage("Account created successfully. Redirecting...");
                router.push("/patient");
            } else {
                setMessage(
                    "Account created! Check your email to confirm your account, then sign in."
                );
            }
        } catch {
            setMessage("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
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
                        onSubmit={handleSignup}
                        className="mt-8 space-y-6 rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm sm:p-8"
                    >
                        <div>
                            <div className="flex items-center gap-3 text-primary">
                                <HeartPulse aria-hidden="true" size={27} />
                                <span className="text-xl font-bold">CliniQ</span>
                            </div>
                            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                                Get started
                            </p>
                            <h1 className="mt-2 text-3xl font-bold tracking-tight">
                                Create an account
                            </h1>
                            <p className="mt-2 text-sm text-neutral-600">
                                Sign up with your email address and a password.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="signup-email" className="mb-1.5 block text-sm font-semibold">
                                    Email address
                                </label>
                                <input
                                    id="signup-email"
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
                                <label htmlFor="signup-password" className="mb-1.5 block text-sm font-semibold">
                                    Password
                                </label>
                                <input
                                    id="signup-password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="At least 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={6}
                                    required
                                    className="h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition placeholder:text-neutral-500 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label htmlFor="signup-confirm-password" className="mb-1.5 block text-sm font-semibold">
                                    Confirm password
                                </label>
                                <input
                                    id="signup-confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                            {loading ? "Creating account..." : "Sign up"}
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
                            Already have an account?{" "}
                            <Link href="/auth/signin" className="font-semibold text-primary hover:text-primary-hover">
                                Sign in
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </main>
    );
}