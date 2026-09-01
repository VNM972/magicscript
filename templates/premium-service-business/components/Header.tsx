import { site } from "@/config/site";

export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label={site.company.name}>
        {site.company.name}
      </a>

      <nav className="desktop-nav" aria-label="Navigation principale">
        <a href="#services">Services</a>
        <a href="#approche">Approche</a>
        <a href="#contact">Contact</a>
      </nav>

      <a className="header-cta" href="#contact">
        {site.hero.primaryCta}
      </a>
    </header>
  );
}
