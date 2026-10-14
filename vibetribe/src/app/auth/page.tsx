import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthForm } from '@/components/AuthForm';
import { SetupNotice } from '@/components/SetupNotice';
import { hasSupabaseEnv, safeNext } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | VibeTribe' };

export default async function AuthPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  if (!hasSupabaseEnv()) return <SetupNotice detail="Supabase environment variables are missing." />;
  const next = safeNext(searchParams.next, '/rooms');
  const { data: { user } } = await createClient().auth.getUser();
  if (user) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold">Join your tribe</h1>
      <p className="mb-6 mt-1 text-chalk-dim">Sign in to join rooms and chat with fellow fans.</p>
      <AuthForm next={next} initialError={searchParams.error === 'confirm' ? 'That confirmation link did not work. Try signing in or request a new one.' : undefined} />
    </div>
  );
}
