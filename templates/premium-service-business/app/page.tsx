import type { CSSProperties } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { site } from "@/config/site";

export default function Home() {
  const verifiedProofPoints = site.proofPoints.filter((item) => item.verified);

  const themeStyle = {
    "--accent": site.theme.accent,
    "--accent-soft": site.theme.accentSoft,
  } as CSSProperties;

  return (
    <main id="top" style={themeStyle}>
      {site.isDemo && (
        <div className="demo-banner">
          Prototype Magic Script : informations à valider avant publication.
        </div>
      )}

      <div className="shell">
        <Header />

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{site.hero.eyebrow}</p>
            <h1>{site.hero.title}</h1>
            <p className="hero-description">{site.hero.description}</p>

            <div className="hero-actions">
              <a className="button button-primary" href="#contact">
                {site.hero.primaryCta}
              </a>
              <a className="button button-secondary" href="#services">
                {site.hero.secondaryCta}
              </a>
            </div>
          </div>

          <aside className="hero-panel" aria-label="Présentation">
            <span>Positionnement</span>
            <strong>{site.company.tagline}</strong>
            <p>{site.company.location}</p>
          </aside>
        </section>

        {verifiedProofPoints.length > 0 && (
          <section className="proof-grid" aria-label="Éléments de réassurance">
            {verifiedProofPoints.map((item) => (
              <article key={item.label} className="proof-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </section>
        )}

        <section id="services" className="section">
          <div className="section-heading">
            <p className="eyebrow">Expertises</p>
            <h2>Des services lisibles dès le premier regard.</h2>
            <p>
              Ne conserver ici que les prestations confirmées par des sources
              fiables ou directement validées par l'entreprise.
            </p>
          </div>

          <div className="service-grid">
            {site.services.map((service, index) => (
              <article className="service-card" key={service.title}>
                <span className="service-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="approche" className="section split-section">
          <div className="section-heading">
            <p className="eyebrow">Approche</p>
            <h2>{site.approach.title}</h2>
            <p>{site.approach.description}</p>
          </div>

          <ol className="steps">
            {site.approach.steps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section id="contact" className="contact-card">
          <div>
            <p className="eyebrow">Contact</p>
            <h2>Parlons de votre besoin.</h2>
            <p>
              Utiliser uniquement les coordonnées professionnelles vérifiées du
              prospect.
            </p>
          </div>

          <div className="contact-actions">
            {site.contact.email ? (
              <a
                className="button button-primary"
                href={`mailto:${site.contact.email}`}
              >
                {site.contact.primaryLabel}
              </a>
            ) : (
              <span className="contact-placeholder">
                Adresse email professionnelle à renseigner
              </span>
            )}

            {site.contact.phone && (
              <a className="text-link" href={`tel:${site.contact.phone}`}>
                {site.contact.phoneLabel || site.contact.phone}
              </a>
            )}

            {site.contact.address && <p>{site.contact.address}</p>}
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
