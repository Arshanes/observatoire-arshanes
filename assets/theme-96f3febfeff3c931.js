// Exécuté dans le head avant les styles : appliquer la préférence avant le premier affichage.
(() => {
  const storageKey = 'warera-report-theme';
  const root = document.documentElement;
  const valid = value => value === 'dark' || value === 'light';
  const read = () => {
    try { return localStorage.getItem(storageKey); }
    catch { return null; } // Le switch reste utilisable quand le stockage est bloqué.
  };

  function apply(theme) {
    root.dataset.theme = theme;
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.setAttribute('aria-checked', String(theme === 'dark'));
      button.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
    }
  }

  const saved = read();
  apply(valid(saved) ? saved : 'light');

  function connectSwitch() {
    apply(root.dataset.theme);
    // Le thème mémorisé est déjà peint ; seuls les changements suivants sont animés.
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('theme-ready')));
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.hidden = false;
      button.addEventListener('click', () => {
        const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        apply(theme);
        try { localStorage.setItem(storageKey, theme); } catch { /* Préférence de cette page seulement. */ }
      });
    }
    // Observer l’emplacement initial, dont la hauteur est conservée quand le bouton devient fixe.
    // Cela évite les sauts de contenu et les oscillations lors du retour en haut.
    if ('IntersectionObserver' in window) {
      for (const anchor of document.querySelectorAll('[data-theme-anchor]')) {
        const button = anchor.querySelector('[data-theme-toggle]');
        const observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            button.classList.toggle('is-floating', !entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
          }
        });
        observer.observe(anchor);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connectSwitch, {once:true});
  else connectSwitch();

  // Le même choix s’applique aux archives et aux autres rapports déjà ouverts du même site.
  window.addEventListener('storage', event => {
    if (event.key === storageKey) apply(valid(event.newValue) ? event.newValue : 'light');
  });
  window.addEventListener('pageshow', () => {
    const value = read();
    if (valid(value)) apply(value);
  });
})();
