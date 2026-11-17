
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { fetchUserProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  fetchUserProfile: vi.fn(),
}));

function TestConsumer() {
  const {
    user,
    session,
    profile,
    role,
    loading,
    signOut,
    refreshProfile,
  } = useAuth();

  return (
    <div>
      <span data-testid="user">{user?.id ?? "no-user"}</span>
      <span data-testid="session">{session ? "active" : "no-session"}</span>
      <span data-testid="profile">{profile?.id ?? "no-profile"}</span>
      <span data-testid="role">{role ?? "no-role"}</span>
      <span data-testid="loading">{String(loading)}</span>

      <button onClick={signOut}>Sign out</button>
      <button onClick={refreshProfile}>Refresh profile</button>
    </div>
  );
}

const mockUser = {
  id: "user-123",
  email: "patient@example.com",
} as User;

const mockSession = {
  user: mockUser,
  access_token: "mock-token",
  refresh_token: "mock-refresh-token",
} as Session;

const mockProfile = {
  id: "user-123",
  email: "patient@example.com",
  role: "PATIENT" as const,
};

let authStateCallback:
  | ((event: string, session: Session | null) => void)
  | undefined;

function setupAuthMocks() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });

  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
    (callback) => {
      authStateCallback = callback as typeof authStateCallback;

      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>;
    }
  );

  vi.mocked(supabase.auth.signOut).mockResolvedValue({
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.signOut>>);

  vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = undefined;
    setupAuthMocks();
  });

  function renderProvider() {
    return render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
  }

  it("initializes with the existing authenticated session", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("user-123");
      expect(screen.getByTestId("session")).toHaveTextContent("active");
      expect(screen.getByTestId("profile")).toHaveTextContent("user-123");
      expect(screen.getByTestId("role")).toHaveTextContent("PATIENT");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(fetchUserProfile).toHaveBeenCalledWith("user-123");
  });

  it("handles an unauthenticated user", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("no-user");
      expect(screen.getByTestId("session")).toHaveTextContent("no-session");
      expect(screen.getByTestId("profile")).toHaveTextContent("no-profile");
      expect(screen.getByTestId("role")).toHaveTextContent("no-role");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it("clears authentication state when the user signs out", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("PATIENT");
    });

    await act(async () => {
      authStateCallback?.("SIGNED_OUT", null);
    });

    expect(screen.getByTestId("user")).toHaveTextContent("no-user");
    expect(screen.getByTestId("session")).toHaveTextContent("no-session");
    expect(screen.getByTestId("profile")).toHaveTextContent("no-profile");
    expect(screen.getByTestId("role")).toHaveTextContent("no-role");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("loads the profile when a user signs in", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await act(async () => {
      authStateCallback?.("SIGNED_IN", mockSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("PATIENT");
    });

    expect(fetchUserProfile).toHaveBeenCalledWith("user-123");
  });

  it("signs out and redirects to the sign-in page", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("PATIENT");
    });

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/auth/signin");
    });
  });

  it("refreshes the current user's profile", async () => {
    const updatedProfile = {
      ...mockProfile,
      role: "STAFF" as const,
    };

    vi.mocked(fetchUserProfile)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(updatedProfile);

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("PATIENT");
    });

    await user.click(
      screen.getByRole("button", { name: "Refresh profile" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("STAFF");
    });

    expect(fetchUserProfile).toHaveBeenCalledTimes(2);
  });
});
