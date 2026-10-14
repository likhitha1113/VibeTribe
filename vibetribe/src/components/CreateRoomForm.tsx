'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { LIMITS, type Match, type Sport } from '@/lib/types';

export function CreateRoomForm() {
  const router = useRouter();
  const [sports, setSports] = useState<Sport[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [matchId, setMatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([supabase.from('sports').select('*').order('sort_order'), supabase.from('matches').select('*').order('starts_at')])
      .then(([s, m]) => {
        if (s.error || m.error) return setLoadError('Could not load sports. Refresh to try again.');
        setSports(s.data as Sport[]); setMatches(m.data as Match[]);
        if (s.data?.[0]) setSport((cur) => cur || (s.data![0] as Sport).slug);
      });
  }, []);

  const matchOptions = useMemo(() => matches.filter((m) => m.sport === sport), [matches, sport]);
  const nameErr = name.length > 0 && name.trim().length < 3 ? 'Room name needs at least 3 characters.' : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 3) return setError('Room name needs at least 3 characters.');
    if (!sport) return setError('Choose a sport.');
    setBusy(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description, sport, matchId: matchId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Could not create the room.'); setBusy(false); return; }
      router.push(`/rooms/${data.id}`);
    } catch { setError('Network problem. Check your connection and try again.'); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" noValidate>
      {loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}

      <div>
        <label htmlFor="name" className="label">Room name</label>
        <input id="name" className="input" value={name} maxLength={LIMITS.roomName} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunday derby: matchday thread" aria-invalid={Boolean(nameErr)} aria-describedby="name-h" required />
        <p id="name-h" className={`mt-1 text-xs ${nameErr ? 'text-danger' : 'text-chalk-faint'}`}>{nameErr ?? `${name.length}/${LIMITS.roomName}`}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sport" className="label">Sport</label>
          <select id="sport" className="input" value={sport} onChange={(e) => { setSport(e.target.value); setMatchId(''); }}>
            {sports.map((s) => <option key={s.slug} value={s.slug}>{s.emoji} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="match" className="label">Match (optional)</label>
          <select id="match" className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">No match: general community</option>
            {matchOptions.map((m) => <option key={m.id} value={m.id}>{m.team_a} vs {m.team_b} (sample)</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="desc" className="label">What is this room about? (optional)</label>
        <textarea id="desc" className="input min-h-24" value={description} maxLength={LIMITS.roomDescription}
          onChange={(e) => setDescription(e.target.value)} placeholder="Share the topic so the right fans find you." />
        <p className="mt-1 text-xs text-chalk-faint">{description.length}/{LIMITS.roomDescription}</p>
      </div>

      <div>
        <span className="label">Visibility</span>
        <p className="rounded-xl border border-pitch-600 bg-pitch-900 px-3.5 py-2.5 text-sm text-chalk-dim">
          Public: anyone signed in can find and join. Private rooms are not part of this version.
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}

      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Create room
      </button>
    </form>
  );
}
