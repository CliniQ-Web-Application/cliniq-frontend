
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SigninPage from "@/app/auth/signin/page";

const { mockPush, mockGet } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockGet: vi.fn(),
}));
// Mock nextjs navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));
//mock nextjs link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock Supabase
const { mockSignIn } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
    },
  },
}));

// Mock authentication utilities
const { mockFetchProfile, mockGetDestination, mockIsRouteAllowed } =
  vi.hoisted(() => ({
    mockFetchProfile: vi.fn(),
    mockGetDestination: vi.fn(),
    mockIsRouteAllowed: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({
  fetchUserProfile: mockFetchProfile,
  getRoleDestination: mockGetDestination,
  isRouteAllowed: mockIsRouteAllowed,
}));

describe("Cliniq Sign In", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGet.mockReturnValue(null);
    mockGetDestination.mockReturnValue("/patient");
    mockIsRouteAllowed.mockReturnValue(false);
  });

  it("renders the sign-in form", () => {
    render(<SigninPage />);

    expect(
      screen.getByRole("heading", { name: /sign in to cliniq/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("requires email and password", () => {
    render(<SigninPage />);

    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });

  it("displays an error when login fails", async () => {
    const user = userEvent.setup();

    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    render(<SigninPage />);

    await user.type(
      screen.getByLabelText(/email address/i),
      "wrong@example.com"
    );

    await user.type(
      screen.getByLabelText(/password/i),
      "wrongpassword"
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Invalid login credentials")
    ).toBeInTheDocument();

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("signs in successfully and redirects to the user's portal", async () => {
    const user = userEvent.setup();

    mockSignIn.mockResolvedValue({
      data: {
        user: { id: "test-user-1" },
        session: { access_token: "fake-token" },
      },
      error: null,
    });

    mockFetchProfile.mockResolvedValue({
      role: "patient",
    });

    mockGetDestination.mockReturnValue("/patient");

    render(<SigninPage />);

    await user.type(
      screen.getByLabelText(/email address/i),
      "patient@example.com"
    );

    await user.type(
      screen.getByLabelText(/password/i),
      "securepassword"
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/patient");
    });

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "patient@example.com",
      password: "securepassword",
    });
  });

  it("redirects to the requested page when the role is allowed", async () => {
    const user = userEvent.setup();

    mockGet.mockReturnValue("/patient/profile");
    mockIsRouteAllowed.mockReturnValue(true);

    mockSignIn.mockResolvedValue({
      data: {
        user: { id: "test-user-1" },
        session: { access_token: "fake-token" },
      },
      error: null,
    });

    mockFetchProfile.mockResolvedValue({
      role: "patient",
    });

    render(<SigninPage />);

    await user.type(
      screen.getByLabelText(/email address/i),
      "patient@example.com"
    );

    await user.type(
      screen.getByLabelText(/password/i),
      "securepassword"
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/patient/profile");
    });
  });

  it("displays a session expired message when requested", () => {
    mockGet.mockImplementation((key: string) =>
      key === "reason" ? "session_expired" : null
    );

    render(<SigninPage />);

    expect(
      screen.getByText(/your session expired/i)
    ).toBeInTheDocument();
  });
});
