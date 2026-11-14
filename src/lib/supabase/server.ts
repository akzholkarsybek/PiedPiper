import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AIError } from "../gemini";
export async function serverSupabase() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new AIError(
      "NOT_CONFIGURED",
      "Real accounts are not configured. Please explore the guest demo.",
      503,
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        },
      },
    },
  );
}
export async function authenticated() {
  const db = await serverSupabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new AIError(
      "UNAUTHORIZED",
      "Please sign in to use your real account.",
      401,
    );
  return { db, user };
}
