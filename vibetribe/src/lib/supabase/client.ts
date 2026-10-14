import { createBrowserClient } from '@supabase/ssr';

/** Browser client (anon key, RLS enforced). Safe to call many times: SDK caches a singleton. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
