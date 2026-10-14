'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function JoinRoomButton({
  roomId, signedIn, isMember = false, className = 'btn-primary !py-1.5', onError,
}: { roomId: string; signedIn: boolean; isMember?: boolean; className?: string; onError?: (m: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    if (!signedIn) return router.push(`/auth?next=${encodeURIComponent(`/rooms/${roomId}`)}`);
    if (isMember) return router.push(`/rooms/${roomId}`);
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return router.push(`/auth?next=${encodeURIComponent(`/rooms/${roomId}`)}`); }
    const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id, role: 'member' });
    if (error && error.code !== '23505') {
      setBusy(false);
      const msg = error.code === '42501' ? "You can't join this room (you may have been removed from it)." : 'Could not join. Try again.';
      setError(msg); onError?.(msg);
      return;
    }
    router.push(`/rooms/${roomId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={go} disabled={busy} className={className}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isMember ? 'Open' : signedIn ? 'Join' : 'Sign in to join'}
      </button>
      {error && !onError && <p role="alert" className="max-w-[14rem] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
