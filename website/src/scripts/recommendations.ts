import catalogue from '../generated/catalogue.json';
import config from '../../data/discovery.json';
import { recommend } from '../lib/recommendations';
import type { Product } from '../lib/product';
import { gallery } from '../lib/gallery';
import { setResponsiveImage } from '../lib/responsive-image';
import { analyticsAllowed, ensureAnalyticsIdentity, track, flushTracking } from './tracking';

const products = catalogue.products as Product[];
const preferenceKey = 'shishu-session-preferences-v1';
type Preference = { enabled: boolean; ids: string[]; time: number };
let preference: Preference = { enabled: false, ids: [], time: Date.now() };
try {
  const saved = JSON.parse(sessionStorage.getItem(preferenceKey) || 'null');
  if (saved?.enabled === true && Array.isArray(saved.ids) && Date.now() - saved.time < 1800000)
    preference = {
      enabled: true,
      ids: saved.ids
        .filter(
          (id: unknown) => typeof id === 'string' && products.some((p) => p.product_id === id),
        )
        .slice(-8),
      time: saved.time,
    };
} catch {
  /* No optional history without an explicit choice. */
}
function savePreference() {
  try {
    if (preference.enabled) sessionStorage.setItem(preferenceKey, JSON.stringify(preference));
    else sessionStorage.removeItem(preferenceKey);
  } catch {
    /* Preference remains in memory for this page. */
  }
}
function remember(id: string) {
  if (!preference.enabled) return;
  if (Date.now() - preference.time >= 1800000) preference.ids = [];
  preference.ids = [...preference.ids.filter((p) => p !== id), id].slice(-8);
  preference.time = Date.now();
  savePreference();
}
const toggle = document.querySelector<HTMLInputElement>('#session-personalization');
if (toggle) {
  toggle.checked = preference.enabled;
  toggle.addEventListener('change', () => {
    preference = { enabled: toggle.checked, ids: [], time: Date.now() };
    savePreference();
  });
}
type ResponseData = {
  items: { product_id: string; reason: string }[];
  request_id?: string | null;
  model_version?: string;
  experiment_id?: string;
  variant?: 'content' | 'hybrid';
};
const cleanups = new Map<HTMLElement, () => void>();
const versions = new Map<HTMLElement, number>();
async function render(root: HTMLElement, sourceId: string) {
  const version = (versions.get(root) || 0) + 1;
  versions.set(root, version);
  cleanups.get(root)?.();
  root.dataset.sourceProduct = sourceId;
  root.hidden = true;
  if (!config.enabled) return;
  const recentIds =
    preference.enabled && Date.now() - preference.time < 1800000 ? preference.ids : [];
  let data: ResponseData = {
    items: recommend(products, sourceId, { recentIds }).map((r) => ({
      product_id: r.product.product_id,
      reason: r.reason,
    })),
  };
  try {
    if (analyticsAllowed()) await ensureAnalyticsIdentity();
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: sourceId,
        analytics_consent: analyticsAllowed(),
        personalize: preference.enabled,
        recent_ids: recentIds,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) data = await response.json();
  } catch {
    /* Static content ranking remains usable without the API. */
  }
  if (versions.get(root) !== version) return;
  const list = root.querySelector('.related-list')!;
  list.replaceChildren();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const visible = new Set<Element>();
  const recorded = new Set<Element>();
  const emit = (
    type: 'recommendation_impression' | 'recommendation_click',
    element: HTMLElement,
  ) => {
    if (!data.request_id || !analyticsAllowed()) return;
    track(
      type,
      {
        recommendation_id: data.request_id,
        position: Number(element.dataset.position),
        model_version: data.model_version,
        experiment_id: data.experiment_id,
        variant: data.variant,
        placement: root.dataset.placement,
      },
      { product_id: element.dataset.relatedProduct },
    );
  };
  function schedule(element: Element) {
    if (timers.has(element)) clearTimeout(timers.get(element));
    if (
      !document.hidden &&
      visible.has(element) &&
      !recorded.has(element) &&
      data.request_id &&
      analyticsAllowed()
    ) {
      timers.set(
        element,
        setTimeout(() => {
          timers.delete(element);
          if (document.hidden || !visible.has(element) || !analyticsAllowed()) return;
          emit('recommendation_impression', element as HTMLElement);
          recorded.add(element);
        }, 1000),
      );
    }
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.intersectionRatio >= 0.5) visible.add(entry.target);
        else visible.delete(entry.target);
        schedule(entry.target);
      }),
    { threshold: [0, 0.5] },
  );
  const visibility = () => list.querySelectorAll('a').forEach(schedule);
  document.addEventListener('visibilitychange', visibility);
  data.items.slice(0, 3).forEach((item, index) => {
    const product = products.find((p) => p.product_id === item.product_id);
    if (!product || product.product_id === sourceId) return;
    const link = document.createElement('a');
    link.href = `/products/${product.slug}/`;
    link.className = 'related-item';
    link.dataset.relatedProduct = product.product_id;
    link.dataset.position = String(index + 1);
    const image = document.createElement('img'),
      photo = gallery(product)[0];
    image.width = 64;
    image.height = 76;
    image.alt = '';
    image.loading = 'lazy';
    image.dataset.fallback = photo.fallback;
    setResponsiveImage(image, photo.src, '64px');
    const copy = document.createElement('span'),
      title = document.createElement('strong'),
      reason = document.createElement('small');
    title.textContent = product.name;
    reason.textContent = item.reason;
    copy.append(title, reason);
    link.append(image, copy);
    link.addEventListener('click', () => {
      emit('recommendation_click', link);
      flushTracking();
    });
    list.append(link);
    observer.observe(link);
  });
  root.hidden = !list.childElementCount;
  cleanups.set(root, () => {
    observer.disconnect();
    timers.forEach(clearTimeout);
    document.removeEventListener('visibilitychange', visibility);
  });
}
document
  .querySelectorAll<HTMLElement>('[data-recommendations][data-placement="product_detail"]')
  .forEach((root) => {
    remember(root.dataset.sourceProduct!);
    void render(root, root.dataset.sourceProduct!);
  });
document.addEventListener('product:open', (event) => {
  const id = (event as CustomEvent<{ productId: string }>).detail.productId;
  remember(id);
  const root = document.querySelector<HTMLElement>('#product-dialog [data-recommendations]');
  if (root) void render(root, id);
});
document.querySelector('#product-dialog')?.addEventListener('close', () => {
  const root = document.querySelector<HTMLElement>('#product-dialog [data-recommendations]');
  if (root) {
    versions.set(root, (versions.get(root) || 0) + 1);
    cleanups.get(root)?.();
    root.hidden = true;
  }
});
document.addEventListener('analytics:change', () =>
  document.querySelectorAll<HTMLElement>('[data-recommendations]').forEach((root) => {
    if (root.dataset.sourceProduct && (!root.closest('dialog') || root.closest('dialog')!.open))
      void render(root, root.dataset.sourceProduct);
  }),
);
document.addEventListener('history:delete', () => {
  preference = { enabled: false, ids: [], time: Date.now() };
  savePreference();
  if (toggle) toggle.checked = false;
});
