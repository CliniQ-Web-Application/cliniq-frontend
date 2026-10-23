"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRoleDestination, isRouteAllowed } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname.startsWith("/auth/");
  const isProtectedPage =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/patient");

  useEffect(() => {
    if (loading) return;

    // 1. If user is logged in and visits signin / signup, redirect to their role destination
    if (user && role && isAuthPage) {
      const destination = getRoleDestination(role);
      router.replace(destination);
      return;
    }

    // 2. If unauthenticated user tries to access a protected page, redirect to signin
    if (!user && isProtectedPage) {
      const redirectUrl = `/auth/signin?redirect=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
      return;
    }

    // 3. If authenticated user tries to access a route forbidden for their role
    if (user && role && isProtectedPage && !isRouteAllowed(pathname, role)) {
      const destination = getRoleDestination(role);
      router.replace(destination);
      return;
    }
  }, [user, role, loading, pathname, isAuthPage, isProtectedPage, router]);

  // While loading credentials on a protected route, show loading state
  if (loading && isProtectedPage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // If on a protected page and the user is either not logged in, has no role, or does not have access
  if (isProtectedPage && (!user || !role || !isRouteAllowed(pathname, role))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Access restricted. Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  // If on auth page and user is already authenticated with a role, wait for redirect
  if (isAuthPage && user && role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
