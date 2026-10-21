import { price, semanticText, type Product } from './product';
import { normalizeQuery } from './query-normalization';
export type Filters = {
  category?: string;
  min?: number;
  max?: number;
  maxExclusive?: boolean;
  color?: string;
  excludeColor?: string;
  material?: string;
  type?: string;
  season?: string;
  occasion?: string;
};
const colors = ['black', 'white', 'blue', 'green', 'cream', 'red', 'pink', 'brown', 'yellow'];
export function parseQuery(query: string): Filters {
  const q = normalizeQuery(query)
    .toLowerCase()
    .replace(/₹|\brs\.?\b|\binr\b/g, '')
    .trim();
  const filters: Filters = {};
  const range = q.match(/between\s+(\d+(?:\.\d+)?)\s+(?:and|to)\s+(\d+(?:\.\d+)?)/);
  const upper = q.match(/(under|below|less than|up to|at most)\s+(\d+(?:\.\d+)?)/);
  const lower = q.match(/(?:above|over|at least)\s+(\d+(?:\.\d+)?)/);
  if (range) {
    filters.min = Number(range[1]) * 100;
    filters.max = Number(range[2]) * 100;
  } else if (upper) {
    filters.max = Number(upper[2]) * 100;
    filters.maxExclusive = ['under', 'below', 'less than'].includes(upper[1]);
  }
  if (lower) filters.min = Number(lower[1]) * 100 + (/above|over/.test(lower[0]) ? 1 : 0);
  for (const color of colors)
    if (new RegExp(`\\b${color}\\b`).test(q)) {
      if (new RegExp(`(?:not|without|except)\\s+${color}\\b`).test(q)) filters.excludeColor = color;
      else filters.color = color;
    }
  for (const material of ['cotton', 'linen', 'canvas', 'ceramic'])
    if (q.includes(material)) filters.material = material;
  for (const [pattern, type] of [
    [/\bcaps?\b/, 'cap'],
    [/\b(?:shawls?|shall)\b/, 'shawl'],
    [/\bsocks?\b/, 'socks'],
    [/\bdiapers?\b/, 'diaper'],
    [/\bbibs?\b/, 'bib'],
    [/\bmats?\b/, 'mat'],
    [/\bswaddles?\b/, 'swaddle'],
    [/\b(?:t-shirt|tee)\b/, 't-shirt'],
    [/\bshirts?\b/, 'shirt'],
    [/\b(?:tote|bag|crossbody)s?\b/, 'bag'],
    [/\bmugs?\b/, 'mug'],
    [/\bcushions?\b/, 'cushion'],
    [/\bscar(?:f|ves)\b/, 'scarf'],
  ] as const)
    if (pattern.test(q)) {
      filters.type = type;
      break;
    }
  if (/\bsummer\b/.test(q)) filters.season = 'summer';
  if (/\bcasual\b/.test(q)) filters.occasion = 'casual';
  return filters;
}
export function eligible(p: Product, f: Filters) {
  const value = price(p);
  return (
    p.status === 'active' &&
    (!f.category || p.category_id === f.category) &&
    (f.min === undefined || (value !== null && value >= f.min)) &&
    (f.max === undefined ||
      (value !== null && (f.maxExclusive ? value < f.max : value <= f.max))) &&
    (!f.excludeColor || !p.attributes.color?.includes(f.excludeColor)) &&
    (['color', 'material', 'type', 'season', 'occasion'] as const).every(
      (key) => !f[key] || p.attributes[key]?.includes(f[key]!),
    )
  );
}
const stop = new Set(
  'show me something for the a an with under below up to at most least than over above between and not without except rs inr'.split(
    ' ',
  ),
);
export function tokens(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t && !stop.has(t) && !/^\d+$/.test(t));
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function search(
  products: Product[],
  query: string,
  explicit: Filters = {},
  vectors?: Record<string, number[]>,
  queryVector?: number[],
) {
  const parsed = parseQuery(query);
  // Explicit controls may narrow an interpreted budget, never silently relax it.
  const filters: Filters = { ...parsed, ...explicit };
  if (parsed.max !== undefined && explicit.max !== undefined) {
    filters.max = Math.min(parsed.max, explicit.max);
    filters.maxExclusive = parsed.max <= explicit.max && parsed.maxExclusive;
  }
  const words = tokens(normalizeQuery(query));
  const candidates = products
    .filter((p) => eligible(p, filters))
    .map((p) => {
      const text = semanticText(p).toLowerCase();
      const lexical = words.reduce(
        (score, t) =>
          score + (text.includes(t) ? 1 : 0) + (p.name.toLowerCase().includes(t) ? 2 : 0),
        0,
      );
      const semantic =
        queryVector && vectors?.[p.product_id] ? cosine(queryVector, vectors[p.product_id]) : 0;
      return { p, lexical, semantic };
    });
  const lex = [...candidates].sort((a, b) => b.lexical - a.lexical);
  const sem = [...candidates].sort((a, b) => b.semantic - a.semantic);
  const ranked = candidates
    .filter((c) => !words.length || c.lexical > 0 || c.semantic >= 0.55)
    .map((c) => ({
      product: c.p,
      score: 1 / (60 + lex.indexOf(c) + 1) + (queryVector ? 1 / (60 + sem.indexOf(c) + 1) : 0),
    }))
    .sort((a, b) => b.score - a.score || a.product.product_id.localeCompare(b.product.product_id));
  return { filters, products: ranked.map((r) => r.product) };
}
