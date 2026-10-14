import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { RoomDiscovery } from '@/components/RoomDiscovery';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find rooms | VibeTribe' };

export default function RoomsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Find your room</h1>
          <p className="mt-1 text-chalk-dim">Public rooms for matches, teams and sport communities.</p>
        </div>
        <Link href="/rooms/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> Create room</Link>
      </div>
      <Suspense fallback={<div className="card h-32 animate-pulse" />}>
        <RoomDiscovery />
      </Suspense>
    </div>
  );
}
