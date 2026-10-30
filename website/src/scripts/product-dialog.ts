import { gallery, type GalleryImage } from '../lib/gallery';
import { setResponsiveImage } from '../lib/responsive-image';
import catalogue from '../generated/catalogue.json';
import marketplaces from '../../data/marketplaces.json';
import taxonomy from '../../data/taxonomy.json';
import { money, price, type Product } from '../lib/product';
import { track, bindOfferTracking } from './tracking';

const products = catalogue.products as Product[];
const dialog = document.querySelector<HTMLDialogElement>('#product-dialog')!;
const image = dialog.querySelector<HTMLImageElement>('#dialog-image')!;
const thumbnails = dialog.querySelector<HTMLElement>('#photo-thumbnails')!;
const stage = dialog.querySelector<HTMLElement>('#gallery-stage')!;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let selected: Product | undefined;
let photoIndex = 0;
let colourIndex = 0;
let galleryPhotos: GalleryImage[] = [];
let opener: HTMLElement | null = null;
let cleanupOffers = () => {};
let scrollY = 0;
let pointerStart: { x: number; y: number } | null = null;
let bargainSessionId: string | null = null;

interface BargainHistoryTurn {
  speaker: 'customer' | 'assistant';
  message: string | null;
  amountMinor: number | null;
}

interface BargainState {
  sessionId: string;
  state: string;
  attemptsRemaining: number;
  language: string;
  marketplaceId: string;
  marketplaceOfferId: string;
  expiresAt?: string;
  assistantMessage?: string | null;
  offer?: { amountMinor: number } | null;
  history?: BargainHistoryTurn[];
  resumed?: boolean;
  error?: string;
}

const bargainButton = dialog.querySelector<HTMLButtonElement>('#bargain-button')!;
const bargainPanel = dialog.querySelector<HTMLElement>('#bargaining-panel')!;
const bargainChat = dialog.querySelector<HTMLElement>('#bargaining-chat')!;
const bargainStatus = dialog.querySelector<HTMLElement>('#bargaining-status')!;
const bargainForm = dialog.querySelector<HTMLFormElement>('#bargain-message-form')!;
const bargainInput = dialog.querySelector<HTMLInputElement>('#bargain-message-input')!;
const bargainSubmit = dialog.querySelector<HTMLButtonElement>('#bargain-message-submit')!;
const bargainSetup = dialog.querySelector<HTMLElement>('#bargain-setup')!;
const bargainConversation = dialog.querySelector<HTMLElement>('#bargain-conversation')!;
const bargainMarketplace = dialog.querySelector<HTMLSelectElement>('#bargain-marketplace')!;
const bargainLanguage = dialog.querySelector<HTMLSelectElement>('#bargain-language')!;
const bargainStart = dialog.querySelector<HTMLButtonElement>('#bargain-start')!;
const bargainAccept = dialog.querySelector<HTMLButtonElement>('#bargain-accept')!;

function setBargainStatus(message = '', error = false, waiting = false) {
  bargainStatus.textContent = message;
  bargainStatus.classList.toggle('error', error);
  bargainStatus.classList.toggle('waiting', waiting);
  bargainPanel.setAttribute('aria-busy', String(waiting));
}

function addBargainMessage(message: string, customer = false) {
  const bubble = document.createElement('p');
  bubble.className = `bargaining-message ${customer ? 'user-message' : 'assistant-message'}`;
  bubble.textContent = message;
  bargainChat.append(bubble);
  bargainChat.scrollTop = bargainChat.scrollHeight;
}

function renderBargainHistory(history: BargainHistoryTurn[] = []) {
  bargainChat.replaceChildren();
  for (const turn of history) {
    if (turn.speaker === 'assistant' && turn.message) addBargainMessage(turn.message);
    if (turn.speaker === 'customer')
      addBargainMessage(
        turn.amountMinor == null
          ? 'Message sent · text was not stored'
          : `₹${turn.amountMinor / 100}`,
        true,
      );
  }
}

function savedLanguage() {
  try {
    const value = localStorage.getItem('shishu-bargain-language');
    return ['hi', 'hinglish', 'en'].includes(value || '') ? value! : 'hi';
  } catch {
    return 'hi';
  }
}

function saveLanguage(language: string) {
  try {
    localStorage.setItem('shishu-bargain-language', language);
  } catch {
    // Storage is optional; the selected language still applies to this session.
  }
}

async function bargainRequest(url: string, init?: RequestInit) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    lastError instanceof DOMException && lastError.name === 'TimeoutError'
      ? 'The bargaining table took too long to respond. Please try again.'
      : 'The bargaining table could not be reached. Please check your connection and try again.',
  );
}

