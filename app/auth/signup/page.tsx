
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
    const router = useRouter();

    const [patientName, setPatientName] = useState("");
    const [patientSurname, setPatientSurname] = useState("");
    const [nationalID, setNationalID] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSignup(
        e: React.SubmitEvent<HTMLFormElement>
    ) {
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

        if (!/^\d+$/.test(nationalID.trim())) {
            setMessage("National ID must contain only numbers.");
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

            if (!data.session) {
                setMessage(
                    "Account created. Confirm your email and sign in to finish creating your patient profile."
                );
                return;
            }

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/patients`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session.access_token}`,
                    },
                    body: JSON.stringify({
                        patientName: patientName.trim(),
                        patientSurname: patientSurname.trim(),
                        nationalID: Number(nationalID),
                        patientEmail: email.trim(),
                        phone: phone.trim(),
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();

                throw new Error(
                    `Your Auth account was created, but the patient profile could not be saved (${response.status}). ${
                        errorText || "Please try signing in and completing your profile."
                    }`
                );
            }

            setMessage("Account and patient profile created successfully.");
            router.push("/patientTest");
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    const inputClass = "w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

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
                        Enter your details to create your CliniQ patient account.
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="patientName" className="block text-sm font-medium">
                        First name
                    </label>
                    <input
                        id="patientName"
                        type="text"
                        autoComplete="given-name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="First name"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="patientSurname" className="block text-sm font-medium">
                        Surname
                    </label>
                    <input
                        id="patientSurname"
                        type="text"
                        autoComplete="family-name"
                        value={patientSurname}
                        onChange={(e) => setPatientSurname(e.target.value)}
                        placeholder="Surname"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="nationalID" className="block text-sm font-medium">
                        National ID
                    </label>
                    <input
                        id="nationalID"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={nationalID}
                        onChange={(e) => setNationalID(e.target.value)}
                        placeholder="Enter your national ID"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="phone" className="block text-sm font-medium">
                        Phone number
                    </label>
                    <input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+267 7X XXX XXX"
                        required
                        className={inputClass}
                    />
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
                        className={inputClass}
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
                        className={inputClass}
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
                        minLength={6}
                        required
                        className={inputClass}
                    />
                </div>

                {message && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="wrap-break-word rounded-lg bg-gray-100 p-3 text-sm text-gray-700"
                    >
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
                    <a
                        href="/auth/signin"
                        className="font-medium text-blue-600 hover:underline"
                    >
                        Sign in
                    </a>
                </p>
            </form>
        </main>
    );
}
