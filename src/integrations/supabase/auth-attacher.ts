// Attaches the Supabase user's bearer token to every serverFn RPC.
// REQUIRED for any server function that uses requireSupabaseAuth.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        return next({ headers: { Authorization: `Bearer ${token}` } });
      }
    } catch {
      // fall through and call next() without header
    }
    return next();
  },
);