function updateBargainAttempts(remaining?: number) {
  if (typeof remaining !== 'number') return;
  text('#bargain-attempts', `${remaining} ${remaining === 1 ? 'offer' : 'offers'} remaining`);
}

const languageNames: Record<string, string> = { hi: 'Hindi', hinglish: 'Hinglish', en: 'English' };

function updateBargainMeta(language: string, expiresAt?: string) {
  const expiry = expiresAt
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(expiresAt),
      )
    : null;
  text(
    '#bargain-session-meta',
    `${expiry ? `Ends ${expiry}` : '30-minute demo'} · ${languageNames[language] || 'Hindi'}`,
  );
}

function resetBargaining() {
  bargainSessionId = null;
  bargainPanel.hidden = true;
  bargainButton.setAttribute('aria-expanded', 'false');
  bargainButton.disabled = false;
  bargainSetup.hidden = false;
  bargainConversation.hidden = true;
  bargainMarketplace.replaceChildren();
  bargainLanguage.value = savedLanguage();
  bargainLanguage.disabled = false;
  bargainMarketplace.disabled = false;
  bargainStart.disabled = false;
  bargainAccept.hidden = true;
  bargainChat.replaceChildren();
  bargainInput.value = '';
  bargainInput.placeholder = 'Try 150, or type in Hindi…';
  bargainInput.disabled = false;
  bargainSubmit.disabled = false;
  setBargainStatus();
  text('#bargain-attempts', '3 offers available');
  updateBargainMeta(bargainLanguage.value);
  dialog.querySelector<HTMLElement>('#bargaining-coupon')!.hidden = true;
}

function openBargaining() {
  bargainPanel.hidden = false;
  bargainButton.setAttribute('aria-expanded', 'true');
  bargainLanguage.focus();
  bargainPanel.scrollIntoView({
    block: 'nearest',
    behavior: reduceMotion.matches ? 'auto' : 'smooth',
  });
  if (selected)
    track(
      'bargain_opened',
      {
        placement: location.pathname.startsWith('/products/') ? 'product_detail' : 'product_modal',
        mode: 'demo',
      },
      { product_id: selected.product_id },
    );
}

async function startBargaining() {
  if (!selected || bargainSessionId) return;
  const offer = selected.offers.find(
    (candidate) => candidate.offer_id === bargainMarketplace.value,
  );
  if (!offer) {
    setBargainStatus('Choose a marketplace to begin.', true);
    return;
  }
  const language = bargainLanguage.value;
  saveLanguage(language);
  bargainConversation.hidden = false;
  bargainStart.disabled = true;
  bargainInput.disabled = true;
  bargainSubmit.disabled = true;
  setBargainStatus('Opening your private bargaining table', false, true);
  bargainPanel.scrollIntoView({
    block: 'nearest',
    behavior: reduceMotion.matches ? 'auto' : 'smooth',
  });

  try {
    const eligibilityResponse = await bargainRequest('/api/bargain/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selected.product_id,
        variantId: selected.attributes.color?.[colourIndex] || '',
        marketplaceId: offer.marketplace_id,
        marketplaceOfferId: offer.offer_id,
      }),
    });
    const eligibility = await eligibilityResponse.json();
    if (!eligibilityResponse.ok || !eligibility.eligible)
      throw new Error(eligibility.reason || eligibility.error || 'Bargaining is unavailable.');

    const response = await bargainRequest('/api/bargain/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selected.product_id,
        variantId: selected.attributes.color?.[colourIndex] || '',
        marketplaceId: offer.marketplace_id,
        marketplaceOfferId: offer.offer_id,
        language,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const session = (await response.json()) as BargainState;
    if (!response.ok || !session.sessionId)
      throw new Error(session.error || 'The bargaining table could not be opened.');
    bargainSessionId = session.sessionId;
    bargainLanguage.value = session.language || language;
    bargainLanguage.disabled = true;
    bargainMarketplace.value = session.marketplaceOfferId || offer.offer_id;
    bargainMarketplace.disabled = true;
    bargainSetup.hidden = true;
    track(
      'bargain_started',
      {
        placement: location.pathname.startsWith('/products/') ? 'product_detail' : 'product_modal',
        attempts_remaining: session.attemptsRemaining,
        mode: 'demo',
      },
      {
        product_id: selected.product_id,
        marketplace_id: session.marketplaceId || offer.marketplace_id,
      },
    );
    if (session.history?.length) renderBargainHistory(session.history);
    else
      addBargainMessage(
        session.assistantMessage ||
          (session.state === 'active'
            ? 'नमस्ते! बताइए, आपने क्या बजट सोचा है?'
            : 'इस उत्पाद के लिए आपकी हाल की डेमो बातचीत पूरी हो चुकी है।'),
      );
    updateBargainAttempts(session.attemptsRemaining);
    updateBargainMeta(session.language || language, session.expiresAt);
    setBargainStatus(
      session.resumed
        ? `Resumed your ${marketplaces.find((market) => market.id === session.marketplaceId)?.name || 'marketplace'} demo table.`
        : '',
    );
    bargainAccept.hidden = !(session.state === 'active' && session.offer?.amountMinor);
    if (session.state === 'active') {
      bargainInput.disabled = false;
      bargainSubmit.disabled = false;
      bargainInput.focus();
    } else {
      bargainInput.disabled = true;
      bargainSubmit.disabled = true;
      bargainInput.placeholder = 'This demo conversation has ended';
    }
  } catch (error) {
    bargainConversation.hidden = true;
    setBargainStatus(
      error instanceof Error ? error.message : 'The bargaining table could not be opened.',
      true,
    );
  } finally {
    bargainStart.disabled = false;
  }
}

