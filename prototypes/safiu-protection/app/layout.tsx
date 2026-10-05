import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { siteConfig } from './site-config';

export const metadata: Metadata = {
  title: 'SAFIU PROTECTION | Prévenir. Accompagner. Protéger.',
  description:
    'SAFIU PROTECTION accompagne les missions de protection des personnes, les déplacements et les événements avec discrétion et méthode.',
  robots: {
    index: process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true',
    follow: process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
