import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/admin", "/patient", "/staff"];

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    // Build a Supabase server client that reads/writes session cookies
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // getUser() validates the JWT from cookies
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );
    const isAuthPage = pathname.startsWith("/auth/");

    // Helper to return a redirect response with any refreshed cookies attached
    const createRedirect = (url: URL | string) => {
        const redirectRes = NextResponse.redirect(url);
        response.cookies.getAll().forEach((c) => {
            redirectRes.cookies.set(c.name, c.value);
        });
        return redirectRes;
    };

    // 1. Unauthenticated users cannot access protected routes
    if (isProtected && !user) {
        const signInUrl = new URL("/auth/signin", request.url);
        signInUrl.searchParams.set("redirect", pathname);
        return createRedirect(signInUrl);
    }

    // 2. Authenticated users: verify role under RLS
    if (user && (isProtected || isAuthPage)) {
        let role: "ADMIN" | "STAFF" | "PATIENT" = "PATIENT";

        try {
            const { data: staff } = await supabase
                .from("staff")
                .select("staff_role")
                .eq("auth_user_id", user.id)
                .maybeSingle();

            if (staff) {
                const isStaffAdmin = String(staff.staff_role).toUpperCase() === "ADMIN";
                role = isStaffAdmin ? "ADMIN" : "STAFF";
            } else {
                role = "PATIENT";
            }
        } catch {
            role = "PATIENT";
        }

        const destination =
            role === "ADMIN" ? "/admin" : role === "STAFF" ? "/staff" : "/patient";

        // If on auth pages, redirect already authenticated user to their destination
        if (isAuthPage) {
            return createRedirect(new URL(destination, request.url));
        }

        // /admin is strictly for ADMIN only
        if (pathname.startsWith("/admin") && role !== "ADMIN") {
            return createRedirect(new URL(destination, request.url));
        }

        // Keep the legacy registration URL admin-only, before the general staff rule.
        if (pathname === "/staff/register" || pathname === "/staff/register/") {
            return createRedirect(new URL(
                role === "ADMIN" ? "/admin/staff/register" : destination,
                request.url
            ));
        }

        // /staff is strictly for non-admin STAFF only
        if (pathname.startsWith("/staff") && role !== "STAFF") {
            return createRedirect(new URL(destination, request.url));
        }

        // /patient is strictly for PATIENT only
        if (pathname.startsWith("/patient") && role !== "PATIENT") {
            return createRedirect(new URL(destination, request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        "/admin/:path*",
        "/patient/:path*",
        "/staff/:path*",
        "/auth/:path*",
    ],
};
