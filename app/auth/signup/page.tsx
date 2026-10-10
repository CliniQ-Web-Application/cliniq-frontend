"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
                router.push("/patientTest");
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
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <form
                onSubmit={handleSignup}
                className="w-full max-w-md space-y-5 rounded-xl border bg-white p-8 shadow-sm"
            >
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Create an account
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign up using your email address and password.
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium">
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
                        className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        minLength={6}
                        required
                        className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium">
                        Confirm password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        required
                        className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                </div>

                {message && (
                    <p role="status" aria-live="polite" className="rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
                        {message}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? "Creating account..." : "Sign up"}
                </button>

                <p className="text-center text-sm text-gray-600">
                    Already have an account?{" "}
                    <a href="/login" className="font-medium text-blue-600 hover:underline">
                        Sign in
                    </a>
                </p>
            </form>
        </main>
    );
}