function text(selector: string, value: string) {
  dialog.querySelector<HTMLElement>(selector)!.textContent = value;
}
function setPhoto(index: number) {
  if (!selected) return;
  photoIndex = (index + galleryPhotos.length) % galleryPhotos.length;
  const photo = galleryPhotos[photoIndex];
  image.dataset.fallback = photo.fallback;
  const badge = dialog.querySelector<HTMLElement>('#dialog-demo')!;
  badge.hidden = !photo.illustration;
  setResponsiveImage(image, photo.src);
  image.alt = photo.alt;
  if (!reduceMotion.matches)
    image.animate(
      [
        { opacity: 0.45, transform: 'scale(1.012)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  text('#photo-counter', `${photoIndex + 1} / ${galleryPhotos.length}`);
  thumbnails.querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(i === photoIndex));
    button.classList.toggle('selected', i === photoIndex);
  });
}

function selectColour(index: number) {
  if (!selected) return;
  colourIndex = index;
  const colour = selected.attributes.color?.[index];
  galleryPhotos = gallery(selected, colour);
  const label = dialog.querySelector('[data-dialog-colour-label]');
  if (label) label.textContent = colour || '';
  dialog
    .querySelectorAll('[data-dialog-colour]')
    .forEach((button, i) => button.setAttribute('aria-pressed', String(i === colourIndex)));
  thumbnails.replaceChildren();
  galleryPhotos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `View photo ${i + 1}`);
    const thumb = document.createElement('img');
    thumb.dataset.fallback = photo.fallback;
    setResponsiveImage(thumb, photo.src, '64px');
    thumb.alt = '';
    thumb.width = 64;
    thumb.height = 72;
    button.append(thumb);
    button.addEventListener('click', () => setPhoto(i));
    thumbnails.append(button);
  });
  const multiple = galleryPhotos.length > 1;
  thumbnails.hidden = !multiple;
  dialog.querySelector<HTMLButtonElement>('#previous-photo')!.hidden = !multiple;
  dialog.querySelector<HTMLButtonElement>('#next-photo')!.hidden = !multiple;
  setPhoto(0);
}

