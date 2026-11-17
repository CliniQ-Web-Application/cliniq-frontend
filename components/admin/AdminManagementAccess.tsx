"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { createStaffApi, StaffApiError } from "@/lib/staff";
import { adminError, parseDoctor, parseDoctors, parseDepartments, type AdminDoctor, type AdminDepartment } from "@/lib/admin-management";

export type AdminRequest = (path: string, init?: RequestInit) => Promise<unknown>;
const RequestContext = createContext<AdminRequest | null>(null);
export function useAdminRequest(): AdminRequest {
  const request = useContext(RequestContext);
  if (!request) throw new Error("Administrator access must be verified before making requests.");
  return request;
}
export const adminInput = "mt-1 block min-h-11 w-full rounded-lg border border-primary/25 bg-background px-3 text-sm font-normal";
export const adminButton = "min-h-11 rounded-lg border border-primary/25 px-4 py-2 text-sm font-semibold hover:bg-accent-surface disabled:cursor-not-allowed disabled:opacity-50";
export const adminPrimaryButton = `${adminButton} bg-primary text-white hover:bg-primary-hover`;
export const adminPanel = "mt-6 rounded-xl border border-primary/15 bg-surface p-5 shadow-sm";
export function AdminMessages({ error, success }: { error: string; success?: string }) {
  return <>
    {error && <p role="alert" className="mt-5 rounded-lg border border-error/20 bg-error-background p-4 text-sm text-error">{error}</p>}
    {success && <p role="status" className="mt-5 rounded-lg bg-success-background p-4 text-sm text-success">{success}</p>}
  </>;
}

function VerifiedAdmin({ userId, staffId, children }: { userId: string; staffId: string; children: ReactNode }) {
  const lifetime = useRef<AbortController | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const api = useMemo(() => {
    const token = async (refresh = false) => {
      if (!lifetime.current || lifetime.current.signal.aborted) throw new DOMException("Session changed", "AbortError");
      const { data, error: sessionError } = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
      return !sessionError && data.session?.user.id === userId ? data.session.access_token : null;
    };
    const request = createStaffApi({
      baseUrl: process.env.NEXT_PUBLIC_API_URL,
      getToken: () => token(), refreshToken: () => token(true),
      forbiddenMessage: "Only active administrators can use this manager.",
    });
    return async (path: string, init: RequestInit = {}) => {
      const sessionSignal = lifetime.current?.signal;
      if (!sessionSignal) throw new DOMException("Session unavailable", "AbortError");
      const signal = init.signal ? AbortSignal.any([sessionSignal, init.signal]) : sessionSignal;
      signal.throwIfAborted();
      try {
        const result = await request(path, { ...init, signal });
        signal.throwIfAborted();
        if (!await token()) throw new StaffApiError("Your session changed. Please sign in again.", 401);
        signal.throwIfAborted();
        return result;
      } catch (cause) {
        if (!signal.aborted && cause instanceof StaffApiError && (cause.status === 401 || cause.status === 403)) {
          setVerified(false);
          setError(adminError(cause));
        }
        throw cause;
      }
    };
  }, [lifetime, userId]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    // Stop in-flight work immediately on logout, even before AuthContext finishes updating.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        controller.abort();
        setVerified(false);
        setError("Your session changed. Please sign in again.");
      }
    });
    return () => { subscription.unsubscribe(); controller.abort(); };
  }, [userId]);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void api(`/staff/${encodeURIComponent(staffId)}`, { signal: controller.signal }).then((value) => {
      const member = parseDoctor(value);
      if (member.staffId !== staffId || member.staffRole !== "ADMIN" || !member.active) throw new Error("Only active administrators can use this manager.");
      if (!controller.signal.aborted) setVerified(true);
    }).catch((cause) => {
      if (!controller.signal.aborted && !lifetime.current?.signal.aborted) setError(adminError(cause));
    });
    return () => controller.abort();
  }, [api, staffId, attempt, lifetime]);

  if (error) return <section className={adminPanel}><AdminMessages error={error} /><button className={`${adminButton} mt-4`} onClick={() => setAttempt((value) => value + 1)}>Retry access check</button></section>;
  if (!verified) return <p role="status" className={adminPanel}>Verifying active administrator access...</p>;
  return <RequestContext.Provider value={api}>{children}</RequestContext.Provider>;
}

export default function AdminManagementAccess({ children }: { children: ReactNode }) {
  const { user, profile, role, loading } = useAuth();
  if (loading) return <p role="status" className={adminPanel}>Verifying administrator session...</p>;
  if (!user || profile?.id !== user.id || role !== "ADMIN" || !profile.staffId) return <p role="alert" className={adminPanel}>Only signed-in active administrators can use this manager.</p>;
  return <VerifiedAdmin key={`${user.id}:${profile.staffId}`} userId={user.id} staffId={profile.staffId}>{children}</VerifiedAdmin>;
}

// Each effect owns its controller; consumers also check it before updating state.
export function useAdminChoices() {
  const api = useAdminRequest();
  const [choices, setChoices] = useState<{ doctors: AdminDoctor[]; departments: AdminDepartment[] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void Promise.all([api("/staff", { signal: controller.signal }), api("/departments", { signal: controller.signal })])
      .then(([staff, departments]) => {
        if (!controller.signal.aborted) setChoices({ doctors: parseDoctors(staff), departments: parseDepartments(departments) });
      }).catch((cause) => { if (!controller.signal.aborted) setError(adminError(cause)); });
    return () => controller.abort();
  }, [api, attempt]);
  return { choices, error, retry };
}
