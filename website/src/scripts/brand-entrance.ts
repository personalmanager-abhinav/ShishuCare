const root = document.documentElement;
const target = document.querySelector<HTMLElement>('.site-header .brand-name');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (root.hasAttribute('data-brand-intro') && target) {
  const layer = document.createElement('div');
  layer.className = 'brand-entrance';
  layer.setAttribute('aria-hidden', 'true');
  const backdrop = document.createElement('div');
  backdrop.className = 'brand-entrance-backdrop';
  const flight = document.createElement('div');
  flight.className = 'brand-entrance-flight';
  const clone = target.cloneNode(true) as HTMLElement;
  flight.append(clone);
  layer.append(backdrop, flight);
  const animations: Animation[] = [];
  const blocked: HTMLElement[] = [];
  let ended = false;
  let timeout: ReturnType<typeof setTimeout>;
  function finish() {
    if (ended) return;
    ended = true;
    root.removeAttribute('data-brand-intro');
    animations.forEach((animation) => animation.cancel());
    layer.remove();
    blocked.forEach((element) => {
      element.inert = false;
    });
    clearTimeout(timeout);
    window.removeEventListener('resize', finish);
    window.removeEventListener('scroll', finish);
    window.removeEventListener('pagehide', finish);
    document.removeEventListener('keydown', finish);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('brand:intro-abort', finish);
    motion.removeEventListener('change', finish);
  }
  function onVisibility() {
    if (document.hidden) finish();
  }
  // Soft, natural easing curves shared across the sequence for a flowing feel.
  const SOFT = 'cubic-bezier(.4, 0, .2, 1)';
  const GLIDE = 'cubic-bezier(.45, 0, .15, 1)';
  async function start() {
    try {
      // Skip on slow/missing fonts rather than animate a fallback into a different logo.
      const ready = await Promise.race([
        document.fonts.load('600 23px Poppins').then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 400)),
      ]);
      if (ended) return;
      if (!ready || motion.matches || document.hidden || window.scrollY > 0) {
        finish();
        return;
      }
      const style = getComputedStyle(target!);
      const rect = target!.getBoundingClientRect();
      Object.assign(flight.style, {
        font: style.font,
        letterSpacing: style.letterSpacing,
        color: style.color,
      });
      const scale = Math.min(2.1, (innerWidth - 64) / rect.width);
      const x = (document.documentElement.clientWidth - rect.width * scale) / 2;
      const y = (innerHeight - rect.height * scale) / 2;
      const initial = `translate(${x}px, ${y}px) scale(${scale})`;
      flight.style.transform = initial;
      for (const child of document.body.children) {
        if (child instanceof HTMLElement && child.tagName !== 'SCRIPT' && !child.inert) {
          child.inert = true;
          blocked.push(child);
        }
      }
      document.body.append(layer);
      root.dataset.brandIntro = 'playing';

      // Scattered baby-product doodles, each drifting its own random way, faded low.
      const DOODLES = {
        onesie: '<path d="M8 3l1.6 2.4h4.8L16 3M7 5l-3 3 2.4 2.4L8 8.8V21h8V8.8l1.6 1.6L20 8l-3-3M8 5h8"/>',
        bib: '<path d="M9 4a3 3 0 006 0M8 5C5 6 4 9 4 12c0 4 3 8 8 8s8-4 8-8c0-3-1-6-4-7M12 12h.01"/>',
        bottle: '<path d="M10 2h4M11 2v2m2-2v2M9 6h6l-1 3H10zM10 9h4v11a2 2 0 01-2 2 2 2 0 01-2-2zM10 13h4M10 16h4"/>',
        pacifier: '<circle cx="12" cy="14" r="4"/><path d="M8.5 12.5C6 11 5 9 6 7.5 7 6 9 6.5 10 8M15.5 12.5C18 11 19 9 18 7.5 17 6 15 6.5 14 8M12 18v3"/><circle cx="12" cy="6" r="1.6"/>',
        rattle: '<circle cx="9" cy="9" r="5"/><path d="M9 6v6M6 9h6M12.5 12.5l6 6M17 17l3 3"/>',
        sock: '<path d="M9 3h5v7c0 1 .3 1.6 1.2 2.4l3 2.6c1.5 1.4 1.4 3.8-.3 5-1.6 1.1-3.7.6-4.8-1L9 14c-.7-1-1-2-1-3.4V3z"/><path d="M9 6h5"/>',
        hat: '<path d="M4 15a8 8 0 0116 0M4 15h16M12 4c2 0 3 1.5 3 3.5S13.5 11 12 11 9 9.5 9 7.5 10 4 12 4z"/><path d="M12 3v1.2"/>',
        bear: '<circle cx="6.5" cy="6" r="2.2"/><circle cx="17.5" cy="6" r="2.2"/><circle cx="12" cy="13" r="6.5"/><path d="M10 12h.01M14 12h.01M12 14c-1 0-1.6.7-1.6 1.4M12 14c1 0 1.6.7 1.6 1.4"/>',
        stroller: '<path d="M4 5h2l2.5 8h9M4 5c8 0 9 4 9 8M20 8a7 7 0 00-7-3"/><circle cx="9" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
        cloud: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.6A3.5 3.5 0 0117 18H7z"/>',
        star: '<path d="M12 4l2.3 4.8 5.2.7-3.8 3.6.9 5.1L12 16l-4.6 2.2.9-5.1L4.5 9.5l5.2-.7z"/>',
        heart: '<path d="M12 20s-7-4.3-7-9.3A3.7 3.7 0 0112 8a3.7 3.7 0 017 2.7c0 5-7 9.3-7 9.3z"/>',
        moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
        duck: '<path d="M13 6a3 3 0 10-3 3v2c-3 0-5 2-5 5h11c4 0 5-3 5-5 0-2-1-3-2-3M8.5 5.5h.01M13 8h4"/>',
        balloon: '<path d="M12 3a5 5 0 015 5c0 3.5-3 6-5 6.5C10 14 7 11.5 7 8a5 5 0 015-5zM12 14.5V17M12 17c-1 1 1 2 0 3"/>',
      };
      const keys = Object.keys(DOODLES);
      const dw = document.documentElement.clientWidth;
      const dh = innerHeight;
      const count = Math.max(28, Math.min(70, Math.round((dw * dh) / 26000)));
      const rnd = (a: number, b: number) => a + Math.random() * (b - a);
      let cells = '';
      const drifts: { dx: number; dy: number; dur: number }[] = [];
      for (let i = 0; i < count; i++) {
        const x = rnd(20, dw - 20);
        const y = rnd(20, dh - 20);
        const s = rnd(1.1, 1.9);
        const rot = rnd(-28, 28);
        const key = keys[(Math.random() * keys.length) | 0];
        cells +=
          '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')">' +
          '<g class="dw">' +
          '<g transform="scale(' + s.toFixed(2) + ') translate(-12 -12)">' + DOODLES[key as keyof typeof DOODLES] + '</g>' +
          '</g></g>';
        drifts.push({ dx: rnd(-16, 16), dy: rnd(-16, 16), dur: rnd(6, 12) });
      }
      const doodleLayer = document.createElement('div');
      doodleLayer.className = 'brand-doodles';
      doodleLayer.innerHTML =
        '<svg viewBox="0 0 ' + dw + ' ' + dh + '" fill="none" stroke="#5fb0e0" stroke-width="1.4" ' +
        'stroke-linecap="round" stroke-linejoin="round">' + cells + '</svg>';
      const dwGroups = doodleLayer.querySelectorAll<SVGGElement>('.dw');
      dwGroups.forEach((g, i) => {
        const d = drifts[i];
        animations.push(
          g.animate(
            [
              { transform: 'translate(0px, 0px)' },
              { transform: `translate(${d.dx}px, ${d.dy}px)` },
            ],
            { duration: d.dur * 1000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
          ),
        );
      });
      layer.insertBefore(doodleLayer, flight);
      animations.push(
        doodleLayer.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0.24, offset: 0.24 },
            { opacity: 0.24, offset: 0.72 },
            { opacity: 0, offset: 1 },
          ],
          { duration: 2880, fill: 'both', easing: 'ease-in-out' },
        ),
      );

      // The wordmark eases in softly before anything moves.
      animations.push(
        flight.animate([{ opacity: 0 }, { opacity: 1 }], {
          delay: 0,
          duration: 560,
          fill: 'both',
          easing: SOFT,
        }),
      );

      const dot = clone.querySelector<HTMLElement>('.brand-blue-dot')!;
      // A gentle tapered water-drop that glides down, lands, softly splashes and settles.
      const fall = dot.animate(
        [
          {
            opacity: 0,
            transform: 'translateY(-2.6em) scaleX(1.12) scaleY(1.9)',
            borderRadius: '46% 46% 50% 50% / 38% 38% 66% 66%',
            offset: 0,
          },
          {
            opacity: 1,
            transform: 'translateY(-2.35em) scaleX(1.12) scaleY(1.9)',
            borderRadius: '46% 46% 50% 50% / 38% 38% 66% 66%',
            offset: 0.12,
          },
          {
            opacity: 1,
            transform: 'translateY(-.12em) scaleX(1.26) scaleY(2.02)',
            borderRadius: '48% 48% 50% 50% / 42% 42% 60% 60%',
            offset: 0.56,
            easing: 'cubic-bezier(.5, .02, .5, 1)',
          },
          {
            opacity: 1,
            transform: 'translateY(0) scale(1.95, 1.95)',
            borderRadius: '50%',
            offset: 0.67,
            easing: SOFT,
          },
          {
            opacity: 1,
            transform: 'translateY(.05em) scale(2.18, 1.55)',
            borderRadius: '50%',
            offset: 0.76,
            easing: SOFT,
          },
          {
            opacity: 1,
            transform: 'translateY(-.12em) scale(1.2, 1.3)',
            borderRadius: '50%',
            offset: 0.86,
            easing: 'ease-in-out',
          },
          {
            opacity: 1,
            transform: 'translateY(0) scale(1.06, .98)',
            borderRadius: '50%',
            offset: 0.94,
            easing: SOFT,
          },
          { opacity: 1, transform: 'translateY(0) scale(1)', borderRadius: '50%', offset: 1 },
        ],
        { delay: 380, duration: 1150, fill: 'both', easing: 'cubic-bezier(.32, .04, .3, 1)' },
      );
      animations.push(fall);

      // A soft splash: a few tiny droplets drift out and fade.
      const iWrap = clone.querySelector<HTMLElement>('.brand-i');
      if (iWrap) {
        const splashSpecs = [
          { dx: -0.3, rise: 0.26, fall: 0.08, dur: 560 },
          { dx: -0.14, rise: 0.36, fall: 0.12, dur: 600 },
          { dx: 0.04, rise: 0.4, fall: 0.15, dur: 620 },
          { dx: 0.18, rise: 0.32, fall: 0.11, dur: 580 },
          { dx: 0.32, rise: 0.24, fall: 0.07, dur: 540 },
        ];
        for (const s of splashSpecs) {
          const drop = document.createElement('span');
          drop.className = 'brand-splash';
          iWrap.append(drop);
          animations.push(
            drop.animate(
              [
                { opacity: 0, transform: 'translate(-50%, -50%) scale(.3)', offset: 0 },
                {
                  opacity: 0.82,
                  transform: `translate(-50%, -50%) translate(${s.dx * 0.55}em, ${-s.rise}em) scale(.9)`,
                  offset: 0.28,
                  easing: 'cubic-bezier(.2, .7, .35, 1)',
                },
                {
                  opacity: 0,
                  transform: `translate(-50%, -50%) translate(${s.dx}em, ${s.fall}em) scale(.4)`,
                  offset: 1,
                  easing: SOFT,
                },
              ],
              { delay: 1210, duration: s.dur, fill: 'both' },
            ),
          );
        }
      }

      // A very subtle, slow outward breath once the dot settles.
      animations.push(
        clone.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }],
          { delay: 1620, duration: 460, fill: 'both', easing: 'ease-in-out' },
        ),
      );

      // The wordmark glides to the header while the page reveals underneath.
      const travel = flight.animate(
        [{ transform: initial }, { transform: `translate(${rect.x}px, ${rect.y}px) scale(1)` }],
        { delay: 2020, duration: 860, fill: 'both', easing: GLIDE },
      );
      animations.push(
        travel,
        backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
          delay: 2020,
          duration: 860,
          fill: 'both',
          easing: SOFT,
        }),
      );
      await travel.finished;
      finish();
    } catch {
      finish();
    }
  }
  timeout = setTimeout(finish, 3600);
  window.addEventListener('resize', finish);
  window.addEventListener('scroll', finish, { passive: true });
  window.addEventListener('pagehide', finish);
  document.addEventListener('keydown', finish);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('brand:intro-abort', finish);
  motion.addEventListener('change', finish);
  void start();
}
