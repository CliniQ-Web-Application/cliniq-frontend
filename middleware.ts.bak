import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Protected route prefixes — any path that starts with one of these
 * requires an active Supabase session.
 */
const PROTECTED_PREFIXES = ["/admin", "/patient", "/staff"];

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    // Build a Supabase server client that can read/write the session cookie.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    // Write updated cookies back onto both the request and the response
                    // so the refreshed session is visible to downstream route handlers.
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

    // getUser() validates the JWT and refreshes the session cookie if needed.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );

    if (isProtected && !user) {
        const signInUrl = new URL("/auth/signin", request.url);
        // Preserve the original destination so signin can redirect back.
        signInUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(signInUrl);
    }

    return response;
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
