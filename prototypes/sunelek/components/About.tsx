export default function About() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-blue-950 sm:text-4xl">
            Qui sommes‑nous ?
          </h2>
          <p className="mt-6 max-w-xl leading-relaxed text-slate-600">
            SUNELEK est une entreprise active depuis 2017, basée à Fort‑de‑France, spécialisée dans la climatisation et les installations thermiques en Martinique.
          </p>
        </div>

        <div className="relative h-64 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 sm:h-80">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-52 w-52 -translate-x-1/4 translate-y-1/4 rounded-full bg-sky-300/20" />
        </div>
      </div>
    </section>
  );
}
