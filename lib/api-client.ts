/**
 * Shared API clients.
 *
 * Historically every page built its own `createBookingApi` / `createStaffApi`
 * instance in a `useMemo` with duplicated token helpers. These module-level
 * singletons are used by the shared query hooks instead, so all pages go
 * through the same client and share TanStack Query's in-memory cache.
 */

import { supabase } from "@/lib/supabase";
import { createBookingApi } from "@/lib/booking";
import { createStaffApi } from "@/lib/staff";

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  return error ? null : (data.session?.access_token ?? null);
}

async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  return error ? null : (data.session?.access_token ?? null);
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

/** Patient-facing API (`/api/bookings`, `/api/patients/me`, etc.). */
export const bookingApi = createBookingApi({
  baseUrl,
  getToken: getAccessToken,
  refreshToken: refreshAccessToken,
});

/** Staff-facing API (`/api/appointments`, `/api/queues`, etc.). */
export const staffApi = createStaffApi({
  baseUrl,
  getToken: getAccessToken,
  refreshToken: refreshAccessToken,
});

/** Staff API with a friendlier 403 message for administrator-only actions. */
export const adminApi = createStaffApi({
  baseUrl,
  getToken: getAccessToken,
  refreshToken: refreshAccessToken,
  forbiddenMessage: "Only signed-in administrators can perform this action.",
});
