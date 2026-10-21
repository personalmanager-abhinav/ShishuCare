import { gallery } from '../lib/gallery';
import { setResponsiveImage, cardSizes, detailSizes } from '../lib/responsive-image';
import type { Product } from '../lib/product';
import catalogue from '../generated/catalogue.json';
// Keep the native select as the source of truth and no-JavaScript fallback.
document.querySelectorAll<HTMLSelectElement>('.sort-controls select').forEach((select) => {
  const wrap = document.createElement('div');
  wrap.className = 'choice-menu';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'choice-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const label =
    document.querySelector(`label[for="${select.id}"]`)?.textContent?.trim() || 'Options';
  const list = document.createElement('div');
  list.className = 'choice-options';
  list.id = `${select.id}-options`;
  list.hidden = true;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', label);
  trigger.setAttribute('aria-controls', list.id);
  const buttons = [...select.options].map((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.tabIndex = -1;
    button.textContent = option.text;
    button.dataset.value = option.value;
    list.append(button);
    button.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      close(true);
    });
    return button;
  });
  function sync() {
    trigger.textContent = select.selectedOptions[0].text;
    trigger.setAttribute('aria-label', `${label}: ${trigger.textContent}`);
    buttons.forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.value === select.value)),
    );
  }
  function close(focus = false) {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  }
  function open() {
    document.dispatchEvent(new Event('choices:close'));
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    buttons[select.selectedIndex]?.focus();
  }
  trigger.addEventListener('click', () => (list.hidden ? open() : close()));
  trigger.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (e) => {
    let index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close(true);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      index =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? buttons.length - 1
            : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index].focus();
    } else if (e.key.length === 1 && e.key !== ' ') {
      buttons.find((b) => b.textContent?.toLowerCase().startsWith(e.key.toLowerCase()))?.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target as Node)) close();
  });
  document.addEventListener('choices:close', () => close());
  document.addEventListener('choices:sync', sync);
  select.addEventListener('change', sync);
  select.before(wrap);
  wrap.append(trigger, list, select);
  select.hidden = true;
  sync();
});
document.querySelectorAll<HTMLElement>('[data-colours]').forEach((group) => {
  const product = catalogue.products.find((p) => p.product_id === group.dataset.colours);
  if (!product) return;
  group.querySelectorAll<HTMLButtonElement>('[data-colour-index]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.dataset.colourIndex),
        photo = gallery(product as Product, product.attributes.color[index])[0];
      if (!photo) return;
      group.dataset.selectedPhoto = String(index);
      group
        .querySelectorAll('button')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      group.querySelector('[data-colour-label]')!.textContent = product.attributes.color[index];
      const surface = group.closest('.product-card, .product-detail');
      const image = surface?.querySelector<HTMLImageElement>(
        '.product-image img, .detail-image img',
      );
      if (image) {
        image.dataset.fallback = photo.fallback;
        setResponsiveImage(image, photo.src, surface?.matches('.product-card') ? cardSizes : detailSizes);
        image.alt = photo.alt;
      }
    }),
  );
});

// Capture image failures, including dynamically swapped photos. Never retry a failed fallback.
function recover(image: HTMLImageElement) {
  const fallback = image.dataset.fallback;
  if (!fallback || image.getAttribute('src') === fallback) return;
  image.dataset.fallback = '/images/photo-unavailable.svg';
  setResponsiveImage(image, fallback);
  image.alt = fallback.endsWith('photo-unavailable.svg')
    ? 'Product photo coming soon'
    : 'Illustrative product preview';
  const badge = image
    .closest('.product-image, .gallery-stage')
    ?.querySelector<HTMLElement>('.image-tag, .gallery-label');
  if (badge) {
    badge.hidden = false;
    badge.textContent = fallback.endsWith('photo-unavailable.svg')
      ? 'Photo coming soon'
      : 'Illustrative preview';
  }
}
document.addEventListener(
  'error',
  (event) => {
    if (event.target instanceof HTMLImageElement) recover(event.target);
  },
  true,
);
document.querySelectorAll<HTMLImageElement>('img[data-fallback]').forEach((image) => {
  if (image.complete && !image.naturalWidth) recover(image);
});
