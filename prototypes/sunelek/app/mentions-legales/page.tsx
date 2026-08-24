import Link from 'next/link';

export default function MentionsLegales() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      <section className="py-12 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="mb-4 text-sm text-gray-500 italic">
            Prototype de démonstration Magic Script — mentions légales à compléter avant mise en production.
          </p>

          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Mentions légales
          </h1>

          <div className="space-y-4 text-gray-700">
            <p>
              <strong className="font-medium">Éditeur du site :</strong> SUNELEK
            </p>
            <p>
              <strong className="font-medium">Forme juridique :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Adresse du siège :</strong><br />
              28 Boulevard Nelson Mandela Léon Laouchez-Espace Anita<br />
              97200 Fort-de-France, Martinique
            </p>
            <p>
              <strong className="font-medium">Téléphone :</strong>
              <a href="tel:0596711010" className="underline hover:no-underline">
                05 96 71 10 10
              </a>
            </p>
            <p>
              <strong className="font-medium">SIREN / SIRET :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Capital social :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Numéro de TVA :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Directeur de la publication :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Hébergeur :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Contact email :</strong> À compléter par SUNELEK
            </p>
          </div>

          <div className="mt-8">
            <Link href="/" className="text-blue-600 hover:underline">
              ← Retour à l’accueil
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}