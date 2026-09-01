import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>{site.company.name}</strong>
        <p>{site.company.tagline}</p>
      </div>

      <div className="footer-links">
        <a href="/mentions-legales/">Mentions légales</a>
        <a href="/politique-confidentialite/">Confidentialité</a>
      </div>
    </footer>
  );
}
