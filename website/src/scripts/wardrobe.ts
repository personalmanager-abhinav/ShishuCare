import catalogue from '../generated/catalogue.json';
import marketplaces from '../../data/marketplaces.json';
import taxonomy from '../../data/taxonomy.json';
import { gallery } from '../lib/gallery';
import { money, price, type Product } from '../lib/product';
import { track } from './tracking';

const products = catalogue.products as Product[];
const dialog = document.querySelector<HTMLDialogElement>('#wardrobe-detail');
const search = document.querySelector<HTMLInputElement>('#wardrobe-query');
const empty = document.querySelector<HTMLElement>('#wardrobe-empty');
let selected: Product | null = null;
let sessionId: string | null = null;
const photographicAsset: Record<string, string> = {
  P101: 'caps',
  P102: 'baby-shawl',
  P103: 'socks',
  P104: 'diaper-sets',
  P105: 'baby-bibs',
  P106: 'sleeping-mat',
  P107: 'baby-swaddle',
};

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const setText = (selector: string, value: string) => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
};

function filterWardrobe(category = 'all') {
  const query = search?.value.trim().toLowerCase() || '';
  let visible = 0;
  document.querySelectorAll<HTMLElement>('[data-wardrobe-product]').forEach((item) => {
    const group = item.closest<HTMLElement>('[data-wardrobe-group]')?.dataset.wardrobeGroup;
    const matchCategory = category === 'all' || group === category;
    const matchQuery = !query || item.dataset.search?.includes(query);
    item.hidden = !(matchCategory && matchQuery);
    if (!item.hidden) visible++;
  });
  if (empty) empty.hidden = visible > 0;
}

document.querySelectorAll<HTMLButtonElement>('[data-wardrobe-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document
      .querySelectorAll('[data-wardrobe-filter]')
      .forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    filterWardrobe(button.dataset.wardrobeFilter);
  });
});
search?.addEventListener('input', () => {
  const active = document.querySelector<HTMLButtonElement>('[data-wardrobe-filter].active');
  filterWardrobe(active?.dataset.wardrobeFilter);
});

function productImage(product: Product, colour?: string) {
  return gallery(product, colour)[0];
}

function updatePreview(product: Product) {
  selected = product;
  setText('#rail-preview-name', product.name);
  setText('#rail-preview-price', money(price(product)));
  setText('#rail-preview-copy', product.description);
  setText(
    '#rail-preview-category',
    taxonomy.find((item) => item.id === product.category_id)?.name || product.category_id,
  );
  const save = document.querySelector<HTMLButtonElement>('.rail-preview-heart')!;
  save.dataset.saveProduct = product.product_id;
  const colours = $('#rail-preview-colours');
  colours.replaceChildren();
  (product.attributes.color || []).forEach((colour) => {
    const dot = document.createElement('span');
    dot.title = colour;
    dot.style.background = colourValue[colour.toLowerCase()] || colour;
    colours.append(dot);
  });
  document
    .querySelectorAll<HTMLElement>('.rail-product')
    .forEach((item) =>
      item.classList.toggle('selected', item.dataset.wardrobeProduct === product.product_id),
    );
  document.dispatchEvent(new Event('product:open'));
}

function selectColour(product: Product, colour: string) {
  const image = productImage(product, colour);
  const target = $('#wardrobe-detail-image') as HTMLImageElement;
  if (!photographicAsset[product.product_id]) target.src = image.src;
  target.alt = `${product.name}, ${colour} preview`;
  document
    .querySelectorAll<HTMLButtonElement>('#wardrobe-colours button')
    .forEach((button) => button.classList.toggle('active', button.dataset.colour === colour));
}

const colourValue: Record<string, string> = {
  pink: '#e8b5c4',
  blue: '#b8d7e8',
  cream: '#efe2c5',
  white: '#f5f3ed',
  yellow: '#ead88c',
  green: '#bad3bd',
  peach: '#edbfaa',
  grey: '#c9ced2',
  multicolour: 'linear-gradient(135deg,#eab2c1,#b9d8e8,#e9d899)',
};

function resetBargain() {
  sessionId = null;
  $('#wardrobe-bargain').setAttribute('hidden', '');
  $('#wardrobe-bargain-setup').removeAttribute('hidden');
  $('#wardrobe-bargain-conversation').setAttribute('hidden', '');
  $('#wardrobe-chat').replaceChildren();
  const offer = $('#wardrobe-offer') as HTMLInputElement;
  offer.value = '';
  offer.disabled = false;
  ($('#wardrobe-offer-form button') as HTMLButtonElement).disabled = false;
  $('#wardrobe-accept').setAttribute('hidden', '');
  setText('#wardrobe-attempts', '3 offers available');
  setText('#wardrobe-bargain-status', '');
}

