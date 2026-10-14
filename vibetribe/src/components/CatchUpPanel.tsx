'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import type { CatchUpSummary } from '@/lib/catchup';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty'; message: string }
  | { kind: 'ready'; summary: CatchUpSummary; source: 'ai' | 'fallback'; cached: boolean; messageCount: number };

export function CatchUpPanel({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const closeRef = useRef<HTMLButtonElement>(null);

  const run = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/catchup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: 'error', message: data.error ?? 'Could not generate a summary.' });
      if (data.notEnough || !data.summary) return setState({ kind: 'empty', message: data.message });
      setState({ kind: 'ready', summary: data.summary, source: data.source, cached: Boolean(data.cached), messageCount: data.messageCount });
    } catch { setState({ kind: 'error', message: 'Network problem. Check your connection and try again.' }); }
  }, [roomId]);

  useEffect(() => { run(); }, [run]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-stretch sm:justify-end" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="cu-title" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl border border-pitch-600 bg-pitch-900 shadow-2xl animate-sheetUp sm:max-h-none sm:max-w-md sm:animate-slideIn sm:rounded-none sm:rounded-l-3xl">
        <header className="flex items-center justify-between border-b border-pitch-600/70 px-5 py-4">
          <h2 id="cu-title" className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-5 w-5 text-flood" aria-hidden /> Catch me up</h2>
          <div className="flex gap-1">
            <button onClick={run} className="btn-ghost !p-2" aria-label="Refresh summary" disabled={state.kind === 'loading'}><RefreshCw className="h-4 w-4" /></button>
            <button ref={closeRef} onClick={onClose} className="btn-ghost !p-2" aria-label="Close summary"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
          {state.kind === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-12 text-chalk-dim">
              <Loader2 className="h-6 w-6 animate-spin text-flood" aria-hidden />
              <p className="text-sm">Reading the recent chat…</p>
            </div>
          )}
          {state.kind === 'error' && (
            <div role="alert" className="rounded-2xl bg-danger/10 p-4 text-sm text-danger">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden /> Couldn&apos;t catch you up</p>
              <p className="mt-1">{state.message}</p>
              <button onClick={run} className="btn-ghost mt-3 !py-1.5">Try again</button>
            </div>
          )}
          {state.kind === 'empty' && <p className="rounded-2xl bg-pitch-800 p-4 text-sm text-chalk-dim">{state.message}</p>}
          {state.kind === 'ready' && (
            <>
              <p className="font-display text-lg font-bold leading-snug">{state.summary.headline}</p>
              {state.summary.topics.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-chalk-dim">What people are discussing</h3>
                  <ul className="space-y-2">
                    {state.summary.topics.map((t, i) => (
                      <li key={i} className="rounded-xl bg-pitch-800 p-3"><p className="text-sm font-semibold">{t.title}</p><p className="mt-0.5 text-sm text-chalk-dim">{t.detail}</p></li>
                    ))}
                  </ul>
                </section>
              )}
              {state.summary.reactions.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-chalk-dim">Notable reactions</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{state.summary.reactions.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </section>
              )}
              {state.summary.open_questions.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-chalk-dim">Still unanswered</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{state.summary.open_questions.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </section>
              )}
            </>
          )}
        </div>

        {state.kind === 'ready' && (
          <footer className="border-t border-pitch-600/70 px-5 py-3 text-xs text-chalk-faint">
            Based on the last {state.messageCount} messages in this room
            {state.source === 'ai' ? ', summarised by AI' : ' (basic recap: AI was unavailable)'}
            {state.cached ? ' · saved recently' : ''}. It may miss nuance and is not verified match data.
          </footer>
        )}
      </aside>
    </div>
  );
}
