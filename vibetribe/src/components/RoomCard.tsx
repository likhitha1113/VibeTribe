import Link from 'next/link';
import { MessageCircle, Users } from 'lucide-react';
import { SportBadge, DemoTag } from './SportBadge';
import type { RoomWithMeta } from '@/lib/types';

export function RoomCard({ room, action }: { room: RoomWithMeta; action?: React.ReactNode }) {
  const isMatchRoom = Boolean(room.match);
  return (
    <article className="card flex flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SportBadge sport={room.sportInfo} />
        <span className="rounded-full bg-pitch-700 px-2.5 py-1 text-xs font-medium text-chalk-dim">
          {isMatchRoom ? 'Match room' : 'Community'}
        </span>
        {room.created_by === null && <DemoTag>Seeded demo room</DemoTag>}
      </div>

      <h3 className="mt-3 font-display text-lg font-bold leading-snug">
        <Link href={`/rooms/${room.id}`} className="hover:text-flood">{room.name}</Link>
      </h3>
      {room.match && (
        <p className="mt-1 text-sm text-chalk-dim">{room.match.team_a} vs {room.match.team_b}</p>
      )}
      {room.description && <p className="mt-2 line-clamp-2 text-sm text-chalk-dim">{room.description}</p>}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-3 text-xs text-chalk-dim">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{room.stats.member_count} member{room.stats.member_count === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden />{room.stats.recent_messages} today</span>
        </div>
        {action ?? <Link href={`/rooms/${room.id}`} className="btn-ghost !py-1.5">View room</Link>}
      </div>
    </article>
  );
}
