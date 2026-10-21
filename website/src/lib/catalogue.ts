import { z } from 'zod';
import marketplaces from '../../data/marketplaces.json';
import taxonomy from '../../data/taxonomy.json';

export const offerSchema = z
  .object({
    offer_id: z.string().regex(/^[a-zA-Z0-9-]+$/),
    marketplace_id: z.string().refine((id) => marketplaces.some((m) => m.id === id)),
    url: z.url().nullable(),
    price_minor: z.number().int().nonnegative().nullable(),
    currency: z.literal('INR'),
    availability: z.enum(['available', 'unavailable', 'unknown']),
    last_verified_at: z.iso.datetime().nullable(),
  })
  .strict()
  .superRefine((offer, ctx) => {
    if (!offer.url) return;
    const url = new URL(offer.url);
    const market = marketplaces.find((m) => m.id === offer.marketplace_id);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !market?.hosts.includes(url.hostname)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Offer must use an approved HTTPS marketplace host',
      });
  });
export const productSchema = z
  .object({
    schema_version: z.literal(1),
    product_id: z.string().regex(/^P[0-9]+$/),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(2000),
    category_id: z.string().refine((id) => taxonomy.some((t) => t.id === id)),
    status: z.enum(['active', 'draft', 'archived']),
    demo: z.boolean(),
    images: z.array(
      z
        .object({ src: z.string().regex(/^\/images\/[a-zA-Z0-9_.-]+$/), alt: z.string().min(5) })
        .strict(),
    ),
    illustration_fallback: z.boolean().optional(),
    colour_variants: z
      .array(
        z
          .object({
            colour: z.string().min(1),
            photos: z.array(
              z
                .object({
                  src: z.string().regex(/^\/images\/[a-zA-Z0-9_.-]+$/),
                  alt: z.string().min(5),
                })
                .strict(),
            ),
            illustration: z
              .object({
                src: z.string().regex(/^\/images\/[a-zA-Z0-9_.-]+$/),
                alt: z.string().min(5),
              })
              .strict(),
          })
          .strict(),
      )
      .optional(),
    video: z
      .object({ src: z.string().regex(/^\/videos\/[a-zA-Z0-9_-]+\.(mp4|webm)$/) })
      .strict()
      .optional(),
    parent_note: z.object({
      excerpt: z.string().min(5).max(90),
      attribution: z.string().min(2).max(40),
    }).strict().optional(),
    attributes: z.record(z.string(), z.array(z.string())),
    tags: z.array(z.string()),
    offers: z.array(offerSchema).min(1),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .strict();
export type Product = z.infer<typeof productSchema>;
export function validateCatalogue(input: unknown[]): Product[] {
  const products = input.map((p) => productSchema.parse(p));
  for (const field of ['product_id', 'slug'] as const) {
    if (new Set(products.map((p) => p[field])).size !== products.length)
      throw new Error(`Duplicate ${field}`);
  }
  const offers = products.flatMap((p) => p.offers.map((o) => o.offer_id));
  if (new Set(offers).size !== offers.length) throw new Error('Duplicate offer_id');
  return products;
}
export { price, money, semanticText } from './product';
