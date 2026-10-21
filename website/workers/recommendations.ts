import { z } from 'zod';
import { hash, visitor } from './auth';
import { recommend, experimentVariant } from '../src/lib/recommendations';
import type { Product } from '../src/lib/product';
import config from '../data/discovery.json';
import catalogue from '../src/generated/catalogue.json';
import embeddings from '../data/embeddings.json';
import taxonomy from '../data/taxonomy.json';
import type { Env } from './types';

export const recommendationInput = z
  .object({
    product_id: z.string().regex(/^P\d+$/),
    analytics_consent: z.boolean().default(false),
    personalize: z.boolean().default(false),
    recent_ids: z
      .array(z.string().regex(/^P\d+$/))
      .max(8)
      .default([]),
    category: z
      .string()
      .refine((id) => taxonomy.some((c) => c.id === id))
      .optional(),
    max: z.number().int().min(0).max(100000000).optional(),
  })
  .strict();

export async function recommendations(
  request: Request,
  env: Env,
  input: z.infer<typeof recommendationInput>,
) {
  const products = catalogue.products as Product[];
  if (!products.some((p) => p.product_id === input.product_id)) return null;
  if (!config.enabled) return { items: [], request_id: null };
  let identity: { visitor_id: string } | null = null;
  let ranking: 'content' | 'hybrid' = 'content';
  let experimentId = 'none';
  let popularity: Record<string, number> = {};
  // D1 outages never block related-product discovery.
  try {
    if (input.analytics_consent) identity = await visitor(request, env);
    if (config.experiment.enabled && identity) {
      experimentId = config.experiment.id;
      ranking = experimentVariant(
        await hash(`${env.RATE_SALT || 'local'}:${experimentId}:${identity.visitor_id}`),
      );
    }
    if (ranking === 'hybrid') {
      const rows = await env.DB.prepare(
        "SELECT product_id,COUNT(DISTINCT visitor_id) browsers FROM events WHERE event_type='product_view' AND occurred_at>=? AND occurred_at<=? GROUP BY product_id HAVING COUNT(DISTINCT visitor_id)>=5",
      )
        .bind(new Date(Date.now() - 7 * 86400000).toISOString(), new Date().toISOString())
        .all<{ product_id: string; browsers: number }>();
      popularity = Object.fromEntries(rows.results.map((r) => [r.product_id, r.browsers]));
    }
  } catch {
    identity = null;
    ranking = 'content';
    experimentId = 'none';
  }
  const artifact = embeddings as {
    catalogue_version?: string;
    products: Record<string, { vector: number[] }>;
  };
  const vectors =
    artifact.catalogue_version === catalogue.version
      ? Object.fromEntries(Object.entries(artifact.products).map(([id, p]) => [id, p.vector]))
      : undefined;
  const items = recommend(products, input.product_id, {
    filters: { category: input.category, max: input.max },
    recentIds: input.personalize
      ? input.recent_ids.filter((id) => products.some((p) => p.product_id === id))
      : [],
    popularity,
    vectors,
    ranking,
  }).map((r) => ({ product_id: r.product.product_id, reason: r.reason }));
  let requestId: string | null = null;
  if (identity && items.length) {
    try {
      requestId = crypto.randomUUID();
      const result = await env.DB.prepare(
        'INSERT INTO recommendation_sets(id,visitor_id,source_product_id,model_version,experiment_id,variant,product_ids_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM deletion_requests WHERE visitor_id=?)',
      )
        .bind(
          requestId,
          identity.visitor_id,
          input.product_id,
          config.model_version,
          experimentId,
          ranking,
          JSON.stringify(items.map((i) => i.product_id)),
          new Date().toISOString(),
          identity.visitor_id,
        )
        .run();
      if (!result.meta.changes) requestId = null;
    } catch {
      requestId = null;
    }
  }
  return {
    items,
    request_id: requestId,
    model_version: config.model_version,
    experiment_id: experimentId,
    variant: ranking,
    catalogue_version: catalogue.version,
  };
}

export async function validRecommendationEvent(
  env: Env,
  visitorId: string,
  productId: string | undefined,
  properties: unknown,
) {
  const p = properties as {
    recommendation_id: string;
    position: number;
    model_version: string;
    experiment_id: string;
    variant: string;
  };
  const row = await env.DB.prepare(
    'SELECT product_ids_json,model_version,experiment_id,variant FROM recommendation_sets WHERE id=? AND visitor_id=? AND created_at>=?',
  )
    .bind(p.recommendation_id, visitorId, new Date(Date.now() - 3 * 86400000).toISOString())
    .first<{
      product_ids_json: string;
      model_version: string;
      experiment_id: string;
      variant: string;
    }>();
  return (
    !!row &&
    row.model_version === p.model_version &&
    row.experiment_id === p.experiment_id &&
    row.variant === p.variant &&
    JSON.parse(row.product_ids_json)[p.position - 1] === productId
  );
}
