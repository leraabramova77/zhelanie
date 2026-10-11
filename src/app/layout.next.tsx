// Слой app (FSD) — он же папка маршрутов Next.js.
// Маршрутами считаются только файлы *.next.tsx (см. pageExtensions в next.config.ts),
// поэтому слой src/pages Next.js не трогает.
import type { Metadata, Viewport } from 'next';
import { Manrope, Unbounded } from 'next/font/google';
import type { ReactNode } from 'react';
import { asset } from '@/shared/config';
import { Providers } from './providers/providers';
import './styles/globals.css';

const body = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-body', display: 'swap' });
const display = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Желание недели',
  description: 'Предлагай, что изменить в школе, и голосуй за лучшие идеи.',
  manifest: asset('/manifest.webmanifest'),
  icons: { icon: asset('/icon.svg'), apple: asset('/icon.svg') },
  appleWebApp: { capable: true, title: 'Желание недели', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${body.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
