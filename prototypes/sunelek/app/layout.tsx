import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SUNELEK | Climatisation et installations thermiques en Martinique',
  description:
    'SUNELEK, entreprise basée à Fort-de-France depuis 2017, spécialisée dans la climatisation et les installations thermiques en Martinique.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
