import './globals.css'

export default function Page() {
  return (
    <>
      {/* Sticky top CTA — visible when hero scrolls out */}
      <div className="sticky-cta" aria-label="Appel à l'action permanent">
        <a href="#contact" className="btn-primary">
          <span>Nous rendre visite</span>
          <span className="arrow" aria-hidden="true">→</span>
        </a>
      </div>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="container">
          <span className="eyebrow">Café &amp; Pâtisserie artisanale</span>
          <h1>
            Un atelier de café et de pâtisserie artisanale à Fort-de-France
          </h1>
          <p className="lede">
            Pâtisseries faites maison, ambiance de quartier et un lieu où s&rsquo;arrêter à Fort-de-France, en Martinique.
          </p>
          <div className="cta-row">
            <a href="#contact" className="btn-primary">
              <span>Nous rendre visite</span>
              <span className="arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── ABOUT / ARTISAN POSITIONING ── */}
      <section id="about" aria-labelledby="about-title">
        <div className="container">
          <h2 className="section-title" id="about-title">
            Un café de quartier, une démarche artisanale
          </h2>
          <p className="section-lede">
            Atelier Créole Café Test 003 est un lieu de proximité à Fort-de-France. Chaque pâtisserie est préparée sur place avec une démarche artisanale, dans le respect des saveurs locales.
          </p>
          <div className="about-card">
            <p>
              Notre équipe conçoit des créations sucrées qui puisent leur inspiration dans la richesse de la pâtisserie antillaise. L&rsquo;objectif&nbsp;: offrir un moment de qualité, dans un cadre simple et chaleureux.
            </p>
            <p>
              L&rsquo;activité combine un café de quartier ouvert à tous et un atelier de pâtisserie artisanale qui fait la part belle aux produits du terroir martiniquais.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT WE DO ── */}
      <section id="offres" aria-labelledby="offres-title">
        <div className="container">
          <h2 className="section-title" id="offres-title">
            Ce que nous proposons
          </h2>
          <p className="section-lede">
            Deux activités complémentaires qui font d&rsquo;Atelier Créole Café Test 003 un lieu de vie au quotidien.
          </p>
          <ul className="offering-list">
            <li className="offering-item">
              <span className="dot" aria-hidden="true" />
              <div>
                <h3>Café de quartier</h3>
                <p>
                  Un espace où venir boire un café, se poser un moment ou retrouver du monde à Fort-de-France. Une ambiance décontractée, ouverte aux résidents comme aux visiteurs de passage.
                </p>
              </div>
            </li>
            <li className="offering-item">
              <span className="dot" aria-hidden="true" />
              <div>
                <h3>Pâtisserie artisanale</h3>
                <p>
                  Des créations sucrées réalisées en petite série dans notre atelier. Les recettes s&rsquo;inspirent des saveurs antillaises et des techniques de la pâtisserie artisanale.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* ── VISIT / CONTACT CARD ── */}
      <section id="contact" aria-labelledby="contact-title">
        <div className="container">
          <h2 className="section-title" id="contact-title">
            Venir nous voir
          </h2>
          <p className="section-lede">
            Voici les informations nécessaires pour préparer votre venue à Atelier Créole Café Test 003.
          </p>
          <div className="visit-card">
            {/* Demo notice */}
            <div className="demo-note" role="note">
              <span className="badge">Demo</span>
              <span>
                Cette page est un prototype de démonstration. Les coordonnées ci-dessous ne sont pas encore actives.
              </span>
            </div>

            <div className="visit-field">
              <p className="visit-label">Adresse</p>
              <p className="visit-value muted">Adresse précise à confirmer</p>
            </div>

            <div className="visit-field">
              <p className="visit-label">Ville</p>
              <p className="visit-value">Fort-de-France, Martinique</p>
            </div>

            <div className="visit-field">
              <p className="visit-label">Horaires</p>
              <p className="visit-value muted">Horaires à venir</p>
            </div>

            <div className="visit-field">
              <p className="visit-label">Contact</p>
              <p className="visit-value muted">Coordonnées à venir</p>
            </div>

            <div className="cta-row section-cta-wrap">
              <button
                type="button"
                className="btn-primary"
                aria-disabled="true"
                title="Prototype de démonstration"
              >
                <span>Nous rendre visite</span>
                <span className="arrow" aria-hidden="true">→</span>
              </button>
              <p className="demo-cta-hint">Démo — l’action ne déclenche pas d’appel ni d’e-mail.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOCATION CONTEXT ── */}
      <section id="emplacement" aria-labelledby="emplacement-title">
        <div className="container">
          <h2 className="section-title" id="emplacement-title">
            Où nous trouver
          </h2>
          <p className="section-lede">
            Atelier Créole Café Test 003 est implanté au cœur de Fort-de-France, la capitale de la Martinique.
          </p>
          <p className="location-note">
            Nous sommes situés à Fort-de-France, à proximité des principaux axes et lieux de vie du centre-ville. Des précisions sur l&rsquo;adresse exacte et les points de repère vous seront communiquées lors de la mise à jour de cette page.
          </p>
        </div>
      </section>

      {/* ── SOCIAL PRESENCE ── */}
      <section id="suivre" aria-labelledby="suivre-title">
        <div className="container">
          <h2 className="section-title" id="suivre-title">
            Restez informé
          </h2>
          <p className="section-lede">
            Atelier Créole Café Test 003 est actif sur les réseaux sociaux pour suivre les nouveautés, les créations du moment et la vie du quartier.
          </p>
          <div className="social-block">
            <div className="social-item">
              <span className="dot" aria-hidden="true" />
              <div>
                <strong>Réseaux sociaux</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>
                  Suivez-nous en ligne pour découvrir les actualités de l&rsquo;atelier et les nouvelles créations pâtissières.
                </p>
              </div>
            </div>
            <div className="social-cta-wrap">
              <button
                type="button"
                className="btn-secondary"
                aria-disabled="true"
                title="Prototype de démonstration"
              >
                <span>Nous suivre en ligne</span>
                <span className="arrow" aria-hidden="true">↗</span>
              </button>
              <p className="demo-cta-hint">Démo — le lien ne mène à aucun profil.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="container">
          <p>
            <strong>Atelier Créole Café Test 003</strong>
          </p>
          <p>Café local et pâtisserie artisanale · Fort-de-France, Martinique</p>
          <p style={{ marginTop: '12px', fontSize: '13px' }}>
            Prototype de démonstration — toutes les informations sont indicatives.
          </p>
        </div>
      </footer>
    </>
  )
}
