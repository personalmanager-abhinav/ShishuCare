type StageProduct = {
  id: string;
  name: string;
  category: string;
  price: string;
  description: string;
  image: string;
  colours: string[];
  search: string;
};

const app = document.querySelector<HTMLElement>('[data-stage-app]');
if (!app) throw new Error('Stage application shell is missing.');

const products = JSON.parse(app.dataset.products || '[]') as StageProduct[];
const image = document.querySelector<HTMLImageElement>('#stage-product-image')!;
const previousImage = document.querySelector<HTMLImageElement>('#stage-previous-image')!;
const nextImage = document.querySelector<HTMLImageElement>('#stage-next-image')!;
const productStage = document.querySelector<HTMLElement>('#stage-product')!;
const indexButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-stage-index]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let selectedIndex = 0;
let transitionToken = 0;
let pointerStart: { x: number; y: number } | null = null;

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

function text(selector: string, value: string) {
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function updateSave(productId: string) {
  const button = document.querySelector<HTMLButtonElement>('.stage-save')!;
  button.dataset.saveProduct = productId;
  try {
    const saved = JSON.parse(localStorage.getItem('shishu-mannpasand-v1') || '[]');
    const active = Array.isArray(saved) && saved.includes(productId);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Remove from Mannpasand' : 'Save to Mannpasand');
  } catch {
    button.setAttribute('aria-pressed', 'false');
  }
}

function renderProduct(index: number, urlMode: 'replace' | 'push' | false = 'replace') {
  selectedIndex = (index + products.length) % products.length;
  const product = products[selectedIndex];
  const previous = products[(selectedIndex - 1 + products.length) % products.length];
  const next = products[(selectedIndex + 1) % products.length];
  image.src = product.image;
  image.alt = product.name;
  previousImage.src = previous.image;
  nextImage.src = next.image;
  text('#stage-category', product.category);
  text('#stage-name', product.name);
  text('#stage-price', product.price);
  text('#stage-description', product.description);
  text(
    '#stage-position',
    `${String(selectedIndex + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}`,
  );
  const colours = document.querySelector<HTMLElement>('#stage-colours')!;
  colours.replaceChildren(
    ...product.colours.map((colour) => {
      const swatch = document.createElement('span');
      swatch.title = colour;
      swatch.style.background = colourValue[colour.toLowerCase()] || colour;
      return swatch;
    }),
  );
  document.querySelector<HTMLButtonElement>('#stage-buy')!.dataset.productOpen = product.id;
  document.querySelector<HTMLButtonElement>('#stage-offer')!.dataset.productOpen = product.id;
  updateSave(product.id);
  indexButtons.forEach((button, buttonIndex) => {
    button.setAttribute('aria-selected', String(buttonIndex === selectedIndex));
    button.tabIndex = buttonIndex === selectedIndex ? 0 : -1;
  });
  indexButtons[selectedIndex]?.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior: reduceMotion.matches ? 'auto' : 'smooth',
  });
  if (urlMode) {
    const url = new URL(location.href);
    url.searchParams.set('product', product.id);
    if (urlMode === 'push') history.pushState({ product: product.id }, '', url);
    else history.replaceState({ product: product.id }, '', url);
  }
}

function selectProduct(index: number, direction?: 'next' | 'previous') {
  const normalized = (index + products.length) % products.length;
  if (normalized === selectedIndex) return;
  const token = ++transitionToken;
  const resolvedDirection = direction || (normalized > selectedIndex ? 'next' : 'previous');
  if (reduceMotion.matches) {
    renderProduct(normalized, 'push');
    return;
  }
  productStage.className = `stage-product changing-${resolvedDirection}`;
  window.setTimeout(() => {
    if (token !== transitionToken) return;
    renderProduct(normalized, 'push');
    productStage.className = `stage-product entering-${resolvedDirection}`;
    window.setTimeout(() => {
      if (token === transitionToken) productStage.className = 'stage-product';
    }, 500);
  }, 170);
}

document
  .querySelector('#stage-previous')
  ?.addEventListener('click', () => selectProduct(selectedIndex - 1, 'previous'));
document
  .querySelector('#stage-next')
  ?.addEventListener('click', () => selectProduct(selectedIndex + 1, 'next'));
indexButtons.forEach((button, index) =>
  button.addEventListener('click', () => selectProduct(index)),
);

document.addEventListener('keydown', (event) => {
  if (
    document.querySelector<HTMLDialogElement>('#product-dialog')?.open ||
    (event.target as HTMLElement).closest('input,select,textarea')
  )
    return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    selectProduct(selectedIndex - 1, 'previous');
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    selectProduct(selectedIndex + 1, 'next');
  }
});

const showcase = document.querySelector<HTMLElement>('.stage-showcase')!;
showcase.addEventListener('pointerdown', (event) => {
  if (!(event.target as HTMLElement).closest('button'))
    pointerStart = { x: event.clientX, y: event.clientY };
});
showcase.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4)
    selectProduct(selectedIndex + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'previous');
  pointerStart = null;
});
showcase.addEventListener('pointercancel', () => (pointerStart = null));

const searchForm = document.querySelector<HTMLFormElement>('#stage-search')!;
const searchToggle = document.querySelector<HTMLButtonElement>('#stage-search-toggle')!;
const searchInput = document.querySelector<HTMLInputElement>('#stage-query')!;
const searchResults = document.querySelector<HTMLElement>('#stage-search-results')!;
function closeSearch() {
  searchForm.hidden = true;
  searchToggle.setAttribute('aria-expanded', 'false');
  searchResults.replaceChildren();
  searchToggle.focus();
}
searchToggle.addEventListener('click', () => {
  searchForm.hidden = false;
  searchToggle.setAttribute('aria-expanded', 'true');
  searchInput.focus();
});
document.querySelector('#stage-search-close')?.addEventListener('click', closeSearch);
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  searchResults.replaceChildren();
  if (!query) return;
  products
    .filter((product) => product.search.includes(query))
    .slice(0, 6)
    .forEach((product) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      const thumb = document.createElement('img');
      thumb.src = product.image;
      thumb.alt = '';
      const name = document.createElement('strong');
      name.textContent = product.name;
      const amount = document.createElement('small');
      amount.textContent = product.price;
      button.append(thumb, name, amount);
      button.addEventListener('click', () => {
        selectProduct(products.indexOf(product));
        closeSearch();
      });
      searchResults.append(button);
    });
});
searchForm.addEventListener('submit', (event) => event.preventDefault());

document.querySelector('[data-stage-offer]')?.addEventListener('click', () => {
  window.setTimeout(() => document.querySelector<HTMLButtonElement>('#bargain-button')?.click(), 0);
});

window.addEventListener('popstate', () => {
  const id = new URL(location.href).searchParams.get('product');
  const index = products.findIndex((product) => product.id === id);
  if (index >= 0) renderProduct(index, false);
});

const requested = new URL(location.href).searchParams.get('product');
const initial = Math.max(
  0,
  products.findIndex((product) => product.id === requested),
);
renderProduct(initial, requested ? false : 'replace');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('/stage-sw.js', { scope: '/stage/' }).catch(() => undefined),
  );
}
