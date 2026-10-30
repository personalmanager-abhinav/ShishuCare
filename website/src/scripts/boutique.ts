export {};

document.documentElement.classList.add('js');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const revealItems = document.querySelectorAll<HTMLElement>('[data-reveal]');

if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
}

document.querySelectorAll<HTMLElement>('.button, .deal-card a').forEach((control) => {
  control.addEventListener('pointerdown', (event) => {
    if (reducedMotion.matches) return;
    const point = event as PointerEvent;
    const bounds = control.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'tap-ripple';
    ripple.style.left = `${point.clientX - bounds.left}px`;
    ripple.style.top = `${point.clientY - bounds.top}px`;
    control.style.position = 'relative';
    control.style.overflow = 'hidden';
    control.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });
});

const searchForm = document.querySelector<HTMLFormElement>('#search-form');
searchForm?.addEventListener('submit', () => document.body.classList.add('is-waiting'));
new MutationObserver(() => {
  if (searchForm?.getAttribute('aria-busy') === 'false')
    document.body.classList.remove('is-waiting');
}).observe(searchForm || document.body, { attributes: true, attributeFilter: ['aria-busy'] });

const heroArt = document.querySelector<HTMLElement>('[data-hero-art]');
heroArt?.addEventListener('pointermove', (event) => {
  if (reducedMotion.matches || !matchMedia('(hover:hover)').matches) return;
  const bounds = heroArt.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
  const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 8;
  heroArt.style.setProperty('--hero-x', `${x}px`);
  heroArt.style.setProperty('--hero-y', `${y}px`);
});

document.querySelectorAll<HTMLButtonElement>('.colour-swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    const surface = swatch.closest('.product-card, .product-detail, .product-dialog');
    const image = surface?.querySelector<HTMLImageElement>(
      '.product-image img, .detail-image img, .gallery-stage > img',
    );
    image?.animate(
      [
        { opacity: 0.35, transform: 'scale(.975)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  });
});
