import catalogue from '../generated/catalogue.json';
const key = 'shishu-mannpasand-v1';
const valid = new Set(catalogue.products.map((p) => p.product_id));
let saved = new Set<string>();
let persistent = true;
function read() {
  try {
    const ids = JSON.parse(localStorage.getItem(key) || '[]');
    saved = new Set(
      Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && valid.has(id)) : [],
    );
  } catch {
    persistent = false;
  }
}
function render() {
  document.querySelectorAll<HTMLButtonElement>('[data-save-product]').forEach((button) => {
    const yes = saved.has(button.dataset.saveProduct || '');
    button.setAttribute('aria-pressed', String(yes));
    button.setAttribute('aria-label', yes ? 'Remove from Mannpasand' : 'Save to Mannpasand');
    button.title = button.getAttribute('aria-label')!;
  });
  const page = document.querySelector('[data-mannpasand-page]');
  page
    ?.querySelectorAll<HTMLElement>('.product-card')
    .forEach((card) => (card.hidden = !saved.has(card.dataset.product!)));
  const empty = document.querySelector<HTMLElement>('#mannpasand-empty');
  if (empty) empty.hidden = saved.size > 0;
  const count = document.querySelector('#mannpasand-status');
  if (count)
    count.textContent = `${saved.size} saved ${saved.size === 1 ? 'find' : 'finds'} · ${persistent ? 'Kept on this browser' : 'Available for this page only; browser storage is unavailable'}`;
}
read();
render();
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-save-product]');
  if (!button) return;
  const id = button.dataset.saveProduct!;
  if (!valid.has(id)) return;
  saved.has(id) ? saved.delete(id) : saved.add(id);
  try {
    localStorage.setItem(key, JSON.stringify([...saved]));
  } catch {
    persistent = false;
  }
  render();
  const status = document.querySelector('#save-status');
  if (status)
    status.textContent =
      (saved.has(id) ? 'Saved to Mannpasand.' : 'Removed from Mannpasand.') +
      (persistent ? '' : ' Saved for this page only; browser storage is unavailable.');
});
document.addEventListener('product:open', render);
window.addEventListener('storage', (event) => {
  if (event.key === key || event.key === null) {
    read();
    render();
  }
});
