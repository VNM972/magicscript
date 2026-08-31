(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 14);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    header?.classList.toggle('menu-open', !open);
  });

  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton?.setAttribute('aria-expanded', 'false');
      header?.classList.remove('menu-open');
    });
  });

  const reveals = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((node) => node.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    reveals.forEach((node) => observer.observe(node));
  }

  if (!reducedMotion && window.matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * 4;
        const ry = (x - 0.5) * 5;
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }
})();