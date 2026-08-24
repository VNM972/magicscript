function IconThermal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10.5m0 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 6h5" />
    </svg>
  );
}

function IconClimate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
    </svg>
  );
}

const SERVICES = [
  {
    title: 'Installation d’équipements thermiques',
    description:
      'Installation d’équipements thermiques pour les besoins des particuliers et des professionnels en Martinique.',
    Icon: IconThermal,
  },
  {
    title: 'Climatisation',
    description:
      'Solutions de climatisation en Martinique, dans le cadre de l’activité déclarée de SUNELEK.',
    Icon: IconClimate,
  },
];

export default function Services() {
  return (
    <section id="services" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-blue-950 sm:text-4xl">
          Nos services
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {SERVICES.map(({ title, description, Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-900 text-white">
                <Icon />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-3 leading-relaxed text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
