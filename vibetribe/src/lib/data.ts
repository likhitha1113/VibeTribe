import type { SupabaseClient } from '@supabase/supabase-js';
import type { Catalog, Match, Room, RoomStat, RoomWithMeta, Sport } from './types';

const FALLBACK_SPORT = (slug: string): Sport => ({ slug, name: slug, emoji: '🏟️', sort_order: 999 });

/** Loads sports, sample fixtures and rooms (with member counts) in one parallel round trip. */
export async function fetchCatalog(supabase: SupabaseClient): Promise<Catalog> {
  const [s, m, r, st] = await Promise.all([
    supabase.from('sports').select('*').order('sort_order'),
    supabase.from('matches').select('*').order('starts_at', { ascending: false }),
    supabase.from('rooms').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('room_stats').select('*'),
  ]);
  const err = s.error ?? m.error ?? r.error ?? st.error;
  if (err) throw new Error(err.message);

  const sports = (s.data ?? []) as Sport[];
  const sportMap = new Map(sports.map((x) => [x.slug, x]));
  const matches = (m.data ?? []) as Match[];
  const matchMap = new Map(matches.map((x) => [x.id, x]));
  const statMap = new Map(((st.data ?? []) as RoomStat[]).map((x) => [x.room_id, x]));

  const rooms: RoomWithMeta[] = ((r.data ?? []) as Room[]).map((room) => ({
    ...room,
    match: room.match_id ? matchMap.get(room.match_id) ?? null : null,
    stats: statMap.get(room.id) ?? { room_id: room.id, member_count: 0, recent_messages: 0, last_message_at: null },
    sportInfo: sportMap.get(room.sport) ?? FALLBACK_SPORT(room.sport),
  }));

  return {
    sports,
    matches: matches.map((x) => ({ ...x, sportInfo: sportMap.get(x.sport) ?? FALLBACK_SPORT(x.sport) })),
    rooms,
  };
}

export async function fetchRoom(supabase: SupabaseClient, id: string): Promise<RoomWithMeta | null> {
  const { data: room, error } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!room) return null;
  const [sp, mt, st] = await Promise.all([
    supabase.from('sports').select('*').eq('slug', room.sport).maybeSingle(),
    room.match_id ? supabase.from('matches').select('*').eq('id', room.match_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('room_stats').select('*').eq('room_id', id).maybeSingle(),
  ]);
  return {
    ...(room as Room),
    match: (mt.data as Match | null) ?? null,
    stats: (st.data as RoomStat | null) ?? { room_id: id, member_count: 0, recent_messages: 0, last_message_at: null },
    sportInfo: (sp.data as Sport | null) ?? FALLBACK_SPORT(room.sport),
  };
}
