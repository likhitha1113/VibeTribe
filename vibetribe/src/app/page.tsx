import Link from 'next/link';
import { Flame, Plus, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchCatalog } from '@/lib/data';
import { hasSupabaseEnv, timeAgo, cn } from '@/lib/utils';
import { MatchCard } from '@/components/MatchCard';
import { RoomCard } from '@/components/RoomCard';
import { SetupNotice } from '@/components/SetupNotice';
import { DemoTag } from '@/components/SportBadge';
import type { Catalog } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { sport?: string } }) {
  let catalog: Catalog | null = null;
  let failure: string | undefined;
  if (!hasSupabaseEnv()) failure = 'Supabase environment variables are missing.';
  else {
    try { catalog = await fetchCatalog(createClient()); } catch (e) { failure = e instanceof Error ? e.message : 'Unknown error'; }
  }
  if (!catalog) return <SetupNotice detail={failure} />;

  const active = searchParams.sport && catalog.sports.some((s) => s.slug === searchParams.sport) ? searchParams.sport : 'all';
  const matches = catalog.matches
    .filter((m) => active === 'all' || m.sport === active)
    .sort((a, b) => ({ live: 0, upcoming: 1, finished: 2 })[a.status] - ({ live: 0, upcoming: 1, finished: 2 })[b.status])
    .slice(0, 6);
  const rooms = catalog.rooms.filter((r) => active === 'all' || r.sport === active);
  const popular = [...rooms].sort((a, b) => b.stats.member_count - a.stats.member_count || b.stats.recent_messages - a.stats.recent_messages).slice(0, 6);
  const buzzing = [...rooms].filter((r) => r.stats.recent_messages > 0).sort((a, b) => b.stats.recent_messages - a.stats.recent_messages).slice(0, 5);

  const chips = [{ slug: 'all', name: 'All sports', emoji: '🌍' }, ...catalog.sports];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      {/* Hero */}
      <section className="grid items-center gap-10 pb-10 pt-12 md:grid-cols-[1.15fr_.85fr] md:pt-20">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Watch alone.<br />Cheer together.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-chalk-dim">
            Join a room for your match, react the moment it happens, and find fans who care about the same game as you do.
            Missed ten minutes of chat? Ask for a catch-up.
          </p>
          <p className="mt-3 font-display text-base font-semibold text-flood">Your people. Your sport. Your moment.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/rooms" className="btn-primary px-5 py-3">Find a room</Link>
            <Link href="/rooms/new" className="btn-ghost px-5 py-3"><Plus className="h-4 w-4" aria-hidden /> Create room</Link>
          </div>
        </div>

        {/* A real slice of the product: a room preview */}
        <div className="card p-4 shadow-2xl shadow-black/40" aria-hidden>
          <div className="flex items-center justify-between border-b border-pitch-600/70 pb-3 text-xs text-chalk-dim">
            <span className="font-semibold text-chalk">India vs Australia: match thread</span>
            <DemoTag>Preview</DemoTag>
          </div>
          <div className="space-y-2.5 py-4 text-sm">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-pitch-700 px-3 py-2"><span className="text-xs font-semibold text-flood">Meera</span><br />Spinner should have bowled the 16th?</div>
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-flood px-3 py-2 text-pitch-950">Captain trusted the pacer. Fair call 👏</div>
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-pitch-700 px-3 py-2"><span className="text-xs font-semibold text-flood">Sana</span><br />That cover drive though 🔥🔥</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-pitch-900 px-3 py-2 text-xs text-chalk-dim">
            <Sparkles className="h-4 w-4 text-flood" /> Catch Me Up: 9 messages summarised in a few seconds
          </div>
        </div>
      </section>

      {/* Demo data disclosure */}
      <p className="mb-6 rounded-xl border border-dashed border-flood/40 bg-flood/5 px-4 py-2.5 text-sm text-chalk-dim">
        <strong className="text-flood">Demo build:</strong> fixtures, scores and the seeded conversations are sample data. VibeTribe does not use an official live sports feed.
      </p>

      {/* Sport selector */}
      <nav aria-label="Filter by sport" className="mb-8 flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link key={c.slug} href={c.slug === 'all' ? '/' : `/?sport=${c.slug}`} scroll={false}
            aria-current={active === c.slug ? 'true' : undefined}
            className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              active === c.slug ? 'border-flood bg-flood text-pitch-950' : 'border-pitch-600 bg-pitch-800/60 text-chalk-dim hover:text-chalk')}>
            <span aria-hidden>{c.emoji}</span> {c.name}
          </Link>
        ))}
      </nav>

      {/* Matches */}
      <section aria-labelledby="matches-h" className="mb-14">
        <h2 id="matches-h" className="mb-4 font-display text-2xl font-bold">Featured matches</h2>
        {matches.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{matches.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        ) : <p className="card p-6 text-sm text-chalk-dim">No sample fixtures for this sport yet.</p>}
      </section>

      {/* Popular rooms */}
      <section aria-labelledby="rooms-h" className="mb-14">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="rooms-h" className="font-display text-2xl font-bold">Popular rooms</h2>
          <Link href="/rooms" className="text-sm font-semibold text-flood hover:underline">Browse all rooms</Link>
        </div>
        {popular.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{popular.map((r) => <RoomCard key={r.id} room={r} />)}</div>
        ) : (
          <div className="card p-8 text-center">
            <p className="font-display text-lg font-bold">No rooms for this sport yet</p>
            <p className="mt-1 text-sm text-chalk-dim">Start the first one and invite the fans around you.</p>
            <Link href="/rooms/new" className="btn-primary mt-4">Create room</Link>
          </div>
        )}
      </section>

      {/* Active discussions */}
      <section aria-labelledby="active-h" className="mb-14">
        <h2 id="active-h" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold"><Flame className="h-5 w-5 text-flood" aria-hidden /> Active discussions</h2>
        {buzzing.length ? (
          <ul className="card divide-y divide-pitch-600/60">
            {buzzing.map((r) => (
              <li key={r.id}>
                <Link href={`/rooms/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-pitch-700/50">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="text-xs text-chalk-dim">{r.sportInfo.emoji} {r.sportInfo.name}{r.created_by === null && ' · includes demo conversation'}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-chalk-dim">
                    <p className="font-semibold text-chalk">{r.stats.recent_messages} messages today</p>
                    <p>{timeAgo(r.stats.last_message_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="card p-6 text-sm text-chalk-dim">Quiet right now. Join a room and get things started.</p>}
      </section>

      {/* Trust */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="How VibeTribe keeps chat good">
        {[
          { icon: Users, t: 'Real fans, real time', d: 'Rooms are run by people. AI only helps you catch up and keeps the chat safer.' },
          { icon: Sparkles, t: 'Catch Me Up', d: 'Joined late? Get the topics, reactions and open questions from recent chat.' },
          { icon: ShieldCheck, t: 'Safer by default', d: 'Personal details and abuse are checked before a message goes out. Three strikes removes someone from that room.' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="card p-5">
            <Icon className="h-5 w-5 text-flood" aria-hidden />
            <h3 className="mt-3 font-display text-base font-bold">{t}</h3>
            <p className="mt-1 text-sm text-chalk-dim">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
