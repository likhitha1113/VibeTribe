'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { REPORT_REASONS } from '@/lib/types';

export function ReportDialog({ messageId, userId, onClose }: { messageId: string; userId: string; onClose: () => void }) {
  const [reason, setReason] = useState<string>('abuse');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient().from('message_reports').insert({
      message_id: messageId, reporter_id: userId, reason, details: details.trim() || null,
    });
    setBusy(false);
    if (!error) setResult({ ok: true, text: 'Thanks. Your report was sent. Messages reported by several members are hidden for review.' });
    else if (error.code === '23505') setResult({ ok: true, text: 'You already reported this message.' });
    else setResult({ ok: false, text: 'Could not send the report. Try again.' });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rep-t" onClick={(e) => e.stopPropagation()} className="card w-full max-w-sm bg-pitch-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="rep-t" className="font-display text-lg font-bold">Report message</h2>
          <button onClick={onClose} className="btn-ghost !p-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {result ? (
          <div>
            <p role={result.ok ? 'status' : 'alert'} className={`text-sm ${result.ok ? 'text-chalk-dim' : 'text-danger'}`}>{result.text}</p>
            <button onClick={onClose} className="btn-primary mt-4">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="reason" className="label">What&apos;s wrong?</label>
              <select id="reason" ref={ref} className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="det" className="label">Details (optional)</label>
              <textarea id="det" className="input min-h-20" maxLength={200} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send report</button>
          </form>
        )}
      </div>
    </div>
  );
}
