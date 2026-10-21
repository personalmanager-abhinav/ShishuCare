// CSS owns all frame work; JS only responds to visibility/preference changes.
const layers = [...document.querySelectorAll<HTMLElement>('[data-ambient]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const visible = new Set<Element>();
function sync() {
  for (const layer of layers) {
    layer.toggleAttribute(
      'data-running',
      visible.has(layer) && !document.hidden && !reducedMotion.matches,
    );
  }
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    sync();
  });
  layers.forEach((layer) => observer.observe(layer));
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
}
