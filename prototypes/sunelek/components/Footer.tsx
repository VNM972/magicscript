import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-blue-900 bg-blue-950 py-12 text-blue-100">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <span className="text-lg font-bold text-white">SUNELEK</span>
          <nav className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
            <Link href="#contact" className="text-sm transition hover:text-white">
              Contact
            </Link>
            <Link href="/mentions-legales" className="text-sm transition hover:text-white">
              Mentions légales
            </Link>
            <Link href="/politique-confidentialite" className="text-sm transition hover:text-white">
              Politique de confidentialité
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-center text-sm text-blue-300 sm:text-left">
          © {new Date().getFullYear()} SUNELEK. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
