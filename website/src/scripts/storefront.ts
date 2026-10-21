import catalogue from '../generated/catalogue.json';
import { search, type Filters } from '../lib/search';
import { price, type Product } from '../lib/product';
import { track } from './tracking';
import { normalizeQuery } from '../lib/query-normalization';
const products = catalogue.products as Product[];
const form = document.querySelector<HTMLFormElement>('#search-form')!;
const input = document.querySelector<HTMLInputElement>('#query')!;
const budget = document.querySelector<HTMLSelectElement>('#budget')!;
const sort = document.querySelector<HTMLSelectElement>('#sort')!;
const grid = document.querySelector<HTMLElement>('#product-grid')!;
const cards = new Map(
  [...grid.querySelectorAll<HTMLElement>('[data-product]')].map((card) => [
    card.dataset.product!,
    card,
  ]),
);
const initialCategory =
  document.querySelector<HTMLElement>('#collection')?.dataset.categoryId || '';
const categorySelect = document.querySelector<HTMLSelectElement>('#category-filter')!;
let category = initialCategory;
let searchId: string | undefined;
let ordered = products;
let requestId = 0;
const queryParams = new URLSearchParams(location.search);
input.value = queryParams.get('q') || '';
function render(list: Product[], filters: Filters) {
  document.querySelector<HTMLElement>('#results-refinement')!.hidden = !(
    input.value.trim() ||
    category ||
    budget.value ||
    initialCategory
  );
  ordered = [...list];
  if (sort.value === 'price-low')
    ordered.sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
  if (sort.value === 'price-high') ordered.sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
  if (sort.value === 'newest') ordered.sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const card of cards.values()) card.hidden = true;
  for (const product of ordered) {
    const card = cards.get(product.product_id);
    if (card) {
      card.hidden = false;
      const colour = filters.color;
      const group = card.querySelector<HTMLElement>('[data-colours]');
      const index = colour ? product.attributes.color?.indexOf(colour) : -1;
      if (
        index !== undefined &&
        index >= 0 &&
        product.colour_variants?.some((v) => v.colour === colour)
      ) {
        group?.querySelector<HTMLButtonElement>(`[data-colour-index="${index}"]`)?.click();
        card.dataset.searchColour = colour!;
        card.style.setProperty(
          '--result-accent',
          getComputedStyle(
            group!.querySelector(`[data-colour-index="${index}"]`)!,
          ).getPropertyValue('--swatch'),
        );
      } else if (card.dataset.searchColour) {
        group?.querySelector<HTMLButtonElement>('[data-colour-index="0"]')?.click();
        delete card.dataset.searchColour;
        card.style.removeProperty('--result-accent');
      }
      grid.append(card);
    }
  }
  document.querySelector('#result-count')!.textContent =
    `${ordered.length} ${ordered.length === 1 ? 'find' : 'finds'}${input.value.trim() ? ` for “${input.value.trim()}”` : ''}`;
  (document.querySelector('#empty') as HTMLElement).hidden = ordered.length > 0;
  (document.querySelector('#clear-filters') as HTMLElement).hidden =
    !input.value && !category && !budget.value;
  const interpreted = document.querySelector<HTMLElement>('#interpreted')!;
  const labels = Object.entries(filters)
    .filter(([key, value]) => value !== undefined && key !== 'maxExclusive')
    .map(([key, value]) =>
      key === 'max'
        ? `${filters.maxExclusive ? 'Under' : 'Up to'} ₹${Number(value) / 100}`
        : key === 'min'
          ? `From ₹${Number(value) / 100}`
          : key === 'excludeColor'
            ? `Exclude ${value}`
            : String(value),
    );
  interpreted.textContent = labels.length ? `Applied: ${labels.join(' · ')}` : '';
  interpreted.hidden = !labels.length;
}
async function run() {
  const current = ++requestId;
  const q = input.value.trim();
  const filters: Filters = {};
  if (category) filters.category = category;
  if (budget.value) filters.max = Number(budget.value) * 100;
  form.setAttribute('aria-busy', 'true');
  const mode = document.querySelector('#search-mode')!;
  mode.textContent = 'Finding your matches…';
  let results: Product[],
    applied: Filters,
    fallback = true;
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q,
        category,
        ...(filters.max !== undefined ? { max: filters.max } : {}),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error('Search unavailable');
    const result = await response.json();
    if (current !== requestId) return;
    results = result.product_ids
      .map((id: string) => products.find((p) => p.product_id === id))
      .filter(Boolean);
    applied = result.filters;
    fallback = result.fallback;
    searchId = result.search_id;
  } catch {
    if (current !== requestId) return;
    const result = search(products, q, filters);
    results = result.products;
    applied = result.filters;
    searchId = crypto.randomUUID();
  }
  render(results, applied);
  form.setAttribute('aria-busy', 'false');
  mode.textContent = q
    ? fallback
      ? 'Showing keyword matches. Semantic search is currently unavailable.'
      : 'Matched by meaning, with your filters applied.'
    : 'Search by product, colour, material, or budget.';
  if (normalizeQuery(q) !== q) mode.textContent += ` Interpreted as “${normalizeQuery(q)}”.`;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  history.replaceState(
    null,
    '',
    `${location.pathname}${params.size ? '?' + params : ''}${location.hash}`,
  );
  if (q)
    track(
      'search',
      {
        query: q,
        result_count: results.length,
        top_ids: results.slice(0, 10).map((p) => p.product_id),
        fallback,
      },
      { search_id: searchId },
    );
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run();
});
categorySelect.addEventListener('change', () => {
  category = categorySelect.value;
  track('filter_usage', { filter: 'category', value: category || 'all' });
  void run();
});
budget.addEventListener('change', () => {
  track('filter_usage', { filter: 'budget', value: budget.value || 'any' });
  void run();
});
sort.addEventListener('change', () => {
  track('sort_usage', { sort: sort.value });
  void run();
});
function reset() {
  input.value = '';
  budget.value = '';
  sort.value = 'relevance';
  document.dispatchEvent(new Event('choices:sync'));
  category = initialCategory;
  categorySelect.value = category;
  document.dispatchEvent(new Event('choices:sync'));
  void run();
}
document.querySelector('#clear-filters')?.addEventListener('click', reset);
document.querySelector('#reset-search')?.addEventListener('click', reset);
document.addEventListener('product:open', (event) => {
  const { productId, viewId } = (event as CustomEvent<{ productId: string; viewId: string }>)
    .detail;
  if (searchId && input.value.trim())
    track(
      'search_result_click',
      { position: ordered.findIndex((p) => p.product_id === productId) + 1 },
      { search_id: searchId, product_id: productId, page_view_id: viewId },
    );
});
// Let shared colour handlers initialize before rendering attribute-aware results.
if (input.value || category) queueMicrotask(() => void run());
