"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchUserProfile, type UserProfile } from "@/lib/auth";
import { clearQueryCache } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth-store";

/**
 * Auth state now lives in the Zustand store (`useAuthStore`) so every page
 * reads the same in-memory snapshot. This component only owns the lifecycle:
 * bootstrapping the session, subscribing to auth changes, and sign-out.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string): Promise<UserProfile> => {
      const profile = await fetchUserProfile(userId);
      if (mounted) useAuthStore.getState().setProfile(profile);
      return profile;
    };

    async function initAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("Error getting session:", error);

        if (!mounted) return;
        const session = data?.session ?? null;
        useAuthStore.getState().setSession(session);

        if (session?.user) await loadProfile(session.user.id);
        else useAuthStore.getState().setProfile(null);
      } catch (err) {
        console.error("Auth init exception:", err);
      } finally {
        if (mounted) useAuthStore.getState().setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const store = useAuthStore.getState();
      store.setSession(session);

      // A different user (or no user) must not see the previous user's data.
      const previous = store.user?.id;
      if (session?.user && session.user.id !== previous) clearQueryCache();

      if (!session?.user) {
        store.setProfile(null);
        store.setLoading(false);
        return;
      }

      store.setLoading(true);
      await loadProfile(session.user.id);
      if (mounted) useAuthStore.getState().setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const router = useRouter();

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const current = useAuthStore.getState().user;
    if (!current) return null;
    const next = await fetchUserProfile(current.id);
    useAuthStore.getState().setProfile(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    try {
      useAuthStore.getState().setLoading(true);
      await supabase.auth.signOut();
      clearQueryCache();
      useAuthStore.getState().reset();
      router.push("/auth/signin");
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      useAuthStore.getState().setLoading(false);
    }
  }, [router]);

  return {
    user,
    session,
    profile,
    role: profile?.role ?? null,
    loading,
    signOut,
    refreshProfile,
  };
}
