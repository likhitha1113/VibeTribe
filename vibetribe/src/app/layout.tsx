import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/utils';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'VibeTribe: Your people. Your sport. Your moment.',
  description: 'Live match rooms where sports fans react, debate and celebrate together, with AI catch-ups and safer chat.',
};
export const viewport: Viewport = { themeColor: '#060F0B', width: 'device-width', initialScale: 1 };

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user: { id: string; displayName: string } | null = null;
  if (hasSupabaseEnv()) {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle();
        user = { id: data.user.id, displayName: p?.display_name ?? 'Fan' };
      }
    } catch { /* render signed-out chrome */ }
  }
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-flood focus:px-3 focus:py-2 focus:text-pitch-950">
          Skip to content
        </a>
        <Navbar user={user} />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
