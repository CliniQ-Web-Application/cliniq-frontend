"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PatientsPage() {
    const [patients, setPatients] = useState<unknown[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPatients() {
            try {
                const {
                    data: { session },
                    error: sessionError,
                } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (!session) {
                    setError("Please sign in first.");
                    return;
                }

                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/patients`,
                    {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }
                );

                if (!response.ok) {
                    const body = await response.text();

                    console.error("Patients API error:", {
                        status: response.status,
                        body,
                    });

                    console.log(session.access_token)

                    throw new Error(`API request failed: ${response.status} - ${body}`);
                }

                const data = await response.json();

                setPatients(Array.isArray(data) ? data : [data]);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Something went wrong."
                );
            } finally {
                setLoading(false);
            }
        }

        fetchPatients();
    }, []);

    if (loading) return <p>Loading patients...</p>;
    if (error) return <p>{error}</p>;

    return (
        <main className="p-8">
            <h1 className="text-2xl font-bold">Patients</h1>

            <pre className="mt-4 overflow-auto rounded bg-gray-100 p-4">
                {JSON.stringify(patients, null, 2)}
            </pre>
        </main>
    );
}