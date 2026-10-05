'use client';

import { FormEvent, useState } from 'react';
import { siteConfig } from './site-config';

const recipient = siteConfig.contactEmail;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="arrow-icon">
      <path d="M3 10h13M11 4l6 6-6 6" />
    </svg>
  );
}

export default function Page() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFormError(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });

      if (!response.ok) throw new Error('contact_failed');
      setSent(true);
    } catch {
      setFormError(true);
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#accueil" aria-label="SAFIU Protection, accueil" onClick={closeMenu}>
            <img src="/media/safiu-logo.png" alt="SAFIU Protection" />
            <span><strong>SAFIU</strong><small>PROTECTION</small></span>
          </a>
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}>
            <span>{menuOpen ? 'Fermer' : 'Menu'}</span><i aria-hidden="true" />
          </button>
          <nav id="main-navigation" className={`desktop-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navigation principale">
            <a href="#expertise" onClick={closeMenu}>Expertises</a>
            <a href="#approche" onClick={closeMenu}>Approche</a>
            <a href="#fondateurs" onClick={closeMenu}>Fondateurs</a>
            <a href="#references" onClick={closeMenu}>Médias</a>
            <a className="nav-cta" href="#contact" onClick={closeMenu}>Demande de mission <ArrowIcon /></a>
          </nav>
        </div>
      </header>

      <section id="accueil" className="hero">
        <div className="section-shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Protection privée · Présence maîtrisée</p>
            <h1>La protection se prépare <em>avant</em> d’être visible.</h1>
            <p className="hero-lede">SAFIU PROTECTION accompagne les personnes, les déplacements et les événements qui exigent une présence fiable, discrète et adaptée à chaque contexte.</p>
            <div className="hero-actions"><a className="button button-dark" href="#contact">Demande de mission <ArrowIcon /></a><a className="text-link" href={siteConfig.phoneHref}>{siteConfig.phoneDisplay}</a></div>
            <div className="hero-proof"><span className="proof-line" /><p>Une organisation pensée autour de la mission, de la confidentialité et de la prévention.</p></div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-wrap"><img src="/media/team-universal-aviation.jpg" alt="Équipe Safiu Protection devant un site d’accueil" /></div>
            <div className="visual-caption"><span>01</span><p>Présence<br /><strong>maîtrisée</strong></p></div>
            <div className="visual-stamp" aria-hidden="true">S<br /><span>F</span></div>
          </div>
        </div>
      </section>

      <section id="expertise" className="expertise-section">
        <div className="section-shell expertise-layout">
          <div className="section-intro"><p className="eyebrow"><span /> Nos domaines d’intervention</p><h2>Un dispositif juste.<br /><em>Pour chaque mission.</em></h2><p>Le niveau de présence et l’organisation sont étudiés selon le contexte, le profil de la mission et les informations communiquées.</p></div>
          <div className="expertise-list">
            <article className="expertise-item"><span className="card-number">01</span><div><h3>Protection rapprochée</h3><p>Accompagnement de personnes exposées, de leurs déplacements et de leurs rendez-vous.</p></div><ArrowIcon /></article>
            <article className="expertise-item"><span className="card-number">02</span><div><h3>Protection privée</h3><p>Une présence discrète et adaptée aux contextes professionnels ou personnels qui nécessitent une attention particulière.</p></div><ArrowIcon /></article>
          </div>
        </div>
      </section>

      <section id="approche" className="approach-section">
        <div className="section-shell approach-layout">
          <div className="approach-image"><img src="/media/trophy-event.jpg" alt="Membres de l’équipe lors d’un événement" /><div className="image-label">L’expérience du terrain<br /><strong>au service du calme</strong></div></div>
          <div className="approach-copy"><p className="eyebrow"><span /> Notre approche</p><h2>Le sérieux ne se proclame pas.<br /><em>Il se démontre.</em></h2><p className="lead">Anticiper les contraintes, comprendre l’environnement et garder une longueur d’avance : la protection efficace commence par une préparation rigoureuse.</p><div className="principles"><div><span>01</span><p><strong>Prévenir</strong><br />Observer, préparer et réduire l’exposition avant l’intervention.</p></div><div><span>02</span><p><strong>S’adapter</strong><br />Ajuster le dispositif au profil, au lieu et au rythme de la mission.</p></div><div><span>03</span><p><strong>Rester discret</strong><br />Protéger sans perturber le cadre professionnel ou personnel.</p></div></div></div>
        </div>
      </section>

      <section id="fondateurs" className="founders-section">
        <div className="section-shell founders-layout">
          <div className="founders-intro"><p className="eyebrow"><span /> Une direction engagée</p><h2>Deux parcours.<br /><em>Une même exigence.</em></h2><p>SAFIU PROTECTION s’appuie sur une direction qui place la préparation, la qualité d’exécution et la confidentialité au centre de chaque mission.</p></div>
          <div className="founders-grid">
            <article className="founder-card"><img src="/media/founder-jammeh-enhanced.png" alt="Jammeh Oumar, PDG de Safiu Protection" /><div className="founder-card-body"><p className="card-role">PDG · Fondateur</p><h3>Jammeh Oumar</h3><p>Ancien militaire français, il met son expérience de la sécurité de terrain et de la coordination au service de la préparation des missions.</p></div></article>
            <article className="founder-card"><img src="/media/founder-bryks.png" alt="Bryks Ghislain, DAF de Safiu Protection" /><div className="founder-card-body"><p className="card-role">DAF · Co-fondateur</p><h3>Bryks Ghislain</h3><p>Fort de plus de quinze ans dans la sécurité, il veille à la qualité des dispositifs et au respect du cadre éthique des missions.</p></div></article>
          </div>
        </div>
      </section>

      <section id="references" className="media-section">
        <div className="section-shell">
          <div className="media-heading"><div><p className="eyebrow"><span /> Sur le terrain</p><h2>Une présence qui<br /><em>reste humaine.</em></h2></div><p>Quelques images transmises par SAFIU PROTECTION. Elles présentent des contextes d’équipe et un événement Coca-Cola lié au FIFA World Cup 26 Trophy Tour ; chaque mission est définie sur mesure.</p></div>
          <div className="media-grid"><figure className="media-large"><img src="/media/team-universal-aviation-wide.jpg" alt="Équipe Safiu Protection devant Universal Aviation" /><figcaption>Coordination d’équipe · accueil et environnement sensible</figcaption></figure><figure><img src="/media/safiu-collage.jpg" alt="Équipe Safiu Protection lors d’un événement" /><figcaption>Événement Coca-Cola · FIFA World Cup 26 Trophy Tour</figcaption></figure></div>
          <div className="video-grid"><video controls preload="metadata" playsInline poster="/media/mission-1-poster.jpg"><source src="/media/mission-1.mp4" type="video/mp4" /></video><video controls preload="metadata" playsInline poster="/media/mission-2-poster.jpg"><source src="/media/mission-2.mp4" type="video/mp4" /></video><video controls preload="metadata" playsInline poster="/media/mission-3-poster.jpg"><source src="/media/mission-3.mp4" type="video/mp4" /></video></div>
        </div>
      </section>

      <section id="contact" className="contact-section">
        <div className="section-shell contact-layout">
          <div className="contact-copy"><p className="eyebrow eyebrow-light"><span /> Parlons de votre besoin</p><h2>Décrivez le contexte.<br /><em>Nous préparerons la suite.</em></h2><p>Déplacement, rendez-vous, événement ou dispositif spécifique : quelques informations suffisent pour commencer un échange confidentiel.</p><div className="contact-details"><a href={siteConfig.phoneHref}><span>Téléphone</span>{siteConfig.phoneDisplay}</a><a href={`mailto:${recipient}`}><span>Email temporaire</span>{recipient}</a></div></div>
          <div className="form-card">{sent ? <div className="form-success" role="status" aria-live="polite"><span className="success-mark">✓</span><h3>Demande transmise.</h3><p>SAFIU PROTECTION recevra votre demande à l’adresse de contact configurée.</p><a className="text-link dark-link" href="#accueil">Retour à l’accueil</a></div> : <form onSubmit={handleSubmit}><div className="form-row"><label>Nom<input name="nom" type="text" required autoComplete="name" /></label><label>Téléphone<input name="telephone" type="tel" required autoComplete="tel" /></label></div><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Type de mission<select name="mission" defaultValue="" required><option value="" disabled>Sélectionner</option><option>Protection rapprochée</option><option>Protection privée</option><option>Autre besoin à qualifier</option></select></label><label>Votre message<textarea name="message" rows={5} required placeholder="Date, lieu, contexte et niveau d’urgence…" /></label><input className="honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" /><button className="button button-dark" type="submit">Envoyer la demande <ArrowIcon /></button>{formError && <p className="form-error" role="alert">La demande n’a pas pu être transmise. Réessayez dans quelques instants.</p>}<p className="form-note">Vos informations sont transmises de façon sécurisée à l’adresse de contact configurée.</p></form>}</div>
        </div>
      </section>

      <footer className="site-footer"><div className="section-shell footer-inner"><a className="brand footer-brand" href="#accueil"><img src="/media/safiu-logo.png" alt="" /><span><strong>SAFIU</strong><small>PROTECTION</small></span></a><p>Prévenir. Accompagner. Protéger.</p><p className="footer-note">Protection privée · Échange confidentiel</p></div></footer>
    </main>
  );
}
