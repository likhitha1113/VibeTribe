import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreateRoomForm } from '@/components/CreateRoomForm';
import { SetupNotice } from '@/components/SetupNotice';
import { hasSupabaseEnv } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create a room | VibeTribe' };

export default async function NewRoomPage() {
  if (!hasSupabaseEnv()) return <SetupNotice detail="Supabase environment variables are missing." />;
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect('/auth?next=/rooms/new');
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">Create a room</h1>
      <p className="mb-6 mt-1 text-chalk-dim">Start a space for a match or a sport you love. You&apos;ll land inside it straight away.</p>
      <CreateRoomForm />
    </div>
  );
}
