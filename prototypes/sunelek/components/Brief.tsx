const ITEMS = [
  'Active depuis 2017',
  'Basée à Fort-de-France, Martinique',
  'Activité liée à la climatisation et aux installations thermiques',
];

export default function Brief() {
  return (
    <section id="brief" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-blue-950 sm:text-4xl">
          SUNELEK en bref
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {ITEMS.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6 font-medium text-slate-800"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
