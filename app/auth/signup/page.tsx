"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
    const router = useRouter();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [nationalID, setNationalID] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSignup(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setMessage("");
        setIsError(false);

        if (!firstName.trim() || !lastName.trim()) {
            setIsError(true);
            setMessage("Please enter your full first name and surname.");
            return;
        }

        if (!nationalID.trim()) {
            setIsError(true);
            setMessage("National ID (Omang) is required.");
            return;
        }

        if (password !== confirmPassword) {
            setIsError(true);
            setMessage("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setIsError(true);
            setMessage("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            const cleanEmail = email.trim();
            const cleanFirstName = firstName.trim();
            const cleanLastName = lastName.trim();
            const cleanNationalID = nationalID.trim();
            const cleanPhone = phone.trim();

            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        first_name: cleanFirstName,
                        last_name: cleanLastName,
                        name: `${cleanFirstName} ${cleanLastName}`,
                        national_id: cleanNationalID,
                        phone: cleanPhone,
                    },
                },
            });

            if (error) {
                setIsError(true);
                setMessage(error.message);
                return;
            }

            if (data.session && data.user) {
                // Patient details are reviewed and saved through /api/patients/me when booking.
                setMessage("Patient account created successfully! Redirecting...");
                router.push("/patient");
            } else {
                setMessage(
                    "Account registered! If confirmation is required, please check your email, then sign in."
                );
            }
        } catch {
            setIsError(true);
            setMessage("Something went wrong during sign up. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-lg space-y-6 rounded-2xl border border-primary/20 bg-surface p-6 shadow-sm sm:p-8">
                <div>
                    <Link
                        href="/"
                        className="inline-flex text-xs font-semibold text-primary transition hover:underline"
                    >
                        ← Back to home
                    </Link>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                        Patient Registration
                    </h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Create an account to manage appointments, check-in, and view queues.
                    </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    {/* Names (2 cols on sm) */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label htmlFor="firstName" className="block text-xs font-semibold text-foreground">
                                First Name
                            </label>
                            <input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="e.g. Lesedi"
                                required
                                className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="lastName" className="block text-xs font-semibold text-foreground">
                                Surname / Last Name
                            </label>
                            <input
                                id="lastName"
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="e.g. Molefe"
                                required
                                className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* National ID & Phone */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label htmlFor="nationalID" className="block text-xs font-semibold text-foreground">
                                National ID (Omang)
                            </label>
                            <input
                                id="nationalID"
                                type="text"
                                value={nationalID}
                                onChange={(e) => setNationalID(e.target.value)}
                                placeholder="e.g. 123456789"
                                required
                                className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="phone" className="block text-xs font-semibold text-foreground">
                                Phone Number
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+267 71 234 567"
                                required
                                className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                        <label htmlFor="email" className="block text-xs font-semibold text-foreground">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    {/* Passwords */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label htmlFor="password" className="block text-xs font-semibold text-foreground">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 6 chars"
                                minLength={6}
                                required
                                className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-foreground">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                minLength={6}
                                required
                                className="h-10 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 flex w-full min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Registering patient account..." : "Complete Registration"}
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

                <div className="border-t border-primary/10 pt-3 text-center text-xs text-neutral-600">
                    Already registered?{" "}
                    <Link
                        href="/auth/signin"
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                        Sign in to patient portal
                    </Link>
                </div>
            </div>
        </main>
    );
}
