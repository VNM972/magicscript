import { site } from "@/config/site";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <a href="/">Retour au site</a>
      <h1>Politique de confidentialité</h1>

      <p>
        Cette page est un modèle à adapter aux traitements de données réellement
        mis en œuvre par {site.company.name}.
      </p>

      <h2>Données collectées</h2>
      <p>
        Décrire uniquement les données effectivement collectées par les
        formulaires, outils de mesure d'audience ou services tiers activés sur le
        site.
      </p>

      <h2>Finalités et durée de conservation</h2>
      <p>
        Renseigner les finalités, bases légales et durées de conservation
        applicables avant mise en ligne.
      </p>

      <h2>Droits des personnes</h2>
      <p>
        Ajouter l'adresse de contact permettant d'exercer les droits d'accès,
        rectification, effacement, opposition et limitation lorsque ces droits
        s'appliquent.
      </p>

      <h2>Sous-traitants et hébergement</h2>
      <p>
        Vérifier et lister les prestataires réellement utilisés. Hébergement
        technique prévu par défaut : {site.legal.host}.
      </p>
    </main>
  );
}
