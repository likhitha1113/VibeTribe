/** Visual accents per sport. Unknown (newly added) sports fall back to "default". */
const STYLES: Record<string, { badge: string; bar: string }> = {
  cricket: { badge: 'bg-sky-400/10 text-sky-300 ring-sky-400/30', bar: 'bg-sky-400' },
  football: { badge: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30', bar: 'bg-emerald-400' },
  kabaddi: { badge: 'bg-orange-400/10 text-orange-300 ring-orange-400/30', bar: 'bg-orange-400' },
  default: { badge: 'bg-violet-400/10 text-violet-300 ring-violet-400/30', bar: 'bg-violet-400' },
};
export const sportStyle = (slug: string) => STYLES[slug] ?? STYLES.default;
