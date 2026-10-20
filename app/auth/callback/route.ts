import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase auth callback handler.
 *
 * After email confirmation or OAuth sign-in, Supabase redirects here with a
 * one-time `code` query parameter. This handler exchanges it for a real
 * session and writes the session cookie before forwarding the user to their
 * intended destination (defaults to "/patient").
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/patient";

    if (code) {
        let response = NextResponse.redirect(`${origin}${next}`);

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return response;
        }
    }

    // Something went wrong — send the user to an error page or back to sign-in.
    return NextResponse.redirect(`${origin}/auth/signin?error=auth_callback_failed`);
}
