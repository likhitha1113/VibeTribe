import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkPublicText } from '@/lib/moderation/rules';

export const dynamic = 'force-dynamic';

const Body = z.object({
  displayName: z.string().trim()
    .min(2, 'Display name needs at least 2 characters.')
    .max(24, 'Display name can be at most 24 characters.')
    .regex(/^[A-Za-z0-9 _.-]+$/, 'Use letters, numbers, spaces, dots, dashes or underscores.'),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const problem = checkPublicText(parsed.data.displayName);
  if (problem) return NextResponse.json({ error: problem }, { status: 422 });

  const { error } = await supabase.from('profiles').update({ display_name: parsed.data.displayName }).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'Could not save your name. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
