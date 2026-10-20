import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser-side Supabase client.
 * Uses @supabase/ssr so the session is stored in cookies instead of
 * localStorage, making it readable by Next.js middleware.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);
