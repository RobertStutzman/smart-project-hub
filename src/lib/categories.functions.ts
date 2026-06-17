import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type CategoryMeta = {
  name: string;
  emoji: string;
  off_by_default: boolean;
};

// Public read — RLS policy on category_meta allows anon SELECT.
export const listCategoryMeta = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  const { data, error } = await supabase
    .from("category_meta")
    .select("name, emoji, off_by_default");
  if (error) throw new Error(error.message);
  return { meta: (data ?? []) as CategoryMeta[] };
});
