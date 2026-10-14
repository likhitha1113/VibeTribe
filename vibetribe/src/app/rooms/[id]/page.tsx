import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchRoom } from '@/lib/data';
import { hasSupabaseEnv, isUuid } from '@/lib/utils';
import { RoomView } from '@/components/RoomView';
import { JoinRoomButton } from '@/components/JoinRoomButton';
import { SportBadge, DemoTag } from '@/components/SportBadge';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export default async function RoomPage({ params }: { params: { id: string } }) {
  if (!hasSupabaseEnv()) return <SetupNotice detail="Supabase environment variables are missing." />;
  if (!isUuid(params.id)) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/rooms/${params.id}`)}`);

  let room;
  try { room = await fetchRoom(supabase, params.id); } catch (e) {
    return <SetupNotice detail={e instanceof Error ? e.message : undefined} />;
  }
  if (!room) notFound();

  const [{ data: member }, { data: strike }, { data: profile }] = await Promise.all([
    supabase.from('room_members').select('role').eq('room_id', room.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('room_strikes').select('strikes, banned_at').eq('room_id', room.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
  ]);

  if (!member) {
    const banned = Boolean(strike?.banned_at);
    return (
      <div className="mx-auto max-w-xl px-4 py-14">
        <div className="card p-7">
          <div className="flex flex-wrap items-center gap-2">
            <SportBadge sport={room.sportInfo} />
            {room.match && <DemoTag>Sample match data</DemoTag>}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold">{room.name}</h1>
          {room.match && <p className="mt-1 text-chalk-dim">{room.match.team_a} vs {room.match.team_b}</p>}
          {room.description && <p className="mt-3 text-chalk-dim">{room.description}</p>}
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-chalk-dim"><Users className="h-4 w-4" aria-hidden />{room.stats.member_count} member{room.stats.member_count === 1 ? '' : 's'}</p>
          <div className="mt-6 flex items-center gap-3">
            {banned
              ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">You were removed from this room after 3 community-guideline strikes.</p>
              : <JoinRoomButton roomId={room.id} signedIn isMember={false} className="btn-primary px-6" />}
            <Link href="/rooms" className="btn-ghost">Back to rooms</Link>
          </div>
        </div>
      </div>
    );
  }

  return <RoomView room={room} user={{ id: user.id, displayName: profile?.display_name ?? 'Fan' }} initialStrikes={strike?.strikes ?? 0} />;
}
