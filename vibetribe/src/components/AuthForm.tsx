'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { checkPublicText } from '@/lib/moderation/rules';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-z0-9 _.-]{2,24}$/;

function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('email not confirmed')) return 'Confirm your email first, then sign in.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('password')) return message;
  return 'Something went wrong. Try again.';
}

export function AuthForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (mode === 'signup') {
      if (!NAME_RE.test(displayName.trim())) return setError('Display name: 2 to 24 letters, numbers, spaces, dots, dashes or underscores.');
      if (checkPublicText(displayName)) return setError('Please choose a respectful display name without contact details.');
    }

    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: displayName.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (!data.session) { setNotice('Check your inbox to confirm your email, then sign in.'); setBusy(false); return; }
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : ''));
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div role="tablist" aria-label="Account" className="mb-5 flex rounded-xl border border-pitch-600 bg-pitch-900 p-1 text-sm">
        {(['signin', 'signup'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setNotice(null); }} type="button"
            className={cn('flex-1 rounded-lg px-3 py-2 font-semibold', mode === m ? 'bg-flood text-pitch-950' : 'text-chalk-dim hover:text-chalk')}>
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === 'signup' && (
          <div>
            <label htmlFor="dn" className="label">Display name</label>
            <input id="dn" className="input" value={displayName} maxLength={24} autoComplete="nickname" onChange={(e) => setDisplayName(e.target.value)} placeholder="How fans will see you" />
            <p className="mt-1 text-xs text-chalk-faint">Shown in chat. Don&apos;t use your real name if you prefer to stay private.</p>
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)}  placeholder="For demo, u can enter dummy email and password"/>
        </div>
        <div>
          <label htmlFor="pw" className="label">Password</label>
          <input id="pw" type="password" className="input" value={password} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'signup' && <p className="mt-1 text-xs text-chalk-faint">At least 8 characters.</p>}
        </div>

        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-flood/10 px-3.5 py-2.5 text-sm text-flood">{notice}</p>}

        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
