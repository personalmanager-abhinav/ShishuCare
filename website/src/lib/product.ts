// Browser-safe helpers: schema validation stays out of the storefront bundle.
import type { Product } from './catalogue';
export type { Product } from './catalogue';

export function price(p: Product) {
  const prices = p.offers
    .filter((o) => o.availability !== 'unavailable' && o.price_minor !== null)
    .map((o) => o.price_minor!);
  return prices.length ? Math.min(...prices) : null;
}
export const money = (minor: number | null) =>
  minor === null
    ? 'Check marketplace'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(minor / 100);
export const semanticText = (p: Product) =>
  [p.name, p.description, p.category_id, ...Object.values(p.attributes).flat(), ...p.tags].join(
    ' ',
  );