function openProduct(product: Product, opener: HTMLElement) {
  if (!dialog) return;
  selected = product;
  resetBargain();
  setText('#wardrobe-detail-title', product.name);
  setText('#wardrobe-detail-price', money(price(product)));
  setText('#wardrobe-detail-copy', product.description);
  setText(
    '#wardrobe-detail-category',
    taxonomy.find((item) => item.id === product.category_id)?.name || product.category_id,
  );
  ($('#wardrobe-direct-link') as HTMLAnchorElement).href = `/products/${product.slug}/`;
  const save = dialog.querySelector<HTMLButtonElement>('[data-save-product]')!;
  save.dataset.saveProduct = product.product_id;
  const colours = $('#wardrobe-colours');
  colours.replaceChildren();
  (product.attributes.color || []).forEach((colour, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.colour = colour;
    button.title = colour;
    button.setAttribute('aria-label', `Preview ${colour}`);
    button.style.background = colourValue[colour.toLowerCase()] || colour;
    button.addEventListener('click', () => selectColour(product, colour));
    colours.append(button);
    if (index === 0) button.classList.add('active');
  });
  selectColour(product, product.attributes.color?.[0] || '');
  const detailImage = $('#wardrobe-detail-image') as HTMLImageElement;
  detailImage.src = `/images/wardrobe-v2/${photographicAsset[product.product_id]}.webp`;
  detailImage.alt = product.name;
  const offers = $('#wardrobe-offers');
  offers.replaceChildren();
  product.offers.forEach((offer) => {
    const marketplace = marketplaces.find((item) => item.id === offer.marketplace_id);
    const row = document.createElement('div');
    row.className = 'wardrobe-offer';
    const name = document.createElement('strong');
    name.textContent = marketplace?.name || offer.marketplace_id;
    const amount = document.createElement('span');
    amount.textContent = money(offer.price_minor);
    const action = offer.url ? document.createElement('a') : document.createElement('button');
    action.textContent = offer.url ? 'Visit â†—' : 'Coming soon';
    if (action instanceof HTMLAnchorElement) {
      action.href = offer.url!;
      action.rel = 'noopener noreferrer sponsored';
      action.target = '_blank';
    } else action.disabled = true;
    row.append(name, amount, action);
    offers.append(row);
  });
  const select = $('#wardrobe-marketplace') as HTMLSelectElement;
  select.replaceChildren(
    ...product.offers.map((offer) => {
      const option = document.createElement('option');
      option.value = offer.offer_id;
      option.textContent =
        marketplaces.find((item) => item.id === offer.marketplace_id)?.name || offer.marketplace_id;
      return option;
    }),
  );
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  document.dispatchEvent(new Event('product:open'));
  track('product_view', { placement: 'wardrobe' }, { product_id: product.product_id });
  dialog.dataset.opener = opener.id || '';
}

document.addEventListener('click', (event) => {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-wardrobe-open]');
  if (!trigger) return;
  const product = products.find((item) => item.product_id === trigger.dataset.wardrobeOpen);
  if (product) updatePreview(product);
});

document.querySelector('#rail-preview-details')?.addEventListener('click', (event) => {
  if (selected) openProduct(selected, event.currentTarget as HTMLElement);
});
document.querySelector('#rail-preview-offer')?.addEventListener('click', (event) => {
  if (!selected) return;
  openProduct(selected, event.currentTarget as HTMLElement);
  $('#wardrobe-bargain').removeAttribute('hidden');
  ($('#wardrobe-language') as HTMLSelectElement).focus();
});

const rail = document.querySelector<HTMLElement>('#rail-products');

if (rail) {
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  rail.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragging = true;
    startX = event.clientX;
    startScroll = rail.scrollLeft;
    rail.setPointerCapture(event.pointerId);
  });
  rail.addEventListener('pointermove', (event) => {
    if (dragging) rail.scrollLeft = startScroll - (event.clientX - startX);
  });
  rail.addEventListener('pointerup', () => (dragging = false));

  void import('./wardrobe-3d').then(({ startWardrobe3D }) => startWardrobe3D(rail));
}

