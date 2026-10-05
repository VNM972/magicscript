'use client';

import { usePathname } from 'next/navigation';

const destinations = [
  ['Prospects', '/prospects'],
  ['Rendez-vous', '/rendez-vous'],
  ['Améliorations', '/ameliorations'],
  ['Archives', '/archives'],
  ['Ruche', '/ruche'],
  ['Intake manuel', '/pain-first-intake'],
] as const;

export default function DeckHeader() {
  const pathname = usePathname();
  return <header className="deck-header">
    <a className="brand" href="/" aria-label="Magic Script, accueil"><span className="brand-mark">✦</span><span>MAGIC SCRIPT</span></a>
    <label className="search-field"><span className="sr-only">Rechercher un prospect</span><input type="search" placeholder="Rechercher un prospect" /></label>
    <nav className="main-nav" aria-label="Navigation principale">
      {destinations.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return <a className={`nav-item${active ? ' active' : ''}`} href={href} aria-current={active ? 'page' : undefined} key={href}>{label}</a>;
      })}
    </nav>
  </header>;
}
