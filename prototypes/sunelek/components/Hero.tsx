import Link from 'next/link';

export default function Hero() {
  return (
    <section id="accueil" className="relative overflow-hidden bg-blue-950">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-700/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center sm:py-28">
        <span className="mb-6 inline-flex items-center rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-1.5 text-sm font-medium text-blue-100">
          Depuis 2017 · Fort-de-France, Martinique
        </span>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl sm:leading-tight">
          Spécialiste de la climatisation et de l’installation thermique en Martinique
        </h1>

        <p className="mt-6 max-w-xl text-lg text-blue-100/80 sm:text-xl">
          Entreprise active depuis 2017, basée à Fort‑de‑France
        </p>

        <div className="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <Link
            href="#contact"
            className="rounded-full bg-white px-8 py-3.5 text-center text-base font-semibold text-blue-950 shadow-lg shadow-blue-950/30 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-blue-950"
          >
            Demander un devis
          </Link>
          <a
            href="tel:0596711010"
            className="rounded-full border border-blue-300/40 px-8 py-3.5 text-center text-base font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-blue-950"
          >
            05 96 71 10 10
          </a>
        </div>
      </div>
    </section>
  );
}
