'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '/#accueil', label: 'Accueil' },
  { href: '/#services', label: 'Services' },
  { href: '/#brief', label: 'SUNELEK en bref' },
  { href: '/#contact', label: 'Contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <Link
            href="/#accueil"
            className="text-lg font-bold tracking-tight text-blue-950 sm:text-xl"
            onClick={() => setOpen(false)}
          >
            SUNELEK
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-blue-950"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              className="rounded-full bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-950"
            >
              Demander un devis
            </Link>
          </nav>

          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-mobile"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-50 md:hidden"
          >
            <span className="sr-only">{open ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        <div
          id="menu-mobile"
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out md:hidden ${
            open ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <nav className="flex flex-col gap-1 pb-5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-blue-900 px-4 py-3 text-center font-semibold text-white"
            >
              Demander un devis
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
