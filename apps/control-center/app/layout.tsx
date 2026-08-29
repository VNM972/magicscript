import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Magic Script Control Center',
  description: 'Autonomous prospecting and swarm operations dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
