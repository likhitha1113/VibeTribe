import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { moderateMessage } from '@/lib/moderation/pipeline';
import { classifyWithLlm } from '@/lib/moderation/llm-classifier';
import { rateLimit } from '@/lib/rate-limit';
import { MAX_STRIKES } from '@/lib/types';

export const dynamic = 'force-dynamic';

const Body = z.object({ roomId: z.string().uuid(), body: z.string().max(5000) });
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/**
 * The ONLY write path for chat messages.
 * Identity comes from the session cookie (never the request body), membership is
 * checked, the message is moderated, and only then is it stored via the service role.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to chat.' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid request.' }, 400);
  const { roomId, body } = parsed.data;

  // Flood control: 6 messages / 10s per user
  const rl = rateLimit(`msg:${user.id}`, 6, 10_000);
  if (!rl.ok) return json({ error: `Slow down a little. Try again in ${rl.retryAfterSec}s.` }, 429);

  let admin;
  try { admin = createAdminClient(); } catch { return json({ error: 'Chat is temporarily unavailable.' }, 503); }

  // Authorisation: must be a current member (RLS lets users read their own membership)
  const { data: member } = await supabase
    .from('room_members').select('role').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!member) {
    const { data: strike } = await admin
      .from('room_strikes').select('banned_at').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
    if (strike?.banned_at)
      return json({ banned: true, error: 'You were removed from this room after 3 community-guideline strikes.' }, 403);
    return json({ error: 'Join this room to send messages.' }, 403);
  }

  // Moderation. LLM calls are capped at 12/min/user; beyond that deterministic rules still apply.
  const classify = rateLimit(`llm-mod:${user.id}`, 12, 60_000).ok ? classifyWithLlm : undefined;
  const result = await moderateMessage(body, classify);

  // Audit log: structured, no message text, no matched PII
  await admin.from('moderation_events').insert({
    room_id: roomId, user_id: user.id, decision: result.decision, category: result.category,
    source: result.source, reason: result.reason, counts_as_strike: result.countsAsStrike,
  });

  if (result.decision === 'block') {
    if (!result.countsAsStrike)
      return json({ blocked: true, category: result.category, message: result.userMessage }, 422);

    const { data, error } = await admin.rpc('register_strike', { p_room: roomId, p_user: user.id, p_max: MAX_STRIKES });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return json({ blocked: true, category: result.category, message: result.userMessage }, 422);

    if (row.out_banned)
      return json({
        banned: true, strikes: row.out_strikes,
        error: `${result.userMessage} That was strike ${MAX_STRIKES} of ${MAX_STRIKES}, so you have been removed from this room.`,
      }, 403);

    return json({
      blocked: true, category: result.category, strikes: row.out_strikes,
      message: `${result.userMessage} Warning ${row.out_strikes} of ${MAX_STRIKES}: at ${MAX_STRIKES} you are removed from this room.`,
    }, 422);
  }

  const { data: saved, error } = await admin
    .from('messages')
    .insert({ room_id: roomId, sender_id: user.id, body: result.text, moderation_status: 'approved' })
    .select('id, room_id, sender_id, body, created_at, moderation_status, is_demo, demo_author')
    .single();
  if (error || !saved) return json({ error: 'Could not send your message. Try again.' }, 500);
  return json({ message: saved }, 201);
}
