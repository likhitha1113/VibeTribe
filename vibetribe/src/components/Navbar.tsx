'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-flood text-pitch-950">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5l8 14 8-14" />
        </svg>
      </span>
      VibeTribe
    </span>
  );
}

export function Navbar({ user }: { user: { id: string; displayName: string } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/rooms', label: 'Find rooms' },
  ];

  async function signOut() {
    await createClient().auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-pitch-600/60 bg-pitch-950/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="Main">
        <Link href="/" aria-label="VibeTribe home"><Wordmark /></Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={cn('rounded-lg px-3 py-2 text-sm font-medium text-chalk-dim hover:text-chalk', pathname === l.href && 'bg-pitch-800 text-chalk')}>
              {l.label}
            </Link>
          ))}
          <Link href="/rooms/new" className="btn-primary ml-2"><Plus className="h-4 w-4" aria-hidden /> Create room</Link>
          {user ? (
            <div className="ml-2 flex items-center gap-1">
              <Link href="/account" className="rounded-lg px-3 py-2 text-sm font-medium text-chalk-dim hover:text-chalk">{user.displayName}</Link>
              <button onClick={signOut} className="btn-ghost !px-3" aria-label="Sign out"><LogOut className="h-4 w-4" aria-hidden /></button>
            </div>
          ) : (
            <Link href="/auth" className="btn-ghost ml-2">Sign in</Link>
          )}
        </div>

        <button className="btn-ghost !px-3 md:hidden" onClick={() => setOpen((o) => !o)}
          aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-pitch-600/60 bg-pitch-950 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-pitch-800">{l.label}</Link>
            ))}
            <Link href="/rooms/new" onClick={() => setOpen(false)} className="btn-primary mt-1"><Plus className="h-4 w-4" aria-hidden /> Create room</Link>
            {user ? (
              <>
                <Link href="/account" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-pitch-800">Signed in as {user.displayName}</Link>
                <button onClick={signOut} className="btn-ghost">Sign out</button>
              </>
            ) : (
              <Link href="/auth" onClick={() => setOpen(false)} className="btn-ghost">Sign in</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
