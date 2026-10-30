import { submitReview, publicReviews, moderationHtml } from './reviews';
import catalogue from '../src/generated/catalogue.json';
import embeddingArtifact from '../data/embeddings.json';
import taxonomy from '../data/taxonomy.json';
import { search, type Filters } from '../src/lib/search';
import type { Product } from '../src/lib/catalogue';
import { batchSchema } from '../src/lib/events';
import { hash, isAdmin, limit, local, visitor } from './auth';
import { dashboardData } from './analytics';
import { dashboardHtml } from './dashboard';
import { runJobs } from './jobs';
import type { Env } from './types';
import { QueryVectorCache } from './query-cache';
import { operationalHealth } from './health';
import { recommendationInput, recommendations, validRecommendationEvent } from './recommendations';
import { discoveryInsights, inventoryReport, importInventory } from './insights';
import { insightsHtml } from './insights-page';
import { handleBargain, handleBargainAdmin } from './bargain';
import { bargainDashboardHtml } from './bargain-page';
const queryCache = new QueryVectorCache();
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
const products = catalogue.products as Product[];
async function body(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    throw new Error('Use application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (
    path === '/internal/api/health' &&
    request.method === 'GET' &&
    env.MONITOR_TOKEN &&
    env.MONITOR_TOKEN.length >= 32 &&
    request.headers.get('Authorization') === `Bearer ${env.MONITOR_TOKEN}`
  ) {
    const health = await operationalHealth(env);
    return json(health, health.status === 'ok' ? 200 : 503);
  }
  if (path.startsWith('/internal')) {
    if (!(await isAdmin(request, env)))
      return json(
        {
          error:
            'Owner authentication required. Configure Cloudflare Access; local API access uses a development bearer token.',
        },
        401,
      );
    if (path === '/internal/reviews')
      return new Response(moderationHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'",
        },
      });
    if (path === '/internal/insights')
      return new Response(insightsHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'",
        },
      });
    if (path === '/internal/api/insights') {
      if (request.method !== 'GET') return json({ error: 'GET required' }, 405);
      return json(await discoveryInsights(env));
    }
    if (path === '/internal/api/inventory') {
      if (request.method === 'GET') return json(await inventoryReport(env));
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (request.headers.get('Origin') !== url.origin)
        return json({ error: 'Same-origin required' }, 403);
      const result = await importInventory(env, await body(request));
      return json(result, 'error' in result ? 400 : 200);
    }
    if (path === '/internal/api/reviews') {
      if (request.method === 'GET') {
        const status = url.searchParams.get('status') || 'pending';
        if (!['pending', 'approved', 'rejected'].includes(status))
          return json({ error: 'Invalid status' }, 400);
        const rows = await env.DB.prepare(
          'SELECT id,product_id,display_name,avatar,rating,review_text,created_at FROM product_reviews WHERE status=? ORDER BY created_at DESC LIMIT 100',
        )
          .bind(status)
          .all();
        return json({ reviews: rows.results });
      }
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (request.headers.get('Origin') !== url.origin)
        return json({ error: 'Same-origin required' }, 403);
      const input = await body(request);
      if (
        typeof input.id !== 'string' ||
        !['approved', 'rejected', 'delete'].includes(input.status)
      )
        return json({ error: 'Invalid review update' }, 400);
      if (input.status === 'delete')
        await env.DB.batch([
          env.DB.prepare(
            'INSERT OR IGNORE INTO review_deletions(review_id,deleted_at) SELECT id,? FROM product_reviews WHERE id=?',
          ).bind(new Date().toISOString(), input.id),
          env.DB.prepare('DELETE FROM product_reviews WHERE id=?').bind(input.id),
        ]);
      else
        await env.DB.prepare('UPDATE product_reviews SET status=? WHERE id=?')
          .bind(input.status, input.id)
          .run();
      return json({ ok: true });
    }
    if (path === '/internal/api/metrics') {
      const days = Number(url.searchParams.get('days') || 7);
      if (![7, 14, 30].includes(days)) return json({ error: 'Choose 7, 14, or 30 days' }, 400);
      return json(await dashboardData(env, days));
    }
    if (path === '/internal/api/health') {
      const health = await operationalHealth(env);
      return json(health, health.status === 'ok' ? 200 : 503);
    }
    if (path === '/internal/api/bargain') return handleBargainAdmin(request, env);
    if (path === '/internal/bargain' || path === '/internal/bargain/')
      return new Response(bargainDashboardHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'",
        },
      });
    if (path === '/internal/' || path === '/internal')
      return new Response(dashboardHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'",
        },
      });
    return json({ error: 'Not found' }, 404);
  }
  if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (path.startsWith('/api/bargain/')) {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      request.headers.get('Origin') !== url.origin
    )
      return json({ error: 'Same-origin request required' }, 403);
    if (env.ENVIRONMENT === 'development' && !local(request))
      return json({ error: 'Development configuration cannot serve public APIs' }, 503);
    if (env.ENVIRONMENT === 'production' && !env.RATE_SALT)
      return json({ error: 'Rate-limit secret not configured' }, 503);
    const bargainDay = new Date().toISOString().slice(0, 10);
    const bargainIp = await hash(
      `${env.RATE_SALT || 'local'}:${bargainDay}:${request.headers.get('CF-Connecting-IP') || 'local'}`,
    );
    if (
      !(await limit(
        env,
        `bargain:${bargainIp}:${Math.floor(Date.now() / 60000)}`,
        30,
        new Date(Date.now() + 86400000).toISOString(),
      ))
    )
      return json({ error: 'Too many bargaining requests; please wait a moment' }, 429);
    return handleBargain(request, env);
  }
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  if (request.headers.get('Origin') !== url.origin)
    return json({ error: 'Same-origin request required' }, 403);
  if (env.ENVIRONMENT === 'development' && !local(request))
    return json({ error: 'Development configuration cannot serve public APIs' }, 503);
  if (env.ENVIRONMENT === 'production' && !env.RATE_SALT)
    return json({ error: 'Rate-limit secret not configured' }, 503);
  const now = new Date(),
    day = now.toISOString().slice(0, 10);
  const ip = await hash(
    `${env.RATE_SALT || 'local'}:${day}:${request.headers.get('CF-Connecting-IP') || 'local'}`,
  );
  if (
    !(await limit(
      env,
      `rate:${ip}:${Math.floor(Date.now() / 60000)}`,
      60,
      new Date(Date.now() + 86400000).toISOString(),
    ))
  )
    return json({ error: 'Too many requests; try again shortly' }, 429);
  if (path === '/api/reviews/list')
    return json({
      reviews: await publicReviews(
        env,
        products.map((p) => p.product_id),
      ),
    });
  if (path === '/api/recommendations') {
    const input = recommendationInput.safeParse(await body(request));
    if (!input.success) return json({ error: 'Invalid recommendation request' }, 400);
    const result = await recommendations(request, env, input.data);
    return result ? json(result) : json({ error: 'Unknown product' }, 400);
  }
  if (path === '/api/reviews/submit') {
    const result = await submitReview(
      env,
      await body(request),
      ip,
      new Set(products.map((p) => p.product_id)),
    );
    return json(result.data, result.status);
  }
  if (path === '/api/reviews/withdraw') {
    const input = await body(request);
    if (typeof input.id !== 'string' || typeof input.token !== 'string' || input.token.length > 100)
      return json({ error: 'Invalid withdrawal' }, 400);
    const deletionHash = await hash(input.token);
    await env.DB.batch([
      env.DB.prepare(
        'INSERT OR IGNORE INTO review_deletions(review_id,deleted_at) SELECT id,? FROM product_reviews WHERE id=? AND deletion_hash=?',
      ).bind(new Date().toISOString(), input.id, deletionHash),
      env.DB.prepare('DELETE FROM product_reviews WHERE id=? AND deletion_hash=?').bind(
        input.id,
        deletionHash,
      ),
    ]);
    return json({ ok: true });
  }
  if (path === '/api/search') {
    const input = await body(request);
    if (!input || typeof input !== 'object' || typeof input.q !== 'string' || input.q.length > 200)
      return json({ error: 'Query must be at most 200 characters' }, 400);
    const filters: Filters = {};
    if (input.category) {
      if (!taxonomy.some((category) => category.id === input.category))
        return json({ error: 'Unknown category' }, 400);
      filters.category = input.category;
    }
    if (input.max !== undefined) {
      if (!Number.isInteger(input.max) || input.max < 0 || input.max > 100000000)
        return json({ error: 'Invalid price limit' }, 400);
      filters.max = input.max;
    }
    let vector: number[] | undefined;
    let fallback = true;
    const artifact = embeddingArtifact as {
      model: string;
      dimensions: number;
      catalogue_version?: string;
      products: Record<string, { vector: number[] }>;
    };
    const vectors = Object.fromEntries(
      Object.entries(artifact.products).map(([id, value]) => [id, value.vector]),
    );
    if (
      input.q.trim() &&
      env.SEMANTIC_ENABLED === 'true' &&
      artifact.catalogue_version === catalogue.version &&
      products.every((p) => vectors[p.product_id]?.length === artifact.dimensions)
    ) {
      const cacheKey = await hash(
        `${catalogue.version}:${artifact.model}:${input.q.trim().toLowerCase()}`,
      );
      vector = queryCache.get(cacheKey);
      if (vector) fallback = false;
      if (
        !vector &&
        (await limit(
          env,
          `embeddings:${day}`,
          Math.max(0, Number(env.DAILY_EMBEDDING_LIMIT) || 0),
          new Date(Date.now() + 172800000).toISOString(),
        ))
      ) {
        try {
          const result = (await Promise.race([
            env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [input.q] }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1200)),
          ])) as { data: number[][] };
          if (
            result.data?.[0]?.length === artifact.dimensions &&
            result.data[0].every(Number.isFinite)
          ) {
            vector = result.data[0];
            queryCache.set(cacheKey, vector);
            fallback = false;
          }
        } catch {
          /* Lexical search remains available. */
        }
      }
    }
    const results = search(products, input.q, filters, vectors, vector);
    return json({
      product_ids: results.products.map((p) => p.product_id),
      filters: results.filters,
      fallback,
      catalogue_version: catalogue.version,
      search_id: crypto.randomUUID(),
    });
  }
  if (path === '/api/identity') {
    const input = await body(request);
    if (input.consent !== true) return json({ error: 'Analytics consent required' }, 400);
    const existing = await visitor(request, env);
    if (existing) return json(existing);
    const id = crypto.randomUUID();
    const credential = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    await env.DB.prepare(
      'INSERT INTO visitors(visitor_id,credential_hash,expires_at) VALUES(?,?,?)',
    )
      .bind(id, await hash(credential), new Date(Date.now() + 90 * 86400000).toISOString())
      .run();
    const response = json({ visitor_id: id });
    response.headers.set(
      'Set-Cookie',
      `catalogue_visitor=${credential}; HttpOnly; SameSite=Strict; Path=/api/; Max-Age=7776000${url.protocol === 'https:' ? '; Secure' : ''}`,
    );
    return response;
  }
  const identity = await visitor(request, env);
  if (!identity) return json({ error: 'No analytics identity' }, 401);
  if (path === '/api/delete-history') {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT OR IGNORE INTO deletion_requests(visitor_id,requested_at) VALUES(?,?)',
      ).bind(identity.visitor_id, now.toISOString()),
      env.DB.prepare('DELETE FROM events WHERE visitor_id=?').bind(identity.visitor_id),
      env.DB.prepare('DELETE FROM visitors WHERE visitor_id=?').bind(identity.visitor_id),
      env.DB.prepare('DELETE FROM recommendation_sets WHERE visitor_id=?').bind(
        identity.visitor_id,
      ),
    ]);
    const response = json(
      {
        status: 'queued',
        message:
          'Recent history deleted. Archived history will be removed by scheduled maintenance, normally within 24 hours.',
      },
      202,
    );
    response.headers.set(
      'Set-Cookie',
      'catalogue_visitor=; HttpOnly; SameSite=Strict; Path=/api/; Max-Age=0',
    );
    return response;
  }
  if (path === '/api/events') {
    const result = batchSchema.safeParse(await body(request));
    if (!result.success) return json({ error: 'Invalid event batch' }, 400);
    const tombstone = await env.DB.prepare(
      'SELECT visitor_id FROM deletion_requests WHERE visitor_id=?',
    )
      .bind(identity.visitor_id)
      .first();
    if (tombstone) return json({ error: 'Identity revoked' }, 401);
    const statements = [];
    for (const event of result.data.events) {
      const time = Date.parse(event.occurred_at);
      if (time > Date.now() + 300000 || time < Date.now() - 3 * 86400000)
        return json({ error: 'Event timestamp outside accepted window' }, 400);
      const product = products.find((p) => p.product_id === event.product_id);
      if (event.product_id && !product) return json({ error: 'Unknown product' }, 400);
      if (
        event.event_type.startsWith('recommendation_') &&
        (!product ||
          !(await validRecommendationEvent(
            env,
            identity.visitor_id,
            event.product_id,
            event.properties,
          )))
      )
        return json({ error: 'Invalid recommendation context' }, 400);
      if (
        [
          'product_view',
          'search_result_click',
          'marketplace_click',
          'marketplace_button_impression',
        ].includes(event.event_type) &&
        !product
      )
        return json({ error: 'Product required' }, 400);
      if (
        (event.event_type.startsWith('bargain_') || event.event_type === 'buyer_offer_submitted') &&
        !product
      )
        return json({ error: 'Product required' }, 400);
      if (['search', 'search_result_click'].includes(event.event_type) && !event.search_id)
        return json({ error: 'Search context required' }, 400);
      if (event.event_type.startsWith('marketplace_')) {
        const offer = product?.offers.find(
          (o) =>
            o.offer_id === (event.properties as { offer_id: string }).offer_id &&
            o.marketplace_id === event.marketplace_id,
        );
        if (!offer?.url || offer.availability === 'unavailable')
          return json({ error: 'Offer unavailable' }, 400);
      }
      statements.push(
        env.DB.prepare(
          'INSERT OR IGNORE INTO events(event_id,event_type,occurred_at,received_at,visitor_id,session_id,page_view_id,page_path,product_id,marketplace_id,search_id,catalogue_version,properties_json) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM visitors WHERE visitor_id=?) AND NOT EXISTS (SELECT 1 FROM deletion_requests WHERE visitor_id=?)',
        ).bind(
          event.event_id,
          event.event_type,
          event.occurred_at,
          now.toISOString(),
          identity.visitor_id,
          event.session_id,
          event.page_view_id,
          event.page_path,
          event.product_id || null,
          event.marketplace_id || null,
          event.search_id || null,
          event.catalogue_version,
          JSON.stringify(event.properties),
          identity.visitor_id,
          identity.visitor_id,
        ),
      );
    }
    await env.DB.batch(statements);
    return json({ accepted: statements.length });
  }
  return json({ error: 'Not found' }, 404);
}
export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handle(request, env);
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error &&
          ['Use application/json', 'Missing body', 'Body too large'].includes(error.message))
      )
        return json({ error: 'Invalid request body' }, 400);
      return json({ error: 'Service temporarily unavailable' }, 503);
    }
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runJobs(env));
  },
};
