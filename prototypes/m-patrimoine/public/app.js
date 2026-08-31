(() => {
  const logo = document.querySelector('#brand-logo');
  fetch('./logo.b64.txt')
    .then((response) => {
      if (!response.ok) throw new Error('logo unavailable');
      return response.text();
    })
    .then((data) => {
      if (logo) logo.src = 'data:image/webp;base64,' + data.trim();
    })
    .catch(() => {
      if (logo) {
        logo.alt = 'M Patrimoine — identité visuelle';
        logo.hidden = true;
      }
    });

  const nodes = document.querySelectorAll('.reveal');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.14 });
  nodes.forEach((node) => observer.observe(node));
})();