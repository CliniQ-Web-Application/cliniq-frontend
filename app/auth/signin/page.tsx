"use client";

import React, { useState } from "react";
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
        <main className="min-h-screen flex items-center justify-center p-6">
            <form
                onSubmit={handleLogin}
                className="w-full max-w-sm space-y-4"
            >
                <h1 className="text-2xl font-bold">Sign in</h1>

                <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded border p-3"
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded border p-3"
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded bg-blue-600 p-3 text-white disabled:opacity-50"
                >
                    {loading ? "Signing in..." : "Sign in"}
                </button>

                {message && <p role="status">{message}</p>}
            </form>
        </main>
    );
}