import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkPublicText } from '@/lib/moderation/rules';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(3, 'Room name needs at least 3 characters.').max(60, 'Room name can be at most 60 characters.'),
  description: z.string().trim().max(200, 'Description can be at most 200 characters.').default(''),
  sport: z.string().regex(/^[a-z0-9-]{2,30}$/, 'Choose a sport.'),
  matchId: z.string().uuid().nullable().optional(),
});
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to create a room.' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, 400);
  const { name, description, sport, matchId } = parsed.data;

  const problem = checkPublicText(name) ?? checkPublicText(description);
  if (problem) return json({ error: problem }, 422);

  if (!rateLimit(`room:${user.id}`, 5, 3_600_000).ok)
    return json({ error: 'You have created several rooms recently. Try again later.' }, 429);

  // RLS enforces created_by = you, public visibility and that the match belongs to the sport
  const { data, error } = await supabase
    .from('rooms')
    .insert({ name, description, sport, match_id: matchId ?? null, created_by: user.id, visibility: 'public' })
    .select('id')
    .single();

  if (error || !data) {
    const msg = error?.code === '23503' ? 'That sport or match does not exist.'
      : error?.code === '42501' ? 'That match does not belong to the chosen sport.'
      : 'Could not create the room. Try again.';
    return json({ error: msg }, 400);
  }
  return json({ id: data.id }, 201);
}
