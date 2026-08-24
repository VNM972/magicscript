import Link from 'next/link';

export default function PolitiqueConfidentialite() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      <section className="py-12 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="mb-4 text-sm text-gray-500 italic">
            Prototype de démonstration Magic Script — politique de confidentialité à compléter avant mise en production.
          </p>

          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Politique de confidentialité
          </h1>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Fonctionnement du prototype
          </h2>
          <p className="mb-6 text-gray-700">
            Dans ce prototype de démonstration Magic Script, le formulaire de demande de devis fonctionne uniquement dans le navigateur. Les informations saisies ne sont ni envoyées, ni enregistrées, ni stockées.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Avant mise en production
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>
              <strong className="font-medium">Responsable du traitement :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Finalités du traitement :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Base juridique :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Destinataires des données :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Transferts hors UE :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Durée de conservation :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Droits des personnes :</strong> À compléter par SUNELEK
            </p>
            <p>
              <strong className="font-medium">Contact pour l’exercice des droits :</strong> À compléter par SUNELEK
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