function closeDialog() {
  dialog?.close();
  document.body.style.overflow = '';
}
$('.wardrobe-detail-close')?.addEventListener('click', closeDialog);
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});
dialog?.addEventListener('close', () => {
  document.body.style.overflow = '';
});

$('#wardrobe-bargain-toggle')?.addEventListener('click', () => {
  const panel = $('#wardrobe-bargain');
  panel.toggleAttribute('hidden');
  if (!panel.hasAttribute('hidden')) ($('#wardrobe-language') as HTMLSelectElement).focus();
});

function addMessage(message: string, customer = false) {
  const bubble = document.createElement('p');
  bubble.className = `wardrobe-chat-message${customer ? ' customer' : ''}`;
  bubble.textContent = message;
  $('#wardrobe-chat').append(bubble);
  bubble.scrollIntoView({ block: 'nearest' });
}

$('#wardrobe-bargain-start')?.addEventListener('click', async () => {
  if (!selected) return;
  const marketplaceSelect = $('#wardrobe-marketplace') as HTMLSelectElement;
  const offer = selected.offers.find((item) => item.offer_id === marketplaceSelect.value);
  const language = ($('#wardrobe-language') as HTMLSelectElement).value;
  if (!offer) return;
  const start = $('#wardrobe-bargain-start') as HTMLButtonElement;
  start.disabled = true;
  setText('#wardrobe-bargain-status', 'Opening your private demoâ€¦');
  try {
    const response = await fetch('/api/bargain/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selected.product_id,
        variantId: selected.attributes.color?.[0] || '',
        marketplaceId: offer.marketplace_id,
        marketplaceOfferId: offer.offer_id,
        language,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Bargaining is unavailable.');
    sessionId = result.sessionId;
    $('#wardrobe-bargain-setup').setAttribute('hidden', '');
    $('#wardrobe-bargain-conversation').removeAttribute('hidden');
    addMessage(result.assistantMessage || 'Your recent demo conversation is ready.');
    setText('#wardrobe-attempts', `${result.attemptsRemaining} offers remaining`);
    setText('#wardrobe-bargain-status', '');
    if (result.state !== 'active') {
      ($('#wardrobe-offer') as HTMLInputElement).disabled = true;
      ($('#wardrobe-offer-form button') as HTMLButtonElement).disabled = true;
    }
  } catch (error) {
    setText(
      '#wardrobe-bargain-status',
      error instanceof Error ? error.message : 'Could not begin.',
    );
  } finally {
    start.disabled = false;
  }
});

$('#wardrobe-offer-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#wardrobe-offer') as HTMLInputElement;
  const submit = $('#wardrobe-offer-form button') as HTMLButtonElement;
  const message = input.value.trim();
  if (!sessionId || !message) return;
  addMessage(message, true);
  input.value = '';
  input.disabled = true;
  submit.disabled = true;
  setText('#wardrobe-bargain-status', 'Considering your offerâ€¦');
  try {
    const response = await fetch(`/api/bargain/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, idempotencyKey: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Offer could not be sent.');
    addMessage(result.assistantMessage || 'Offer received.');
    setText('#wardrobe-attempts', `${result.attemptsRemaining} offers remaining`);
    const accept = $('#wardrobe-accept') as HTMLButtonElement;
    accept.hidden = !(result.state === 'active' && result.offer?.amountMinor);
    if (result.state === 'active') {
      input.disabled = false;
      submit.disabled = false;
      input.focus();
    }
    setText('#wardrobe-bargain-status', result.state === 'active' ? '' : 'Demo conversation ended');
  } catch (error) {
    input.disabled = false;
    submit.disabled = false;
    setText('#wardrobe-bargain-status', error instanceof Error ? error.message : 'Could not send.');
  }
});

$('#wardrobe-accept')?.addEventListener('click', async () => {
  if (!sessionId) return;
  const button = $('#wardrobe-accept') as HTMLButtonElement;
  button.disabled = true;
  try {
    const response = await fetch(`/api/bargain/sessions/${sessionId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not accept.');
    addMessage(result.assistantMessage || 'Demo offer accepted.');
    button.hidden = true;
    ($('#wardrobe-offer') as HTMLInputElement).disabled = true;
    ($('#wardrobe-offer-form button') as HTMLButtonElement).disabled = true;
    setText('#wardrobe-bargain-status', 'Demo conversation ended');
  } catch (error) {
    button.disabled = false;
    setText(
      '#wardrobe-bargain-status',
      error instanceof Error ? error.message : 'Could not accept.',
    );
  }
});

if (products[0]) updatePreview(products[0]);
