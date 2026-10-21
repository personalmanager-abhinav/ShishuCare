import catalogue from '../src/generated/catalogue.json';
import { price, type Product } from '../src/lib/product';
import {
  BARGAIN_SESSION_MINUTES,
  bargainAcceptance,
  bargainWelcome,
  chooseDemoReply,
  isBargainLanguage,
  MAX_BARGAIN_ATTEMPTS,
  MAX_BARGAIN_MESSAGES,
  normalizeBargainMessage,
  parseRupeeOffer,
  safeAttemptsRemaining,
} from '../src/lib/bargain';
import type { Env } from './types';

const products = catalogue.products as Product[];
const json = (value: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });

interface SessionRow {
  session_id: string;
  browser_scope_hash: string;
  product_id: string;
  variant_id: string;
  marketplace_id: string;
  marketplace_offer_id: string;
  policy_id: string;
  policy_revision: number;
  attempts_used: number;
  status: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  preferred_language: 'hi' | 'hinglish' | 'en';
}

interface PolicyRow {
  policy_id: string;
  product_id: string;
  variant_id: string;
  marketplace_id: string;
  base_floor_minor: number;
  marketplace_floor_minor: number | null;
  enabled: number;
  revision: number;
  updated_at: string;
}

interface CampaignRow {
  campaign_id: string;
  marketplace_id: string;
  marketplace_offer_id: string;
  discount_kind: string;
  status: string;
  verified_at: string | null;
  valid_from: string;
  valid_until: string;
  terms_json: string;
}

interface TurnRow {
  text_redacted: string | null;
  extracted_buyer_offer_minor: number | null;
  quoted_seller_offer_minor: number | null;
  decision: string | null;
}

