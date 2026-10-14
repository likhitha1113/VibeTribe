import { sportStyle } from '@/lib/sports';
import { cn } from '@/lib/utils';
import type { Sport } from '@/lib/types';

export function SportBadge({ sport, className }: { sport: Sport; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', sportStyle(sport.slug).badge, className)}>
      <span aria-hidden>{sport.emoji}</span>{sport.name}
    </span>
  );
}

export function DemoTag({ children = 'Demo data' }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-flood/50 px-2 py-0.5 text-[11px] font-semibold text-flood">
      {children}
    </span>
  );
}
