import { eligible, cosine, type Filters } from './search';
import type { Product } from './product';

export type Ranking = 'content' | 'hybrid';
export type Recommendation = { product: Product; reason: string; score: number };
export function recommend(
  products: Product[],
  sourceId: string,
  options: {
    filters?: Filters;
    recentIds?: string[];
    popularity?: Record<string, number>;
    vectors?: Record<string, number[]>;
    ranking?: Ranking;
    limit?: number;
  } = {},
): Recommendation[] {
  const source = products.find((p) => p.product_id === sourceId && p.status === 'active');
  if (!source) return [];
  const recent = (options.recentIds || [])
    .slice(-8)
    .map((id) => products.find((p) => p.product_id === id))
    .filter((p): p is Product => !!p);
  const sourceTerms = new Set([...source.tags, ...Object.values(source.attributes).flat()]);
  return products
    .filter(
      (p) =>
        p.product_id !== sourceId &&
        eligible(p, options.filters || {}) &&
        p.offers.some((o) => o.availability !== 'unavailable'),
    )
    .map((product) => {
      const sameCategory = product.category_id === source.category_id;
      const terms = new Set([...product.tags, ...Object.values(product.attributes).flat()]);
      const shared = [...terms].filter((t) => sourceTerms.has(t)).length;
      const union = new Set([...terms, ...sourceTerms]).size;
      const affinity =
        recent.filter((p) => p.category_id === product.category_id).length /
        Math.max(1, recent.length);
      const vector = options.vectors?.[product.product_id],
        seed = options.vectors?.[sourceId];
      const similarity = vector && seed ? Math.max(0, cosine(vector, seed)) : 0;
      const popularity =
        options.ranking === 'hybrid'
          ? Math.min(1, Math.log1p(options.popularity?.[product.product_id] || 0) / Math.log(101))
          : 0;
      const score =
        (sameCategory ? 3 : 0) +
        (union ? shared / union : 0) +
        similarity +
        affinity * 0.5 +
        popularity * 0.4;
      return {
        product,
        score,
        reason: sameCategory ? 'From the same collection' : 'More for little everyday moments',
      };
    })
    .sort((a, b) => b.score - a.score || a.product.product_id.localeCompare(b.product.product_id))
    .slice(0, Math.max(0, Math.min(6, options.limit ?? 3)));
}

// Deterministic assignment; caller supplies a salted, non-public browser hash.
export function experimentVariant(hash: string): Ranking {
  return parseInt(hash.slice(0, 8), 16) % 2 === 0 ? 'content' : 'hybrid';
}
