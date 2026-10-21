import catalogue from '../generated/catalogue.json';
import type { EventType } from '../lib/events';
type Event = {
  event_id: string;
  event_type: EventType;
  occurred_at: string;
  session_id: string;
  page_view_id: string;
  page_path: string;
  catalogue_version: string;
  properties: unknown;
  [key: string]: unknown;
};
const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage disabled: in-memory consent only. */
    }
  },
};
let allowed = storage.get('analytics-consent') === 'yes';
export const analyticsAllowed = () => allowed;
export const ensureAnalyticsIdentity = () => identify();
export const flushTracking = () => {
  void flush();
};
let ready = false;
let identityRequest: Promise<void> | null = null;
let queue: Event[] = [];
let sending = false;
let session = crypto.randomUUID();
let lastActive = Date.now();
const pageView = crypto.randomUUID();
try {
  const old = JSON.parse(sessionStorage.getItem('catalogue-session') || 'null');
  if (old && Date.now() - old.time < 1800000) session = old.id;
} catch {}
function touch() {
  if (Date.now() - lastActive > 1800000) session = crypto.randomUUID();
  lastActive = Date.now();
  try {
    sessionStorage.setItem('catalogue-session', JSON.stringify({ id: session, time: lastActive }));
  } catch {}
}
async function identify() {
  if (!allowed) return;
  if (!identityRequest)
    identityRequest = (async () => {
      try {
        const response = await fetch('/api/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent: true }),
        });
        ready = response.ok;
      } catch {
        ready = false;
      } finally {
        identityRequest = null;
      }
    })();
  await identityRequest;
}
export function track(type: EventType, properties: unknown, context: Record<string, unknown> = {}) {
  if (!allowed) return;
  touch();
  queue.push({
    event_id: crypto.randomUUID(),
    event_type: type,
    occurred_at: new Date().toISOString(),
    session_id: session,
    page_view_id: pageView,
    page_path: location.pathname,
    catalogue_version: catalogue.version,
    properties,
    ...context,
  });
  if (queue.length > 50) queue = queue.slice(-50);
  if (queue.length >= 5) void flush();
}
async function flush() {
  if (!allowed || !queue.length || sending) return;
  sending = true;
  try {
    if (!ready) await identify();
    if (!ready || !allowed || !queue.length) return;
    const batch = queue.splice(0, 10);
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
      if (response.status >= 500 || response.status === 429) queue.unshift(...batch);
      if (response.status === 401) ready = false;
    } catch {
      queue.unshift(...batch);
    }
    queue = queue.filter((e) => Date.now() - Date.parse(e.occurred_at) < 60000).slice(0, 50);
  } finally {
    sending = false;
  }
}
function pageEvents() {
  const detail = document.querySelector<HTMLElement>('[data-detail-product]');
  track('page_view', {
    page_type: detail ? 'product' : location.pathname === '/' ? 'home' : 'other',
  });
  if (detail)
    track(
      'product_view',
      { source_surface: 'product_detail' },
      { product_id: detail.dataset.detailProduct },
    );
}
const consent = document.querySelector<HTMLElement>('#consent');
window.addEventListener('storage', (event) => {
  if (event.key !== 'analytics-consent' && event.key !== null) return;
  const next = storage.get('analytics-consent') === 'yes';
  if (next === allowed) return;
  allowed = next;
  ready = false;
  queue = [];
  if (allowed) {
    void identify();
    pageEvents();
  }
  document.dispatchEvent(new Event('analytics:change'));
});
if (consent) consent.hidden = storage.get('analytics-consent') !== null;
document.querySelector('#privacy-settings')?.addEventListener('click', () => {
  if (consent) consent.hidden = false;
});
document.querySelector('#allow-analytics')?.addEventListener('click', () => {
  const wasAllowed = allowed;
  allowed = true;
  storage.set('analytics-consent', 'yes');
  if (consent) consent.hidden = true;
  void identify();
  if (!wasAllowed) pageEvents();
  document.dispatchEvent(new Event('analytics:change'));
});
document.querySelector('#decline-analytics')?.addEventListener('click', () => {
  allowed = false;
  ready = false;
  queue = [];
  storage.set('analytics-consent', 'no');
  if (consent) consent.hidden = true;
  document.dispatchEvent(new Event('analytics:change'));
});
document.querySelector('#delete-history')?.addEventListener('click', async () => {
  const status = document.querySelector<HTMLElement>('#delete-status');
  allowed = false;
  queue = [];
  storage.set('analytics-consent', 'no');
  document.dispatchEvent(new Event('history:delete'));
  document.dispatchEvent(new Event('analytics:change'));
  try {
    const [response, bargainResponse] = await Promise.all([
      fetch('/api/delete-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      fetch('/api/bargain/history', { method: 'DELETE' }),
    ]);
    if (status)
      status.textContent =
        response.status === 401 && bargainResponse.ok
          ? 'No stored history is associated with this browser.'
          : (response.ok || response.status === 401) && bargainResponse.ok
            ? 'Recent history deleted. Archived history is queued for removal, normally within 24 hours.'
            : 'Deletion could not be completed. Please try again.';
  } catch {
    if (status) status.textContent = 'Connection unavailable. Please try again.';
  }
});
export function bindOfferTracking(
  root: ParentNode,
  placement: 'product_detail' | 'product_modal',
  viewId?: string,
) {
  const cleanups: (() => void)[] = [];
  root.querySelectorAll<HTMLAnchorElement>('[data-offer]').forEach((link) => {
    const context = {
      product_id: link.dataset.product,
      marketplace_id: link.dataset.marketplace,
      ...(viewId ? { page_view_id: viewId } : {}),
    };
    const onClick = () => {
      track(
        'marketplace_click',
        { offer_id: link.dataset.offer, placement, interaction_id: crypto.randomUUID() },
        context,
      );
      void flush();
    };
    link.addEventListener('click', onClick);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let recorded = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (timer) clearTimeout(timer);
          if (entry.intersectionRatio >= 0.5 && !recorded) {
            timer = setTimeout(() => {
              if (allowed && document.visibilityState === 'visible') {
                track(
                  'marketplace_button_impression',
                  { offer_id: link.dataset.offer, placement },
                  context,
                );
                recorded = true;
                observer.disconnect();
              }
            }, 1000);
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(link);
    cleanups.push(() => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
      link.removeEventListener('click', onClick);
    });
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
bindOfferTracking(document, 'product_detail');
if (allowed) {
  void identify();
  pageEvents();
}
setInterval(() => void flush(), 4000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush();
});
