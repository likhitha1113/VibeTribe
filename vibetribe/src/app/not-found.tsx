import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-extrabold">That page is offside</h1>
      <p className="mt-2 text-chalk-dim">We couldn&apos;t find what you were looking for.</p>
      <Link href="/rooms" className="btn-primary mt-6">Find a room</Link>
    </div>
  );
}
