export function SetupNotice({ detail }: { detail?: string }) {
  return (
    <div className="card mx-auto my-10 max-w-xl p-6" role="alert">
      <h2 className="font-display text-xl font-bold">Finish setting up VibeTribe</h2>
      <p className="mt-2 text-sm text-chalk-dim">
        The app could not reach its database. Add your Supabase keys to <code className="rounded bg-pitch-700 px-1.5 py-0.5">.env.local</code>,
        run <code className="rounded bg-pitch-700 px-1.5 py-0.5">supabase/schema.sql</code> then <code className="rounded bg-pitch-700 px-1.5 py-0.5">supabase/seed.sql</code>,
        and restart the dev server. The README walks through it step by step.
      </p>
      {detail && <p className="mt-3 text-xs text-chalk-faint">Details: {detail}</p>}
    </div>
  );
}
