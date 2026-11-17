"use client";

import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Replaces short polling with Supabase Realtime `postgres_changes` events.
 * Any change to a clinic table invalidates the affected TanStack Query keys;
 * mounted pages then refetch once from the shared cache instead of every 15s.
 *
 * Tables must be part of the `supabase_realtime` publication (see the Flyway
 * migration V20261116_01) and readable under the caller's RLS policies.
 */
export function startClinicRealtime(queryClient: QueryClient): () => void {
  const invalidate = (prefixes: string[][]) =>
    Promise.all(prefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const channel = supabase
    .channel("clinic-cache")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointment" }, () =>
      invalidate([
        ["bookings"],
        ["staff"],
        ["admin"],
        ["analytics"],
      ]))
    .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () =>
      invalidate([
        ["bookings"],
        ["staff"],
        ["admin"],
      ]))
    .on("postgres_changes", { event: "*", schema: "public", table: "notification" }, () =>
      invalidate([["notifications"]]))
    .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () =>
      invalidate([["staff"]]))
    .on("postgres_changes", { event: "*", schema: "public", table: "department" }, () =>
      invalidate([["departments"], ["admin"], ["analytics"]]))
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule" }, () =>
      invalidate([["bookings"], ["staff"]]))
    .on("postgres_changes", { event: "*", schema: "public", table: "auditLogs" }, () =>
      invalidate([["audit"]]))
    .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () =>
      invalidate([["audit"]]))
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
