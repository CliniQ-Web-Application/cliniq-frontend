import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protected route prefixes — any path that starts with one of these
 * requires an active Supabase session cookie.
 *
 * The Supabase auth cookie written by @supabase/ssr is named
 * "sb-<project-ref>-auth-token". We look for any cookie that starts
 * with "sb-" and ends with "-auth-token" so the check works regardless
 * of the project ref.
 */
const PROTECTED_PREFIXES = ["/admin", "/patient", "/staff"];

function hasAuthCookie(request: NextRequest): boolean {
    for (const [name] of request.cookies) {
        if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
            return true;
        }
    }
    return false;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );

    if (isProtected && !hasAuthCookie(request)) {
        const signInUrl = new URL("/auth/signin", request.url);
        // Preserve the original destination so signin can redirect back
        signInUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
}

export const config = {
    /*
     * Match all paths under the protected prefixes.
     * Exclude Next.js internals and static files so middleware
     * doesn't run on every asset request.
     */
    matcher: [
        "/admin/:path*",
        "/patient/:path*",
        "/staff/:path*",
    ],
};