function cookie(request: Request, name: string) {
  const match = request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function scopeFor(request: Request, env: Env, create = false) {
  let token = cookie(request, 'shishu_bargain');
  let setCookie: string | null = null;
  if (!token && create) {
    token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    setCookie = `shishu_bargain=${token}; HttpOnly; SameSite=Strict; Path=/api/bargain/; Max-Age=86400${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  if (!token) return { hash: null, setCookie };
  return { hash: await digest(`${env.RATE_SALT || 'local-demo'}:${token}`), setCookie };
}

async function input(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return null;
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function productOffer(productId: string, marketplaceId: string, offerId: string) {
  const product = products.find((candidate) => candidate.product_id === productId);
  const offer = product?.offers.find(
    (candidate) => candidate.offer_id === offerId && candidate.marketplace_id === marketplaceId,
  );
  return product && offer ? { product, offer } : null;
}

async function configuration(
  env: Env,
  productId: string,
  variantId: string,
  marketplaceId: string,
  offerId: string,
) {
  const campaign = (await env.DB.prepare(
    `SELECT * FROM bargain_campaign
     WHERE marketplace_offer_id=? AND marketplace_id=? AND status='active'
       AND datetime(valid_from)<=datetime('now') AND datetime(valid_until)>datetime('now')`,
  )
    .bind(offerId, marketplaceId)
    .first()) as CampaignRow | null;
  const policy = (await env.DB.prepare(
    `SELECT * FROM bargain_policy
     WHERE product_id=? AND marketplace_id=? AND enabled=1 AND variant_id IN (?, '')
     ORDER BY CASE WHEN variant_id=? THEN 0 ELSE 1 END LIMIT 1`,
  )
    .bind(productId, marketplaceId, variantId, variantId)
    .first()) as PolicyRow | null;
  return { campaign, policy };
}

function state(
  session: SessionRow,
  assistantMessage?: string | null,
  sellerOfferMinor?: number | null,
) {
  return {
    sessionId: session.session_id,
    state: session.status,
    attemptsUsed: session.attempts_used,
    attemptsRemaining: safeAttemptsRemaining(session.attempts_used),
    language: session.preferred_language,
    expiresAt: session.expires_at,
    assistantMessage: assistantMessage || null,
    offer:
      sellerOfferMinor == null
        ? null
        : { amountMinor: sellerOfferMinor, currency: 'INR', redeemable: false, mode: 'demo' },
    coupon: null,
    demo: true,
  };
}

async function ownedSession(request: Request, env: Env, sessionId: string) {
  const session = (await env.DB.prepare('SELECT * FROM bargain_session WHERE session_id=?')
    .bind(sessionId)
    .first()) as SessionRow | null;
  const scope = await scopeFor(request, env);
  return session && scope.hash && session.browser_scope_hash === scope.hash ? session : null;
}

async function expireIfNeeded(env: Env, session: SessionRow) {
  if (session.status !== 'active' || Date.parse(session.expires_at) > Date.now()) return session;
  await env.DB.prepare("UPDATE bargain_session SET status='expired' WHERE session_id=?")
    .bind(session.session_id)
    .run();
  return { ...session, status: 'expired' };
}

async function eligibility(request: Request, env: Env) {
  if (env.BARGAIN_PUBLIC_ENABLED !== 'true' || env.BARGAIN_MODE !== 'demo')
    return json({ eligible: false, reason: 'Bargaining is currently unavailable.' });
  const body = await input(request);
  if (!body) return json({ error: 'Valid application/json body required' }, 400);
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const variantId = typeof body.variantId === 'string' ? body.variantId : '';
  const marketplaceId = typeof body.marketplaceId === 'string' ? body.marketplaceId : '';
  const offerId = typeof body.marketplaceOfferId === 'string' ? body.marketplaceOfferId : '';
  const match = productOffer(productId, marketplaceId, offerId);
  if (!match)
    return json({ eligible: false, reason: 'Product or marketplace offer was not found.' });
  if (variantId && !match.product.attributes.color?.includes(variantId))
    return json({ eligible: false, reason: 'The selected colour is not available.' });
  const { campaign, policy } = await configuration(
    env,
    productId,
    variantId,
    marketplaceId,
    offerId,
  );
  if (!campaign || !policy)
    return json({ eligible: false, reason: 'Bargaining is not configured for this choice.' });
  if (campaign.discount_kind === 'demo' && env.ENVIRONMENT === 'production')
    return json({ eligible: false, reason: 'Demo bargaining is disabled in production.' });
  return json({
    eligible: true,
    demo: campaign.discount_kind === 'demo',
    productId,
    variantId,
    marketplaceId,
    marketplaceOfferId: offerId,
    attempts: MAX_BARGAIN_ATTEMPTS,
  });
}

async function createSession(request: Request, env: Env) {
  if (env.BARGAIN_PUBLIC_ENABLED !== 'true' || env.BARGAIN_MODE !== 'demo')
    return json({ error: 'Bargaining is currently unavailable' }, 503);
  const body = await input(request);
  if (!body) return json({ error: 'Valid application/json body required' }, 400);
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const variantId = typeof body.variantId === 'string' ? body.variantId : '';
  const marketplaceId = typeof body.marketplaceId === 'string' ? body.marketplaceId : '';
  const offerId = typeof body.marketplaceOfferId === 'string' ? body.marketplaceOfferId : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  const language = body.language;
  if (!/^[\w-]{8,100}$/.test(idempotencyKey))
    return json({ error: 'Valid idempotencyKey required' }, 400);
  if (!isBargainLanguage(language))
    return json({ error: 'Language must be hi, hinglish, or en' }, 400);
  const match = productOffer(productId, marketplaceId, offerId);
  if (!match) return json({ error: 'Invalid product or marketplace offer' }, 400);
  const { campaign, policy } = await configuration(
    env,
    productId,
    variantId,
    marketplaceId,
    offerId,
  );
  if (!campaign || !policy)
    return json({ error: 'Bargaining is not configured for this choice' }, 400);
  if (campaign.discount_kind !== 'demo' || env.ENVIRONMENT === 'production')
    return json({ error: 'Only the private demo adapter is currently available' }, 409);

  const existingKey = (await env.DB.prepare(
    'SELECT session_id FROM bargain_session_idempotency WHERE idempotency_key=?',
  )
    .bind(idempotencyKey)
    .first()) as { session_id: string } | null;
  if (existingKey) {
    const existing = await ownedSession(request, env, existingKey.session_id);
    return existing ? json(state(existing)) : json({ error: 'Session not found' }, 404);
  }

  const browser = await scopeFor(request, env, true);
  const recent = (await env.DB.prepare(
    `SELECT * FROM bargain_session WHERE browser_scope_hash=? AND product_id=?
     AND datetime(created_at)>datetime('now','-1 day') ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(browser.hash, productId)
    .first()) as SessionRow | null;
  if (recent) {
    const current = await expireIfNeeded(env, recent);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO bargain_session_idempotency(idempotency_key,session_id,created_at) VALUES(?,?,?)',
    )
      .bind(idempotencyKey, recent.session_id, new Date().toISOString())
      .run();
    return json(
      state(current),
      200,
      browser.setCookie ? { 'Set-Cookie': browser.setCookie } : undefined,
    );
  }

  const now = new Date();
  const session: SessionRow = {
    session_id: `session_${crypto.randomUUID()}`,
    browser_scope_hash: browser.hash!,
    product_id: productId,
    variant_id: variantId,
    marketplace_id: marketplaceId,
    marketplace_offer_id: offerId,
    policy_id: policy.policy_id,
    policy_revision: policy.revision,
    attempts_used: 0,
    status: 'active',
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + BARGAIN_SESSION_MINUTES * 60_000).toISOString(),
    last_activity_at: now.toISOString(),
    preferred_language: language,
  };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO bargain_session
       (session_id,browser_scope_hash,product_id,variant_id,marketplace_id,marketplace_offer_id,policy_id,policy_revision,attempts_used,status,created_at,expires_at,last_activity_at,preferred_language)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(...Object.values(session)),
    env.DB.prepare(
      'INSERT INTO bargain_session_idempotency(idempotency_key,session_id,created_at) VALUES(?,?,?)',
    ).bind(idempotencyKey, session.session_id, now.toISOString()),
  ]);
  const welcome = bargainWelcome(language);
  return json(
    state(session, welcome),
    201,
    browser.setCookie ? { 'Set-Cookie': browser.setCookie } : undefined,
  );
}

