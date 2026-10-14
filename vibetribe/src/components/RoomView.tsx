'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ChevronUp, Flag, Loader2, LogOut, Send, ShieldCheck, Smile, Sparkles, Users, WifiOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SportBadge, DemoTag } from './SportBadge';
import { CatchUpPanel } from './CatchUpPanel';
import { ReportDialog } from './ReportDialog';
import { cn, formatTime } from '@/lib/utils';
import { LIMITS, MAX_STRIKES, REACTIONS, type ChatMessage, type ReactionRow, type RoomWithMeta } from '@/lib/types';

const PAGE = 40;
const SELECT = 'id, room_id, sender_id, body, created_at, moderation_status, is_demo, demo_author, profiles(display_name)';
const cmp = (a: ChatMessage, b: ChatMessage) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1);
const rkey = (r: { message_id: string; user_id: string; reaction: string }) => `${r.message_id}|${r.user_id}|${r.reaction}`;

type Row = {
  id: string; room_id: string; sender_id: string | null; body: string; created_at: string;
  moderation_status: ChatMessage['moderation_status']; is_demo: boolean; demo_author: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
};
type Warning = { text: string; tone: 'warn' | 'info' };

export function RoomView({ room, user, initialStrikes }: {
  room: RoomWithMeta; user: { id: string; displayName: string }; initialStrikes: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionRow>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [conn, setConn] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [online, setOnline] = useState(1);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<Warning | null>(null);
  const [strikes, setStrikes] = useState(initialStrikes);
  const [banned, setBanned] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(0);

  const names = useRef(new Map<string, string>([[user.id, user.displayName]]));
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const preserve = useRef<number | null>(null);
  const lastOwn = useRef(false);
  const everSubscribed = useRef(false);

  // ---- helpers ----
  const toMessage = useCallback((r: Row): ChatMessage => {
    const joined = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    if (r.sender_id && joined?.display_name) names.current.set(r.sender_id, joined.display_name);
    return {
      id: r.id, room_id: r.room_id, sender_id: r.sender_id, body: r.body, created_at: r.created_at,
      moderation_status: r.moderation_status, is_demo: r.is_demo, demo_author: r.demo_author,
      sender_name: r.is_demo ? r.demo_author ?? 'Demo fan' : (r.sender_id && names.current.get(r.sender_id)) || 'Fan',
    };
  }, []);

  const upsert = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });   // dedupes DB fetch vs realtime overlap
      return [...map.values()].sort(cmp);
    });
  }, []);

  const addReactions = useCallback((rows: ReactionRow[]) => {
    if (!rows.length) return;
    setReactions((prev) => { const next = { ...prev }; for (const r of rows) next[rkey(r)] = r; return next; });
  }, []);

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase.from('message_reactions').select('id, message_id, user_id, reaction').in('message_id', ids);
    addReactions((data ?? []) as ReactionRow[]);
  }, [supabase, addReactions]);

  const loadLatest = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select(SELECT).eq('room_id', room.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE);
    if (error) { setLoadError('Could not load messages.'); setLoading(false); return; }
    const rows = ((data ?? []) as unknown as Row[]).map(toMessage);
    setLoadError(null);
    upsert(rows);
    setHasMore((h) => h || rows.length === PAGE);
    setLoading(false);
    loadReactions(rows.map((r) => r.id));
  }, [supabase, room.id, toMessage, upsert, loadReactions]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    preserve.current = scroller.current?.scrollHeight ?? null;
    const { data, error } = await supabase.from('messages').select(SELECT).eq('room_id', room.id)
      .lt('created_at', oldest.created_at).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE);
    setLoadingOlder(false);
    if (error) { preserve.current = null; setWarning({ tone: 'warn', text: 'Could not load older messages.' }); return; }
    const rows = ((data ?? []) as unknown as Row[]).map(toMessage);
    setHasMore(rows.length === PAGE);
    upsert(rows);
    loadReactions(rows.map((r) => r.id));
  }, [messages, loadingOlder, supabase, room.id, toMessage, upsert, loadReactions]);

  // ---- initial history ----
  useEffect(() => { loadLatest(); }, [loadLatest]);

  // ---- realtime: messages, reactions, presence ----
  useEffect(() => {
    const channel = supabase.channel(`room:${room.id}`, { config: { presence: { key: user.id } } });

    const resolveName = async (id: string | null) => {
      if (!id || names.current.has(id)) return;
      const { data } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
      if (data?.display_name) names.current.set(id, data.display_name);
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        async (p) => { const r = p.new as Row; await resolveName(r.sender_id); upsert([toMessage(r)]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (p) => { const r = p.new as Row; setMessages((prev) => prev.map((m) => (m.id === r.id ? { ...m, moderation_status: r.moderation_status } : m))); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `room_id=eq.${room.id}` },
        (p) => addReactions([p.new as ReactionRow]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (p) => { const o = p.old as Partial<ReactionRow>; if (o.message_id && o.user_id && o.reaction)
          setReactions((prev) => { const k = rkey(o as ReactionRow); if (!(k in prev)) return prev; const n = { ...prev }; delete n[k]; return n; }); })
      .on('presence', { event: 'sync' }, () => setOnline(Math.max(1, Object.keys(channel.presenceState()).length)))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConn('connected');
          await channel.track({ at: Date.now() });
          loadLatest();                      // backfill anything missed while (re)connecting
          everSubscribed.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConn(everSubscribed.current ? 'reconnecting' : 'connecting');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [supabase, room.id, user.id, upsert, toMessage, addReactions, loadLatest]);

  // ---- scrolling ----
  const onScroll = () => {
    const el = scroller.current; if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseen(0);
  };
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    if (preserve.current !== null) { el.scrollTop = el.scrollHeight - preserve.current; preserve.current = null; return; }
    if (atBottom.current || lastOwn.current) { el.scrollTop = el.scrollHeight; lastOwn.current = false; }
    else setUnseen((n) => n + 1);
  }, [messages.length]);
  const jumpToLatest = () => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); setUnseen(0); };

  // ---- actions ----
  async function send(text: string, isQuick = false) {
    if (sending || banned) return;
    setSending(true); setWarning(null);
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId: room.id, body: text }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        lastOwn.current = true;
        upsert([toMessage({ ...data.message, profiles: null })]);
        if (!isQuick) setDraft('');
      } else if (res.status === 403 && data.banned) {
        if (typeof data.strikes === 'number') setStrikes(data.strikes);
        setBanned(true); setWarning({ tone: 'warn', text: data.error });
      } else if (res.status === 422 && data.blocked) {
        if (typeof data.strikes === 'number') setStrikes(data.strikes);
        setWarning({ tone: 'warn', text: data.message });   // message stays in the box so the user can edit it
      } else setWarning({ tone: 'info', text: data.error ?? 'Could not send. Try again.' });
    } catch { setWarning({ tone: 'info', text: 'Network problem. Your message was not sent.' }); }
    setSending(false);
  }

  async function toggleReaction(messageId: string, reaction: string) {
    setPickerFor(null);
    const row = { message_id: messageId, user_id: user.id, reaction };
    const key = rkey(row);
    const had = key in reactions;
    if (had) setReactions((p) => { const n = { ...p }; delete n[key]; return n; });
    else addReactions([{ id: `local-${key}`, ...row }]);
    const { error } = had
      ? await supabase.from('message_reactions').delete().match(row)
      : await supabase.from('message_reactions').insert({ ...row, room_id: room.id });
    if (error && error.code !== '23505') {   // roll back
      if (had) addReactions([{ id: `local-${key}`, ...row }]);
      else setReactions((p) => { const n = { ...p }; delete n[key]; return n; });
      setWarning({ tone: 'info', text: 'Could not save your reaction.' });
    }
  }

  async function leave() {
    if (!confirm('Leave this room? You can rejoin later.')) return;
    await supabase.from('room_members').delete().eq('room_id', room.id).eq('user_id', user.id);
    router.push('/rooms'); router.refresh();
  }

  const reactionsByMessage = useMemo(() => {
    const out: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of Object.values(reactions)) {
      const m = (out[r.message_id] ??= {});
      const e = (m[r.reaction] ??= { count: 0, mine: false });
      e.count++; if (r.user_id === user.id) e.mine = true;
    }
    return out;
  }, [reactions, user.id]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim()) send(draft); }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-4xl flex-col px-0 sm:px-4 sm:py-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-pitch-600/70 bg-pitch-900/80 sm:rounded-3xl sm:border">
        {/* Header */}
        <header className="border-b border-pitch-600/70 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href="/rooms" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-chalk-dim hover:text-chalk"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All rooms</Link>
              <h1 className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{room.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-chalk-dim">
                <SportBadge sport={room.sportInfo} />
                {room.match
                  ? <>
                      <span>{room.match.team_a} vs {room.match.team_b}{room.match.score_a ? ` · ${room.match.score_a} - ${room.match.score_b ?? ''}` : ''}</span>
                      <DemoTag>Sample match data</DemoTag>
                    </>
                  : <span>{room.description || 'Open discussion'}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-chalk-dim" title="Fans currently in this room"><Users className="h-3.5 w-3.5" aria-hidden />{online} online</span>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                  conn === 'connected' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-flood/10 text-flood')} role="status">
                  {conn === 'connected' ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Live</> : <><WifiOff className="h-3 w-3" aria-hidden /> {conn === 'connecting' ? 'Connecting' : 'Reconnecting'}</>}
                </span>
              </div>
              <div className="relative flex items-center gap-1.5">
                <button onClick={() => setShowSafety((s) => !s)} aria-expanded={showSafety} aria-label="Community safety info"
                  className="btn-ghost !gap-1 !px-2 !py-1.5 !text-xs !font-medium text-chalk-dim">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden /> Moderated
                </button>
                <button onClick={leave} className="btn-ghost !p-2" aria-label="Leave room" title="Leave room"><LogOut className="h-4 w-4" /></button>
                {showSafety && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-pitch-600 bg-pitch-800 p-4 text-left text-xs text-chalk-dim shadow-xl">
                    <p className="font-semibold text-chalk">How this room stays safe</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>Emails and phone numbers are blocked before posting.</li>
                      <li>Abuse and threats are blocked. Heated sports banter is fine.</li>
                      <li>Three strikes removes someone from this room only.</li>
                      <li>Use the flag on a message to report it. Several reports hide it for review.</li>
                    </ul>
                    <p className="mt-3 rounded-lg bg-pitch-900 px-3 py-2 text-chalk">Your strikes here: {strikes} of {MAX_STRIKES}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="relative min-h-0 flex-1">
          <div ref={scroller} onScroll={onScroll} className="scroll-thin h-full space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Chat messages">
            {hasMore && (
              <div className="flex justify-center">
                <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost !py-1.5 !text-xs">
                  {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden />} Load older messages
                </button>
              </div>
            )}
            {loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-flood" aria-label="Loading messages" /></div>}
            {loadError && !loading && (
              <div role="alert" className="rounded-2xl bg-danger/10 p-4 text-center text-sm text-danger">{loadError}
                <button onClick={loadLatest} className="btn-ghost ml-3 !py-1">Retry</button></div>
            )}
            {!loading && !loadError && messages.length === 0 && (
              <div className="py-16 text-center">
                <p className="font-display text-lg font-bold">It&apos;s quiet in here</p>
                <p className="mt-1 text-sm text-chalk-dim">Send the first message or tap a quick reaction below.</p>
              </div>
            )}

            {messages.map((m) => {
              const mine = m.sender_id === user.id;
              const hidden = m.moderation_status !== 'approved';
              const rx = reactionsByMessage[m.id] ?? {};
              return (
                <div key={m.id} className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className="mb-1 flex items-center gap-2 px-1 text-xs text-chalk-faint">
                    <span className={cn('font-semibold', mine ? 'text-flood' : 'text-chalk-dim')}>{mine ? 'You' : m.sender_name}</span>
                    {m.is_demo && <DemoTag>Demo</DemoTag>}
                    <time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
                  </div>
                  <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[75%]',
                    mine ? 'rounded-br-md bg-flood text-pitch-950' : 'rounded-bl-md bg-pitch-700 text-chalk',
                    hidden && 'italic opacity-70')}>
                    {hidden ? 'This message is hidden while moderators review a report.' : m.body}
                  </div>

                  {!hidden && (
                    <div className={cn('mt-1 flex flex-wrap items-center gap-1', mine && 'justify-end')}>
                      {Object.entries(rx).map(([emoji, v]) => (
                        <button key={emoji} onClick={() => toggleReaction(m.id, emoji)} aria-pressed={v.mine}
                          aria-label={`${emoji} ${v.count} reaction${v.count === 1 ? '' : 's'}${v.mine ? ', including yours' : ''}`}
                          className={cn('rounded-full border px-2 py-0.5 text-xs', v.mine ? 'border-flood bg-flood/15 text-flood' : 'border-pitch-600 bg-pitch-800 text-chalk-dim hover:text-chalk')}>
                          {emoji} {v.count}
                        </button>
                      ))}
                      <div className="relative">
                        <button onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)} aria-label="Add reaction" aria-expanded={pickerFor === m.id}
                          className="rounded-full p-1 text-chalk-faint hover:bg-pitch-700 hover:text-chalk focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Smile className="h-4 w-4" /></button>
                        {pickerFor === m.id && (
                          <div className={cn('absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-pitch-600 bg-pitch-800 p-1 shadow-lg', mine ? 'right-0' : 'left-0')}>
                            {REACTIONS.map((e) => <button key={e} onClick={() => toggleReaction(m.id, e)} className="rounded-full px-1.5 py-1 text-lg hover:bg-pitch-600" aria-label={`React ${e}`}>{e}</button>)}
                          </div>
                        )}
                      </div>
                      {!mine && !m.is_demo && (
                        <button onClick={() => setReporting(m.id)} aria-label="Report message" title="Report message"
                          className="rounded-full p-1 text-chalk-faint hover:bg-pitch-700 hover:text-danger focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Flag className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {unseen > 0 && (
            <button onClick={jumpToLatest} className="btn-primary absolute bottom-3 left-1/2 -translate-x-1/2 !py-1.5 shadow-lg">
              <ArrowDown className="h-4 w-4" aria-hidden /> New messages
            </button>
          )}
        </div>

        {/* Composer */}
        <footer className="border-t border-pitch-600/70 bg-pitch-900 px-3 pb-3 pt-2 sm:px-4">
          {warning && (
            <p role="alert" className={cn('mb-2 rounded-xl px-3 py-2 text-sm', warning.tone === 'warn' ? 'bg-danger/10 text-danger' : 'bg-pitch-700 text-chalk-dim')}>{warning.text}</p>
          )}
          {banned ? (
            <div className="rounded-xl bg-pitch-800 p-4 text-center text-sm text-chalk-dim">
              You&apos;ve been removed from this room. <Link href="/rooms" className="font-semibold text-flood hover:underline">Find another room</Link>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="Quick reactions">
                <button onClick={() => setShowCatchUp(true)} className="btn-ghost shrink-0 !gap-1.5 !rounded-full !px-3 !py-1.5 !text-xs !text-flood">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> Catch me up
                </button>
                <span className="mx-1 h-5 w-px shrink-0 bg-pitch-600" aria-hidden />
                {['🔥', '👏', '😮', '😂', '😭', '🤯', '🎉'].map((e) => (
                  <button key={e} onClick={() => send(e, true)} disabled={sending} aria-label={`Send ${e} reaction`}
                    className="shrink-0 rounded-full border border-pitch-600 bg-pitch-800 px-2.5 py-1 text-lg hover:bg-pitch-700 disabled:opacity-50">{e}</button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="composer" className="sr-only">Message</label>
                  <textarea id="composer" rows={1} value={draft} maxLength={LIMITS.message} onChange={(e) => { setDraft(e.target.value); if (warning?.tone === 'warn') setWarning(null); }} onKeyDown={onKey}
                    placeholder="Say something about the match…" className="input max-h-32 min-h-[44px] resize-none" />
                  {draft.length > LIMITS.message - 80 && <p className="mt-1 text-right text-xs text-chalk-faint">{draft.length}/{LIMITS.message}</p>}
                </div>
                <button onClick={() => send(draft)} disabled={sending || !draft.trim()} className="btn-primary h-[44px] !px-4" aria-label="Send message">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>

      {showCatchUp && <CatchUpPanel roomId={room.id} onClose={() => setShowCatchUp(false)} />}
      {reporting && <ReportDialog messageId={reporting} userId={user.id} onClose={() => setReporting(null)} />}
    </div>
  );
}
