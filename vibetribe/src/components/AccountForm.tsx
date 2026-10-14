'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AccountForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: name }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error ?? 'Could not save.' });
      else { setMsg({ ok: true, text: 'Display name saved.' }); router.refresh(); }
    } catch { setMsg({ ok: false, text: 'Network problem. Try again.' }); }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-6">
      <div>
        <label htmlFor="dn" className="label">Display name</label>
        <input id="dn" className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <p className="mt-1 text-xs text-chalk-faint">Letters, numbers, spaces, dots, dashes, underscores. 2 to 24 characters.</p>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-xl px-3.5 py-2.5 text-sm ${msg.ok ? 'bg-flood/10 text-flood' : 'bg-danger/10 text-danger'}`}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy || name.trim() === initialName}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save changes
      </button>
    </form>
  );
}