function openProduct(product: Product, trigger: HTMLElement) {
  selected = product;
  resetBargaining();
  dialog.querySelector<HTMLButtonElement>('[data-save-product]')!.dataset.saveProduct =
    product.product_id;
  opener = trigger;
  photoIndex = 0;
  cleanupOffers();
  text('#dialog-title', product.name);
  text(
    '#dialog-category',
    taxonomy.find((category) => category.id === product.category_id)?.name || product.category_id,
  );
  text('#dialog-price', money(price(product)));
  text('#dialog-description', product.description);
  dialog.querySelector<HTMLElement>('#dialog-demo')!.hidden = !product.demo;
  const attributes = dialog.querySelector('#dialog-attributes')!;
  attributes.replaceChildren();
  Object.entries(product.attributes).forEach(([key, values]) => {
    const row = document.createElement('div');
    const label = document.createElement('dt');
    label.textContent = key;
    const value = document.createElement('dd');
    value.textContent = values.join(', ');
    row.append(label, value);
    attributes.append(row);
  });
  const colours = dialog.querySelector('#dialog-colours')!;
  colours.replaceChildren();
  const label = document.createElement('p');
  label.textContent = 'Colour: ';
  const value = document.createElement('span');
  value.dataset.dialogColourLabel = '';
  value.style.textTransform = 'capitalize';
  label.append(value);
  const row = document.createElement('div');
  row.className = 'swatch-row';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Choose colour');
  const shades: Record<string, string> = { pink: '#edc1d4', blue: '#c5dce8', cream: '#eee1c5' };
  product.attributes.color?.forEach((colour, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'colour-swatch';
    button.dataset.dialogColour = colour;
    button.style.setProperty('--swatch', shades[colour] || '#eee');
    button.setAttribute('aria-label', colour);
    button.addEventListener('click', () => selectColour(index));
    row.append(button);
  });
  colours.append(label, row);
  const offers = dialog.querySelector('#dialog-offers')!;
  offers.replaceChildren();
  for (const offer of product.offers) {
    const market = marketplaces.find((m) => m.id === offer.marketplace_id)!;
    const bargainOption = document.createElement('option');
    bargainOption.value = offer.offer_id;
    bargainOption.textContent = market.name;
    bargainMarketplace.append(bargainOption);
    const available = Boolean(offer.url && offer.availability !== 'unavailable');
    const link = document.createElement(available ? 'a' : 'div');
    link.className = `marketplace${available ? '' : ' disabled'}`;
    const label = document.createElement('span');
    label.className = 'marketplace-name';
    const icon = document.createElement('span');
    icon.className = `marketplace-monogram ${market.id}`;
    icon.textContent = market.name[0];
    icon.setAttribute('aria-hidden', 'true');
    const name = document.createElement('strong');
    name.textContent = available ? `Buy on ${market.name}` : market.name;
    label.append(icon, name);
    const value = document.createElement('span');
    value.textContent = available
      ? `${money(offer.price_minor)} ↗`
      : product.demo
        ? 'Link coming soon'
        : 'Unavailable';
    link.append(label, value);
    if (link instanceof HTMLAnchorElement && offer.url) {
      link.href = offer.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.dataset.offer = offer.offer_id;
      link.dataset.product = product.product_id;
      link.dataset.marketplace = offer.marketplace_id;
    }
    offers.append(link);
  }
  selectColour(
    Number(
      trigger.closest('.product-card')?.querySelector<HTMLElement>('[data-colours]')?.dataset
        .selectedPhoto || 0,
    ),
  );
  if (!dialog.open) {
    scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('dialog-open');
    dialog.showModal();
  }
  dialog.scrollTop = 0;
  const viewId = crypto.randomUUID();
  const source = new URLSearchParams(location.search).get('q') ? 'search' : 'catalogue';
  track(
    'product_view',
    { source_surface: source },
    { product_id: product.product_id, page_view_id: viewId },
  );
  cleanupOffers = bindOfferTracking(offers, 'product_modal', viewId);
  document.dispatchEvent(
    new CustomEvent('product:open', { detail: { productId: product.product_id, viewId } }),
  );
}

