"use client";

import { QueryClient } from "@tanstack/react-query";
import { STALE_TIME_MS } from "@/lib/query-keys";

let browserQueryClient: QueryClient | undefined;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Reuse cached data across page navigations instead of re-fetching.
        staleTime: STALE_TIME_MS,
        gcTime: 5 * 60_000,
        // Supabase Realtime drives freshness; refocus is a cheap safety net
        // for events missed while the tab was hidden.
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

/** Reuses a single browser QueryClient; creates an isolated one during SSR. */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

/** Drop cached data when the signed-in user changes (e.g. on sign-out). */
export function clearQueryCache(): void {
  browserQueryClient?.clear();
}