async function getSession(request: Request, env: Env, sessionId: string) {
  const owned = await ownedSession(request, env, sessionId);
  const session = owned ? await expireIfNeeded(env, owned) : null;
  if (!session) return json({ error: 'Session not found' }, 404);
  const latest = (await env.DB.prepare(
    "SELECT text_redacted,quoted_seller_offer_minor,decision FROM bargain_turn WHERE session_id=? AND speaker='assistant' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(sessionId)
    .first()) as TurnRow | null;
  return json(state(session, latest?.text_redacted, latest?.quoted_seller_offer_minor));
}

async function message(request: Request, env: Env, sessionId: string) {
  const owned = await ownedSession(request, env, sessionId);
  const session = owned ? await expireIfNeeded(env, owned) : null;
  if (!session) return json({ error: 'Session not found' }, 404);
  if (session.status !== 'active')
    return json({ error: 'This bargaining session has ended', ...state(session) }, 409);
  const body = await input(request);
  const userMessage = normalizeBargainMessage(body?.message);
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!userMessage || !/^[\w-]{8,100}$/.test(idempotencyKey))
    return json(
      { error: 'A message up to 120 characters and valid idempotencyKey are required' },
      400,
    );

  const duplicate = (await env.DB.prepare(
    "SELECT text_redacted,quoted_seller_offer_minor,decision FROM bargain_turn WHERE session_id=? AND idempotency_key=? AND speaker='assistant'",
  )
    .bind(sessionId, `${idempotencyKey}:assistant`)
    .first()) as TurnRow | null;
  if (duplicate)
    return json(state(session, duplicate.text_redacted, duplicate.quoted_seller_offer_minor));

  const count = (await env.DB.prepare(
    "SELECT COUNT(*) count FROM bargain_turn WHERE session_id=? AND speaker='customer'",
  )
    .bind(sessionId)
    .first()) as { count: number };
  if (Number(count.count) >= MAX_BARGAIN_MESSAGES)
    return json({ error: 'The 10-message demo limit has been reached' }, 429);

  const buyerOfferMinor = parseRupeeOffer(userMessage);
  let attemptsUsed = session.attempts_used;
  let consumesAttempt = false;
  if (buyerOfferMinor !== null) {
    const repeated = await env.DB.prepare(
      "SELECT 1 found FROM bargain_turn WHERE session_id=? AND speaker='customer' AND extracted_buyer_offer_minor=? LIMIT 1",
    )
      .bind(sessionId, buyerOfferMinor)
      .first();
    consumesAttempt = !repeated && attemptsUsed < MAX_BARGAIN_ATTEMPTS;
    if (consumesAttempt) {
      const update = await env.DB.prepare(
        "UPDATE bargain_session SET attempts_used=attempts_used+1,last_activity_at=? WHERE session_id=? AND status='active' AND attempts_used=? AND attempts_used<3",
      )
        .bind(new Date().toISOString(), sessionId, attemptsUsed)
        .run();
      if (update.meta.changes !== 1)
        return json({ error: 'Offer changed in another tab; retry' }, 409);
      attemptsUsed += 1;
    }
  }

  const policy = (await env.DB.prepare('SELECT * FROM bargain_policy WHERE policy_id=?')
    .bind(session.policy_id)
    .first()) as PolicyRow | null;
  const match = products.find((candidate) => candidate.product_id === session.product_id);
  if (!policy || !match) return json({ error: 'Bargaining configuration is unavailable' }, 503);
  const latest = (await env.DB.prepare(
    "SELECT quoted_seller_offer_minor FROM bargain_turn WHERE session_id=? AND speaker='assistant' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(sessionId)
    .first()) as { quoted_seller_offer_minor: number | null } | null;
  const listPriceMinor = price(match);
  if (listPriceMinor == null) return json({ error: 'Product price is unavailable' }, 409);
  const floorMinor = Math.max(policy.base_floor_minor, policy.marketplace_floor_minor || 0);
  const reply = chooseDemoReply({
    buyerOfferMinor,
    listPriceMinor,
    floorMinor: Math.min(floorMinor, listPriceMinor),
    attemptsUsed,
    previousSellerOfferMinor: latest?.quoted_seller_offer_minor ?? null,
    language: session.preferred_language,
  });
  const newStatus =
    reply.decision === 'accepted_demo'
      ? 'accepted_demo'
      : reply.decision === 'declined'
        ? 'declined'
        : 'active';
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO bargain_turn(turn_id,session_id,idempotency_key,speaker,text_redacted,extracted_buyer_offer_minor,quoted_seller_offer_minor,decision,model_provider,model_id,prompt_version,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      `turn_${crypto.randomUUID()}`,
      sessionId,
      `${idempotencyKey}:customer`,
      'customer',
      '[redacted after processing]',
      buyerOfferMinor,
      null,
      consumesAttempt ? 'offer' : 'message',
      'none',
      'deterministic-demo',
      'bargain-v1',
      now,
    ),
    env.DB.prepare(
      `INSERT INTO bargain_turn(turn_id,session_id,idempotency_key,speaker,text_redacted,extracted_buyer_offer_minor,quoted_seller_offer_minor,decision,model_provider,model_id,prompt_version,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      `turn_${crypto.randomUUID()}`,
      sessionId,
      `${idempotencyKey}:assistant`,
      'assistant',
      reply.message,
      null,
      reply.sellerOfferMinor,
      reply.decision,
      'none',
      'deterministic-demo',
      'bargain-v1',
      new Date(Date.now() + 1).toISOString(),
    ),
    env.DB.prepare(
      'UPDATE bargain_session SET status=?,last_activity_at=? WHERE session_id=?',
    ).bind(newStatus, now, sessionId),
  ]);
  return json(
    state(
      { ...session, attempts_used: attemptsUsed, status: newStatus, last_activity_at: now },
      reply.message,
      reply.sellerOfferMinor,
    ),
  );
}

async function accept(request: Request, env: Env, sessionId: string) {
  const owned = await ownedSession(request, env, sessionId);
  const session = owned ? await expireIfNeeded(env, owned) : null;
  if (!session) return json({ error: 'Session not found' }, 404);
  if (session.status === 'accepted_demo') return json(state(session));
  if (session.status !== 'active') return json({ error: 'This bargaining session has ended' }, 409);
  const body = await input(request);
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!/^[\w-]{8,100}$/.test(idempotencyKey))
    return json({ error: 'Valid idempotencyKey required' }, 400);
  const latest = (await env.DB.prepare(
    "SELECT quoted_seller_offer_minor FROM bargain_turn WHERE session_id=? AND speaker='assistant' AND decision='counter' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(sessionId)
    .first()) as { quoted_seller_offer_minor: number | null } | null;
  if (!latest?.quoted_seller_offer_minor)
    return json({ error: 'There is no current demo offer to accept' }, 409);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO bargain_acceptance_idempotency(idempotency_key,session_id,created_at) VALUES(?,?,?)',
    ).bind(idempotencyKey, sessionId, now),
    env.DB.prepare(
      "UPDATE bargain_session SET status='accepted_demo',last_activity_at=? WHERE session_id=? AND status='active'",
    ).bind(now, sessionId),
  ]);
  const confirmation = bargainAcceptance(
    session.preferred_language,
    latest.quoted_seller_offer_minor,
  );
  return json(
    state({ ...session, status: 'accepted_demo' }, confirmation, latest.quoted_seller_offer_minor),
  );
}

async function deleteHistory(request: Request, env: Env) {
  const browser = await scopeFor(request, env);
  if (browser.hash) {
    const owned = 'SELECT session_id FROM bargain_session WHERE browser_scope_hash=?';
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM bargain_turn WHERE session_id IN (${owned})`).bind(browser.hash),
      env.DB.prepare(
        `DELETE FROM bargain_acceptance_idempotency WHERE session_id IN (${owned})`,
      ).bind(browser.hash),
      env.DB.prepare(`DELETE FROM bargain_session_idempotency WHERE session_id IN (${owned})`).bind(
        browser.hash,
      ),
      env.DB.prepare(`DELETE FROM bargain_session WHERE browser_scope_hash=?`).bind(browser.hash),
    ]);
  }
  return json({ deleted: Boolean(browser.hash) }, 200, {
    'Set-Cookie': `shishu_bargain=; HttpOnly; SameSite=Strict; Path=/api/bargain/; Max-Age=0${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
  });
}

export async function handleBargain(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === '/api/bargain/history' && request.method === 'DELETE')
    return deleteHistory(request, env);
  if (path === '/api/bargain/eligibility' && request.method === 'POST')
    return eligibility(request, env);
  if (path === '/api/bargain/sessions' && request.method === 'POST')
    return createSession(request, env);
  const match = path.match(/^\/api\/bargain\/sessions\/([^/]+)(?:\/(messages|accept))?$/);
  if (!match) return json({ error: 'Bargaining route not found' }, 404);
  const sessionId = decodeURIComponent(match[1]);
  if (!match[2] && request.method === 'GET') return getSession(request, env, sessionId);
  if (match[2] === 'messages' && request.method === 'POST') return message(request, env, sessionId);
  if (match[2] === 'accept' && request.method === 'POST') return accept(request, env, sessionId);
  return json({ error: 'Method not allowed' }, 405);
}

export async function handleBargainAdmin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'GET required' }, 405);
  const [policies, campaigns, sessions, summary] = await Promise.all([
    env.DB.prepare(
      'SELECT product_id,variant_id,marketplace_id,base_floor_minor,enabled,revision,updated_at FROM bargain_policy ORDER BY product_id,marketplace_id',
    ).all(),
    env.DB.prepare(
      'SELECT campaign_id,marketplace_id,marketplace_offer_id,discount_kind,status,verified_at,valid_until FROM bargain_campaign ORDER BY marketplace_offer_id',
    ).all(),
    env.DB.prepare(
      'SELECT session_id,product_id,variant_id,marketplace_id,attempts_used,status,created_at,expires_at FROM bargain_session ORDER BY created_at DESC LIMIT 100',
    ).all(),
    env.DB.prepare(
      `SELECT COUNT(*) sessions,
       COALESCE(SUM(status='accepted_demo'),0) demo_agreements,
       COALESCE(SUM(status='declined'),0) declined,
       COALESCE(AVG(attempts_used),0) average_attempts
       FROM bargain_session`,
    ).first(),
  ]);
  return json({
    demo: true,
    summary,
    policies: policies.results,
    campaigns: campaigns.results,
    sessions: sessions.results,
  });
}
