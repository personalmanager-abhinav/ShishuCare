const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const hover = matchMedia('(hover: hover) and (pointer: fine)');
const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
document.querySelector('.header-search')?.addEventListener('click', (event) => {
  const input = document.querySelector<HTMLInputElement>('#query');
  if (input) {
    event.preventDefault();
    input.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }
});

const cards = document.querySelectorAll<HTMLElement>('.product-card');
for (const card of cards) {
  const video = card.querySelector<HTMLVideoElement>('[data-preview-video]');
  if (!video) continue;
  let intended = false;
  const pause = () => {
    intended = false;
    video.pause();
    card.classList.remove('video-playing');
  };
  card.addEventListener('pointerenter', async () => {
    if (
      !hover.matches ||
      reduced.matches ||
      connection?.saveData ||
      document.visibilityState !== 'visible'
    )
      return;
    intended = true;
    if (!video.getAttribute('src')) video.src = video.dataset.videoSrc!;
    try {
      await video.play();
      if (intended) card.classList.add('video-playing');
      else pause();
    } catch {
      pause();
    }
  });
  card.addEventListener('pointerleave', pause);
  video.addEventListener('error', pause);
  reduced.addEventListener('change', pause);
  const visibility = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) pause();
  });
  visibility.observe(card);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') pause();
  });
  document.addEventListener('product:open', pause);
}

// Explicit pointer/focus handling also works when the host reports reduced motion.
// Reduced motion uses a small opacity cue rather than suppressing all feedback.
const discoveryLink = document.querySelector<HTMLAnchorElement>('.intro-note a');
const chevrons = [...document.querySelectorAll<SVGPathElement>('.discovery-arrows path')];
let arrowAnimations: Animation[] = [];
function stopArrows() {
  arrowAnimations.forEach((animation) => animation.cancel());
  arrowAnimations = [];
}
function startArrows() {
  stopArrows();
  arrowAnimations = chevrons.map((chevron, index) =>
    chevron.animate(
      reduced.matches
        ? [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }]
        : [
            { transform: 'translateY(0)', opacity: 1, offset: 0 },
            { transform: 'translateY(5px)', opacity: 0, offset: 0.35 },
            { transform: 'translateY(-5px)', opacity: 0, offset: 0.36 },
            { transform: 'translateY(0)', opacity: 1, offset: 0.7 },
            { transform: 'translateY(0)', opacity: 1, offset: 1 },
          ],
      { duration: 1200, delay: index * 150, iterations: Infinity, easing: 'ease-in-out' },
    ),
  );
}
discoveryLink?.addEventListener('pointerenter', startArrows);
discoveryLink?.addEventListener('pointerleave', stopArrows);
discoveryLink?.addEventListener('focus', startArrows);
discoveryLink?.addEventListener('blur', stopArrows);
reduced.addEventListener('change', () => {
  if (arrowAnimations.length) startArrows();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopArrows();
});

// A single, restrained close-icon flourish per hover or keyboard focus.
const closeButton = document.querySelector<HTMLButtonElement>('.dialog-close');
const closeIcon = closeButton?.querySelector('svg');
let closeAnimation: Animation | undefined;
function stopCloseAnimation() { closeAnimation?.cancel(); closeAnimation = undefined; }
function animateClose() {
  stopCloseAnimation();
  closeAnimation = closeIcon?.animate(
    reduced.matches
      ? [{opacity:1}, {opacity:.45}, {opacity:1}]
      : [{transform:'rotate(0deg) scale(1)'}, {transform:'rotate(100deg) scale(1.15)', offset:.65}, {transform:'rotate(180deg) scale(1)'}],
    {duration:500, easing:'cubic-bezier(.2,.75,.25,1)'},
  );
}
closeButton?.addEventListener('pointerenter', animateClose);
closeButton?.addEventListener('pointerleave', stopCloseAnimation);
closeButton?.addEventListener('focus', () => { if(closeButton.matches(':focus-visible')) animateClose(); });
closeButton?.addEventListener('blur', stopCloseAnimation);
document.querySelector('#product-dialog')?.addEventListener('close', stopCloseAnimation);
