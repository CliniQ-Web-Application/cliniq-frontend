"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/auth";

/**
 * Global authentication state, held in memory by Zustand.
 *
 * Any component can read the same user/session/profile snapshot without
 * prop drilling or a React Context provider re-rendering the whole tree.
 * `AuthProvider` is the only writer; `useAuth()` is the reader.
 */
interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null as User | null,
  session: null as Session | null,
  profile: null as UserProfile | null,
  loading: true,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ ...initialState, loading: false }),
}));
