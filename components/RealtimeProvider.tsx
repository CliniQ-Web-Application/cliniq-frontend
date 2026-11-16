"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startClinicRealtime } from "@/lib/realtime";

/** Keeps the shared query cache fresh from database change events. */
export default function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => startClinicRealtime(queryClient), [queryClient]);

  return <>{children}</>;
}