document.addEventListener('click', (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const target = event.target as HTMLElement;
  const trigger = target.closest<HTMLElement>('[data-product-open]');
  const card = target.closest<HTMLElement>('.product-card');
  if (!trigger && (!card || target.closest('a, button, input, select'))) return;
  const product = products.find(
    (p) => p.product_id === (trigger?.dataset.productOpen || card?.dataset.product),
  );
  if (!product) return;
  event.preventDefault();
  openProduct(product, trigger || card!.querySelector<HTMLElement>('[data-product-open]')!);
});
dialog.querySelector('.dialog-close')!.addEventListener('click', () => dialog.close());
dialog.querySelector('.bargaining-close')!.addEventListener('click', () => {
  bargainPanel.hidden = true;
  bargainButton.setAttribute('aria-expanded', 'false');
  bargainButton.focus();
});
bargainButton.addEventListener('click', openBargaining);
bargainStart.addEventListener('click', startBargaining);
bargainForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = bargainInput.value.trim();
  if (!message || !bargainSessionId) {
    if (!bargainSessionId) setBargainStatus('The demo bargaining service is not ready yet.', true);
    return;
  }
  addBargainMessage(message, true);
  bargainInput.value = '';
  bargainInput.disabled = true;
  bargainSubmit.disabled = true;
  setBargainStatus('Thinking about your offer', false, true);
  try {
    const response = await bargainRequest(`/api/bargain/sessions/${bargainSessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, idempotencyKey: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Your offer could not be sent.');
    addBargainMessage(result.assistantMessage || 'आपकी बात समझी।');
    if (selected)
      track(
        'buyer_offer_submitted',
        {
          placement: location.pathname.startsWith('/products/')
            ? 'product_detail'
            : 'product_modal',
          attempts_remaining: result.attemptsRemaining,
          mode: 'demo',
        },
        { product_id: selected.product_id },
      );
    if (selected && result.state === 'active' && result.offer)
      track(
        'bargain_counteroffered',
        {
          placement: location.pathname.startsWith('/products/')
            ? 'product_detail'
            : 'product_modal',
          attempts_remaining: result.attemptsRemaining,
          mode: 'demo',
        },
        { product_id: selected.product_id },
      );
    updateBargainAttempts(result.attemptsRemaining);
    setBargainStatus();
    bargainAccept.hidden = !(result.state === 'active' && result.offer?.amountMinor);
    if (result.state !== 'active') {
      bargainInput.disabled = true;
      bargainSubmit.disabled = true;
      bargainInput.placeholder = 'This demo conversation has ended';
    }
    if (result.coupon?.code) {
      text('#coupon-code', result.coupon.code);
      text('#coupon-expiry', result.coupon.expiry || '—');
      dialog.querySelector<HTMLElement>('#bargaining-coupon')!.hidden = false;
    }
  } catch (error) {
    setBargainStatus(
      error instanceof Error ? error.message : 'Your offer could not be sent.',
      true,
    );
  } finally {
    if (bargainInput.placeholder !== 'This demo conversation has ended') {
      bargainInput.disabled = false;
      bargainSubmit.disabled = false;
      bargainInput.focus();
    }
  }
});
bargainAccept.addEventListener('click', async () => {
  if (!bargainSessionId) return;
  bargainAccept.disabled = true;
  setBargainStatus('Confirming the demo offer', false, true);
  try {
    const response = await bargainRequest(`/api/bargain/sessions/${bargainSessionId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The demo offer could not be accepted.');
    addBargainMessage(result.assistantMessage || 'Demo offer accepted.');
    if (selected)
      track(
        'bargain_accepted_demo',
        {
          placement: location.pathname.startsWith('/products/')
            ? 'product_detail'
            : 'product_modal',
          attempts_remaining: result.attemptsRemaining,
          mode: 'demo',
        },
        { product_id: selected.product_id },
      );
    bargainAccept.hidden = true;
    bargainInput.disabled = true;
    bargainSubmit.disabled = true;
    bargainInput.placeholder = 'This demo conversation has ended';
    setBargainStatus();
  } catch (error) {
    setBargainStatus(
      error instanceof Error ? error.message : 'The offer could not be accepted.',
      true,
    );
    bargainAccept.disabled = false;
  }
});
dialog
  .querySelector<HTMLButtonElement>('#coupon-copy-button')!
  .addEventListener('click', async () => {
    const code = dialog.querySelector<HTMLElement>('#coupon-code')!.textContent || '';
    if (code) await navigator.clipboard.writeText(code);
  });
// Only close when both pointer-down and pointer-up happen outside the dialog surface.
let outsideStart = false;
dialog.addEventListener('pointerdown', (event) => {
  outsideStart = event.target === dialog;
});
dialog.addEventListener('click', (event) => {
  if (outsideStart && event.target === dialog) dialog.close();
  outsideStart = false;
});
dialog.addEventListener('close', () => {
  cleanupOffers();
  resetBargaining();
  selected = undefined;
  document.body.classList.remove('dialog-open');
  document.body.style.top = '';
  window.scrollTo({ top: scrollY, behavior: 'instant' });
  opener?.focus({ preventScroll: true });
});
dialog.querySelector('#previous-photo')!.addEventListener('click', () => setPhoto(photoIndex - 1));
dialog.querySelector('#next-photo')!.addEventListener('click', () => setPhoto(photoIndex + 1));
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]',
      ),
    ].filter((element) => {
      const closed = element.closest('details:not([open])');
      return (
        element.tabIndex >= 0 &&
        element.getClientRects().length > 0 &&
        (!closed || element === closed.querySelector(':scope > summary'))
      );
    });
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (
    !(event.target as HTMLElement).closest('input,select,textarea') &&
    selected &&
    galleryPhotos.length > 1 &&
    ['ArrowLeft', 'ArrowRight'].includes(event.key)
  ) {
    event.preventDefault();
    setPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
stage.addEventListener('pointerdown', (event) => {
  if (!(event.target as HTMLElement).closest('button'))
    pointerStart = { x: event.clientX, y: event.clientY };
});
stage.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x,
    dy = event.clientY - pointerStart.y;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5)
    setPhoto(photoIndex + (dx < 0 ? 1 : -1));
  pointerStart = null;
});
stage.addEventListener('pointercancel', () => {
  pointerStart = null;
});
