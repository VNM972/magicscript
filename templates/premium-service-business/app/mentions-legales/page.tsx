import { site } from "@/config/site";

const fields = [
  ["Éditeur", site.legal.publisher],
  ["Raison sociale", site.company.legalName],
  ["Forme juridique", site.legal.legalForm],
  ["Immatriculation", site.legal.registration],
  ["Siège social", site.legal.registeredOffice],
  ["Directeur de la publication", site.legal.publicationDirector],
  ["Hébergeur", site.legal.host],
];

export default function LegalNoticePage() {
  return (
    <main className="legal-page">
      <a href="/">Retour au site</a>
      <h1>Mentions légales</h1>
      <p className="legal-warning">
        Les champs non renseignés doivent être complétés et vérifiés avant toute
        mise en production.
      </p>

      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "À compléter"}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
