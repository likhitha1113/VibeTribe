import Link from 'next/link';
import { SportBadge, DemoTag } from './SportBadge';
import { sportStyle } from '@/lib/sports';
import { formatKickoff } from '@/lib/utils';
import type { MatchWithSport } from '@/lib/types';

const STATUS_LABEL = { live: 'In progress', upcoming: 'Upcoming', finished: 'Full time' } as const;

export function MatchCard({ match }: { match: MatchWithSport }) {
  const inProgress = match.status === 'live';
  return (
    <article className="card relative flex flex-col overflow-hidden p-5">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${sportStyle(match.sport).bar}`} />
      <div className="flex items-center justify-between gap-2">
        <SportBadge sport={match.sportInfo} />
        {match.is_demo && <DemoTag>Sample fixture</DemoTag>}
      </div>

      <p className="mt-3 text-xs text-chalk-faint">{match.competition}</p>
      <div className="mt-2 space-y-1.5">
        {[[match.team_a, match.score_a], [match.team_b, match.score_b]].map(([team, score]) => (
          <div key={team} className="flex items-baseline justify-between gap-3">
            <span className="font-display text-lg font-bold leading-tight">{team}</span>
            {score && <span className="font-display text-lg font-bold tabular-nums text-flood">{score}</span>}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-chalk-dim">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pitch-700 px-2 py-1 font-medium text-chalk">
          {inProgress && <span aria-hidden className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-flood" />}
          {STATUS_LABEL[match.status]}
        </span>
        <span>{match.status === 'upcoming' ? formatKickoff(match.starts_at) : match.status_note}</span>
      </div>
      {match.status === 'upcoming' && match.status_note && <p className="mt-1 text-xs text-chalk-faint">{match.status_note}</p>}

      <Link href={`/rooms?match=${match.id}`} className="btn-ghost mt-4 w-full">Find rooms for this match</Link>
    </article>
  );
}
