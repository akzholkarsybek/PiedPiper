import { createBrowserClient } from "@supabase/ssr";
export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export function browserSupabase() {
  if (!supabaseConfigured)
    throw new Error(
      "Supabase is not configured. The guest demo is fully available.",
    );
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
