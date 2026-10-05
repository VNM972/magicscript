import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Atelier Créole Café Test 003 — Café et pâtisserie artisanale à Fort-de-France',
  description:
    'Un café de quartier à Fort-de-France, en Martinique, connu pour ses pâtisseries artisanales. Découvrez notre adresse et venez nous rendre visite.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}