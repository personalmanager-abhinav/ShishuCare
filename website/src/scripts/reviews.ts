export {};
type Review = {
  id: string;
  product_id: string;
  display_name: string;
  avatar: string;
  rating: number;
  review_text: string;
};
type RecordState = {
  first: number;
  prompted?: boolean;
  submission?: { id: string; token: string };
};
const key = 'shishu-experiences-v1';
let reviewHistory: Record<string, RecordState> = {};
try {
  const raw = JSON.parse(localStorage.getItem(key) || '{}');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) reviewHistory = raw;
} catch {
  /* Optional reminders stay off when storage is unavailable. */
}
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(reviewHistory));
    return true;
  } catch {
    return false;
  }
}
const avatars: Record<string, string> = { flower: '✿', moon: '☾', leaf: '❧' };
function author(name: string, avatar: string) {
  const line = document.createElement('div');
  line.className = 'review-author';
  const icon = document.createElement('span');
  icon.className = 'review-avatar';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = avatars[avatar] || name[0]?.toUpperCase() || '·';
  const label = document.createElement('span');
  label.textContent = name;
  line.append(icon, label);
  return line;
}
function note(review: Review, compact = false) {
  const item = document.createElement('article');
  item.className = 'published-note';
  const quote = document.createElement('blockquote');
  quote.textContent =
    compact && review.review_text.length > 90
      ? review.review_text.slice(0, 87) + '…'
      : review.review_text;
  item.append(quote, author(review.display_name, review.avatar));
  if (!compact) {
    const meta = document.createElement('small');
    meta.textContent = `${['', 'Disappointed', 'Could be better', 'Mixed feelings', 'Happy with it', 'Loved it'][review.rating]} · Purchase not verified`;
    item.append(meta);
  }
  return item;
}
let reviews: Review[] = [];
function paint() {
  document.querySelectorAll<HTMLElement>('.product-card').forEach((card) => {
    const first = reviews.find((r) => r.product_id === card.dataset.product);
    const aside = card.querySelector('.parent-note');
    if (!aside) return;
    if(!first){if(aside.querySelector('.published-note')){aside.querySelectorAll(':scope > :not(.parent-note-heading)').forEach(n=>n.remove());const empty=document.createElement('p');empty.textContent='Awaiting our first story';aside.append(empty);}return;}
    aside.querySelectorAll(':scope > :not(.parent-note-heading)').forEach((n) => n.remove());
    aside.append(note(first, true));
  });
  document.querySelectorAll<HTMLElement>('[data-reviews-product]').forEach((section) => {
    const list = section.querySelector('[data-review-list]')!;
    list.replaceChildren();
    const rows = reviews.filter((r) => r.product_id === section.dataset.reviewsProduct);
    rows.forEach((r) => list.append(note(r)));
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'review-help';
      p.textContent = 'A little space for honest experiences.';
      list.append(p);
    }
  });
}
async function refresh() {
  try {
    const response = await fetch('/api/reviews/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (response.ok) {
      reviews = (await response.json()).reviews;
      paint();
    }
  } catch {
    /* Reviews never block browsing. */
  }
}
function visit(section: HTMLElement, id: string) {
  section.dataset.reviewsProduct = id;
  const form = section.querySelector<HTMLFormElement>('form')!;
  form.reset();
  section.querySelector<HTMLDetailsElement>('details')!.open = false;
  const state = reviewHistory[id];
  form.hidden=Boolean(state?.submission);
  const status = section.querySelector<HTMLElement>('[data-review-status]')!;
  status.textContent = state?.submission
    ? 'Your note was sent for review. You can withdraw it below.'
    : '';
  const withdraw = section.querySelector<HTMLButtonElement>('[data-review-withdraw]')!;
  withdraw.hidden = !state?.submission;
  const invite = section.querySelector('[data-review-invite]')!;
  invite.textContent = 'Share an experience';
  if (
    state?.first &&
    !state.prompted &&
    !state.submission &&
    Date.now() - state.first >= 86400000
  ) {
    state.prompted = true;
    if (persist()) invite.textContent = 'Bought this? Share your experience.';
  }
  if (!state) {
    reviewHistory[id] = { first: Date.now() };
    persist();
  }
  paint();
}
document.querySelectorAll<HTMLElement>('[data-reviews-product]').forEach((section) => {
  const form = section.querySelector<HTMLFormElement>('form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = section.dataset.reviewsProduct!;
    const data = new FormData(form);
    const button = form.querySelector<HTMLButtonElement>('[type=submit]')!;
    const status = section.querySelector<HTMLElement>('[data-review-status]')!;
    button.disabled = true;
    status.textContent = 'Sending your note…';
    try {
      const response = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: id,
          name: data.get('name'),
          avatar: data.get('avatar'),
          rating: Number(data.get('rating')),
          review: data.get('review'),
          website: data.get('website'),
          consent: data.get('consent') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not send your note. Please try again.');
      reviewHistory[id] = {
        ...(reviewHistory[id] || { first: Date.now() }),
        prompted: true,
        submission: { id: result.id, token: result.token },
      };
      const stored = persist();
      if (section.dataset.reviewsProduct === id) {
        status.textContent =
          'Thank you. Your note will appear after review.' +
          (stored ? '' : ' Keep this page open to retain the withdrawal control.');
        form.reset();
        form.hidden=true;
        section.querySelector<HTMLButtonElement>('[data-review-withdraw]')!.hidden = false;
      }
    } catch (error) {
      if (section.dataset.reviewsProduct === id)
        status.textContent = error instanceof Error ? error.message : 'Unable to send your note.';
    } finally {
      button.disabled = false;
    }
  });
  section.querySelector('[data-review-withdraw]')!.addEventListener('click', async () => {
    const id = section.dataset.reviewsProduct!,
      submission = reviewHistory[id]?.submission;
    if (!submission) return;
    const status = section.querySelector<HTMLElement>('[data-review-status]')!;
    try {
      const response = await fetch('/api/reviews/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!response.ok) throw Error();
      delete reviewHistory[id].submission;
      persist();
      if (section.dataset.reviewsProduct === id) {
        status.textContent = 'Your note has been withdrawn.';
        form.hidden=false;
        section.querySelector<HTMLButtonElement>('[data-review-withdraw]')!.hidden = true;
      }
      await refresh();
    } catch {
      status.textContent = 'Could not withdraw your note. Please try again.';
    }
  });
  if (section.dataset.reviewsProduct) visit(section, section.dataset.reviewsProduct);
});
document.addEventListener('product:open', (event) => {
  const id = (event as CustomEvent<{ productId: string }>).detail.productId;
  const section = document.querySelector<HTMLElement>('#product-dialog [data-reviews-product]');
  if (section) visit(section, id);
});
void refresh();
