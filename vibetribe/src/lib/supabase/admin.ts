import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Privileged client (bypasses RLS). SERVER ONLY. Used for:
 *  - publishing messages AFTER moderation
 *  - strikes / moderation log / summary cache
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
