import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Magic Script · Deck',
  description: 'Magic Script operator commercial cockpit',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
