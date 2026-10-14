import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountForm } from '@/components/AccountForm';
import { hasSupabaseEnv } from '@/lib/utils';
import { SetupNotice } from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your profile | VibeTribe' };

export default async function AccountPage() {
  if (!hasSupabaseEnv()) return <SetupNotice detail="Supabase environment variables are missing." />;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?next=/account');
  const { data: p } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold">Your profile</h1>
      <p className="mb-6 mt-1 text-chalk-dim">This is the name other fans see in chat.</p>
      <AccountForm initialName={p?.display_name ?? ''} />
    </div>
  );
}
