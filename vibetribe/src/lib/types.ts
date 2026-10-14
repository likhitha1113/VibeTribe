export type Sport = { slug: string; name: string; emoji: string; sort_order: number };

export type Match = {
  id: string;
  sport: string;
  team_a: string;
  team_b: string;
  competition: string | null;
  status: 'upcoming' | 'live' | 'finished';
  score_a: string | null;
  score_b: string | null;
  status_note: string | null;
  venue: string | null;
  starts_at: string;
  is_demo: boolean;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  sport: string;
  match_id: string | null;
  created_by: string | null;
  visibility: 'public';
  created_at: string;
};

export type RoomStat = { room_id: string; member_count: number; recent_messages: number; last_message_at: string | null };

export type MatchWithSport = Match & { sportInfo: Sport };
export type RoomWithMeta = Room & { match: Match | null; stats: RoomStat; sportInfo: Sport };

export type Catalog = { sports: Sport[]; matches: MatchWithSport[]; rooms: RoomWithMeta[] };

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  moderation_status: 'approved' | 'under_review' | 'removed';
  is_demo: boolean;
  demo_author: string | null;
  sender_name: string;
};

export type ReactionRow = { id: string; message_id: string; user_id: string; reaction: string };

export const REACTIONS = ['🔥', '👏', '😮', '😂', '😭', '🤯'] as const;

export const REPORT_REASONS = [
  { value: 'abuse', label: 'Abusive or threatening' },
  { value: 'personal_info', label: 'Shares personal information' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
] as const;

export const LIMITS = { message: 500, roomName: 60, roomDescription: 200, displayName: 24 } as const;
export const MAX_STRIKES = 3;
