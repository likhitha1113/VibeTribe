'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchCatalog } from '@/lib/data';
import { RoomCard } from './RoomCard';
import { JoinRoomButton } from './JoinRoomButton';
import { cn } from '@/lib/utils';
import type { Catalog } from '@/lib/types';

type Kind = 'all' | 'match' | 'community';

export function RoomDiscovery() {
  const params = useSearchParams();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [sport, setSport] = useState(params.get('sport') ?? 'all');
  const [match, setMatch] = useState(params.get('match') ?? 'all');
  const [kind, setKind] = useState<Kind>('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const [cat, auth] = await Promise.all([fetchCatalog(supabase), supabase.auth.getUser()]);
      setCatalog(cat);
      const uid = auth.data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data } = await supabase.from('room_members').select('room_id').eq('user_id', uid);
        setMemberOf(new Set((data ?? []).map((r) => r.room_id as string)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // If a match is chosen, align the sport filter with it
  useEffect(() => {
    if (match !== 'all' && catalog) {
      const m = catalog.matches.find((x) => x.id === match);
      if (m) setSport(m.sport);
    }
  }, [match, catalog]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const needle = q.trim().toLowerCase();
    return catalog.rooms
      .filter((r) => sport === 'all' || r.sport === sport)
      .filter((r) => match === 'all' || r.match_id === match)
      .filter((r) => kind === 'all' || (kind === 'match' ? Boolean(r.match_id) : !r.match_id))
      .filter((r) => !needle || `${r.name} ${r.description}`.toLowerCase().includes(needle))
      .sort((a, b) => b.stats.member_count - a.stats.member_count || b.stats.recent_messages - a.stats.recent_messages);
  }, [catalog, q, sport, match, kind]);

  const matchOptions = (catalog?.matches ?? []).filter((m) => sport === 'all' || m.sport === sport);
  const clear = () => { setQ(''); setSport('all'); setMatch('all'); setKind('all'); };
  const filtered = q || sport !== 'all' || match !== 'all' || kind !== 'all';

  return (
    <div>
      <div className="card mb-6 grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1.2fr_1fr]">
        <div className="relative">
          <label htmlFor="q" className="sr-only">Search rooms</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-faint" aria-hidden />
          <input id="q" className="input !pl-9" placeholder="Search by room name or topic" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sport" className="sr-only">Sport</label>
          <select id="sport" className="input" value={sport} onChange={(e) => { setSport(e.target.value); setMatch('all'); }}>
            <option value="all">All sports</option>
            {catalog?.sports.map((s) => <option key={s.slug} value={s.slug}>{s.emoji} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="match" className="sr-only">Match</label>
          <select id="match" className="input" value={match} onChange={(e) => setMatch(e.target.value)}>
            <option value="all">Any match</option>
            {matchOptions.map((m) => <option key={m.id} value={m.id}>{m.team_a} vs {m.team_b} (sample)</option>)}
          </select>
        </div>
        <div role="group" aria-label="Room type" className="flex rounded-xl border border-pitch-600 bg-pitch-900 p-1 text-sm">
          {([['all', 'All'], ['match', 'Match'], ['community', 'Community']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
              className={cn('flex-1 rounded-lg px-2 py-1.5 font-medium', kind === k ? 'bg-flood text-pitch-950' : 'text-chalk-dim hover:text-chalk')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading rooms">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-44 animate-pulse bg-pitch-800/40" />)}
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="card flex flex-col items-center p-8 text-center">
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
          <p className="mt-2 font-display text-lg font-bold">We couldn&apos;t load rooms</p>
          <p className="mt-1 text-sm text-chalk-dim">{error}</p>
          <button onClick={load} className="btn-primary mt-4">Try again</button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-display text-lg font-bold">{filtered ? 'No rooms match those filters' : 'No rooms yet'}</p>
          <p className="mt-1 text-sm text-chalk-dim">{filtered ? 'Try a different search, or start the room yourself.' : 'Be the first to start one.'}</p>
          <div className="mt-4 flex justify-center gap-2">
            {filtered && <button onClick={clear} className="btn-ghost">Clear filters</button>}
            <Link href="/rooms/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> Create room</Link>
          </div>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <>
          <p className="mb-3 text-sm text-chalk-dim" aria-live="polite">{results.length} room{results.length === 1 ? '' : 's'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <RoomCard key={r.id} room={r}
                action={<JoinRoomButton roomId={r.id} signedIn={Boolean(userId)} isMember={memberOf.has(r.id)} />} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
