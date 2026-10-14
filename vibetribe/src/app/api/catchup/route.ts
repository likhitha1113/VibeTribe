import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callLlmJson, isLlmConfigured } from '@/lib/llm';
import { rateLimit } from '@/lib/rate-limit';
import {
  CATCHUP_SYSTEM, SummarySchema, buildCatchUpPrompt, fallbackSummary, pseudonymise, type CatchUpSummary,
} from '@/lib/catchup';
import type { Match } from '@/lib/types';

export const dynamic = 'force-dynamic';

const Body = z.object({ roomId: z.string().uuid() });
const WINDOW = 60;            // max messages sent to the LLM
const MIN_MESSAGES = 4;       // below this a summary isn't useful
const CACHE_TTL_MS = 10 * 60_000;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to use Catch Me Up.' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid request.' }, 400);
  const { roomId } = parsed.data;

  // Limits: 1 per 8s per user, 15 per hour per user
  const burst = rateLimit(`catchup-burst:${user.id}`, 1, 8_000);
  const hourly = rateLimit(`catchup-hour:${user.id}`, 15, 3_600_000);
  if (!burst.ok || !hourly.ok)
    return json({ error: `You're requesting summaries quickly. Try again in ${Math.max(burst.retryAfterSec, hourly.retryAfterSec)}s.` }, 429);

  // Authorisation: members only (RLS also restricts the message read below)
  const { data: member } = await supabase
    .from('room_members').select('role').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!member) return json({ error: 'Join this room to get a summary.' }, 403);

  const [{ data: room }, { data: rows, error: msgErr }] = await Promise.all([
    supabase.from('rooms').select('id, name, sport, match_id').eq('id', roomId).maybeSingle(),
    supabase.from('messages')
      .select('id, sender_id, demo_author, body, created_at')
      .eq('room_id', roomId).eq('moderation_status', 'approved')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(WINDOW),
  ]);
  if (!room || msgErr) return json({ error: 'Could not load this room.' }, 500);

  const recent = (rows ?? []).slice().reverse();
  if (recent.length < MIN_MESSAGES)
    return json({ summary: null, notEnough: true, messageCount: recent.length,
      message: 'Not enough conversation yet. Say something, then try again once the chat picks up.' });

  const lastId = recent[recent.length - 1].id;

  // Cache: reuse if nothing new has been posted and it is still fresh (saves LLM calls)
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try { admin = createAdminClient(); } catch { admin = null; }
  if (admin) {
    const { data: cached } = await admin.from('catchup_cache').select('*').eq('room_id', roomId).maybeSingle();
    if (cached && cached.last_message_id === lastId && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
      return json({ summary: cached.summary, source: cached.source, cached: true, messageCount: cached.message_count });
    }
  }

  // Trusted match context: from our own matches table, labelled as sample data
  let matchContext: string | null = null;
  if (room.match_id) {
    const { data: m } = await supabase.from('matches').select('*').eq('id', room.match_id).maybeSingle();
    const match = m as Match | null;
    if (match) {
      matchContext = `SAMPLE/DEMO data, not a real live feed. ${match.team_a} vs ${match.team_b}` +
        (match.score_a ? `; score ${match.score_a} - ${match.score_b ?? ''}` : '') +
        (match.status_note ? `; ${match.status_note}` : '');
    }
  }

  const promptMessages = pseudonymise(recent.map((r) => ({ key: r.sender_id ?? `demo:${r.demo_author}`, body: r.body })));

  let summary: CatchUpSummary;
  let source: 'ai' | 'fallback' = 'ai';
  try {
    if (!isLlmConfigured()) throw new Error('not configured');
    const out = await callLlmJson({
      system: CATCHUP_SYSTEM,
      user: buildCatchUpPrompt({ roomName: room.name, sport: room.sport, matchContext, messages: promptMessages }),
      maxTokens: 900,
      timeoutMs: 15_000,
    });
    const checked = SummarySchema.safeParse(out);
    if (!checked.success) throw new Error('bad shape');
    summary = checked.data;
  } catch {
    summary = fallbackSummary(promptMessages);
    source = 'fallback';
  }

  // Only cache real AI output; a fallback should be retried next time
  if (admin && source === 'ai') {
    await admin.from('catchup_cache').upsert({
      room_id: roomId, last_message_id: lastId, message_count: recent.length,
      summary, source, created_at: new Date().toISOString(),
    });
  }
  return json({ summary, source, cached: false, messageCount: recent.length });
}
