
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {Department} from "@/types/Department";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const inputClass = "w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export default function StaffRegistrationPage() {
    const [staffName, setStaffName] = useState("");
    const [staffSurname, setStaffSurname] = useState("");
    const [email, setEmail] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [role, setRole] = useState("DOCTOR");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [departments, setDepartments] = useState<Department[]>([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(true);

    useEffect(() => {
        async function loadDepartments() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) throw error;
                if (!session) throw new Error("Please sign in first.");
                if (!API_URL) throw new Error("API URL is not configured.");

                const response = await fetch(
                    `${API_URL}/api/departments`,
                    {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Could not load departments (${response.status}).`
                    );
                }

                const data: Department[] = await response.json();
                setDepartments(data);
            } catch (error) {
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Could not load departments."
                );
            } finally {
                setLoadingDepartments(false);
            }
        }

        loadDepartments();
    }, []);

    async function handleSubmit( e: React.SubmitEvent<HTMLFormElement> ) {
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

        if (!departmentId) {
            setMessage("Please select a department.");
            return;
        }

        setLoading(true);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            if (!session) throw new Error("Please sign in first.");
            if (!API_URL) throw new Error("API URL is not configured.");

            const response = await fetch(
                `${API_URL}/api/staff/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        firstName: staffName.trim(),
                        lastName: staffSurname.trim(),
                        email: email.trim(),
                        departmentId,
                        staffRole: role,
                        password,
                    }),
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error( result.message ?? `Registration failed (${response.status}).` );
            }

            setMessage("Staff account created successfully.");

            setStaffName("");
            setStaffSurname("");
            setEmail("");
            setDepartmentId("");
            setRole("DOCTOR");
            setPassword("");
            setConfirmPassword("");
        } catch (error) {
            setMessage( error instanceof Error ? error.message : "Something went wrong." );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md space-y-5 rounded-xl border bg-white p-8 shadow-sm"
            >
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Register staff
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Create a staff member&apos;s CliniQ account.
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="staffName" className="block text-sm font-medium">
                        First name
                    </label>
                    <input
                        id="staffName"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        autoComplete="given-name"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="staffSurname" className="block text-sm font-medium">
                        Surname
                    </label>
                    <input
                        id="staffSurname"
                        value={staffSurname}
                        onChange={(e) => setStaffSurname(e.target.value)}
                        autoComplete="family-name"
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className={inputClass}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="department" className="block text-sm font-medium">
                        Department
                    </label>
                    <select
                        id="department"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={loadingDepartments || departments.length === 0}
                        required
                        className={inputClass}
                    >
                        <option value="">
                            {loadingDepartments
                                ? "Loading departments..."
                                : departments.length === 0
                                    ? "No departments available"
                                    : "Select a department"}
                        </option>

                        {departments.map((department) => (
                            <option
                                key={department.departmentId}
                                value={department.departmentId}
                            >
                                {department.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="role" className="block text-sm font-medium">
                        Staff role
                    </label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className={inputClass}
                    >
                        <option value="DOCTOR">Doctor</option>
                        <option value="NURSE">Nurse</option>
                        <option value="RECEPTIONIST">Receptionist</option>
                        <option value="ADMIN">Administrator</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium">
                        Initial password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
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
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        required
                        className={inputClass}
                    />
                </div>

                {message && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="break-words rounded-lg bg-gray-100 p-3 text-sm text-gray-700"
                    >
                        {message}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading || loadingDepartments || departments.length === 0}
                    className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "Creating account..." : "Register staff"}
                </button>
            </form>
        </main>
    );
}
