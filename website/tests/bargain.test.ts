import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { chooseDemoReply, normalizeBargainMessage, parseRupeeOffer } from '../src/lib/bargain';
import { handleBargain } from '../workers/bargain';
import type { Env } from '../workers/types';

const migrations = ['0004_bargain.sql', '0005_bargain_hardening.sql', '0007_bargain_language.sql']
  .map((name) => readFileSync(`db/migrations/${name}`, 'utf8'))
  .join('\n');

function environment(environment = 'development') {
  const db = new DatabaseSync(':memory:');
  db.exec(migrations);
  const prepare = (sql: string, args: (string | number | null)[] = []): any => ({
    bind: (...values: (string | number | null)[]) => prepare(sql, values),
    all: async () => ({ results: db.prepare(sql).all(...args), success: true }),
    first: async () => db.prepare(sql).get(...args) || null,
    run: async () => ({ meta: db.prepare(sql).run(...args), success: true }),
  });
  const env = {
    ENVIRONMENT: environment,
    RATE_SALT: 'test-salt',
    BARGAIN_MODE: 'demo',
    BARGAIN_PUBLIC_ENABLED: 'true',
    DB: {
      prepare,
      batch: async (statements: any[]) => {
        db.exec('BEGIN');
        try {
          const result = [];
          for (const statement of statements) result.push(await statement.run());
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
    },
  } as unknown as Env;
  return { db, env };
}

function post(path: string, body: object, cookie?: string) {
  return new Request(`https://shop.example${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://shop.example',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function start(env: Env, language: 'hi' | 'hinglish' | 'en' = 'hi') {
  const payload = {
    productId: 'P101',
    variantId: 'blue',
    marketplaceId: 'amazon',
    marketplaceOfferId: 'P101-amazon',
    language,
    idempotencyKey: crypto.randomUUID(),
  };
  const response = await handleBargain(post('/api/bargain/sessions', payload), env);
  const cookie = response.headers.get('Set-Cookie')!.split(';')[0];
  return { response, cookie, body: (await response.json()) as any };
}

test('Offer parser is conservative and supports rupee, comma, and Devanagari digits', () => {
  assert.equal(parseRupeeOffer('₹150'), 15000);
  assert.equal(parseRupeeOffer('१५० में दे दो'), 15000);
  assert.equal(parseRupeeOffer('Rs. 1,500 please'), 150000);
  assert.equal(parseRupeeOffer('थोड़ा कम'), null);
  assert.equal(parseRupeeOffer('150 या 160'), null);
  assert.equal(normalizeBargainMessage('  hello   there  '), 'hello there');
  assert.equal(normalizeBargainMessage('x'.repeat(121)), null);
});

test('Policy responses never quote below the owner floor', () => {
  let previous: number | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const reply = chooseDemoReply({
      buyerOfferMinor: 1000,
      listPriceMinor: 10000,
      floorMinor: 8000,
      attemptsUsed: attempt,
      previousSellerOfferMinor: previous,
      language: 'hi',
    });
    if (reply.sellerOfferMinor !== null) assert.ok(reply.sellerOfferMinor >= 8000);
    previous = reply.sellerOfferMinor;
  }
});

test('Demo API persists a browser-owned session and makes retries idempotent', async () => {
  const { db, env } = environment();
  try {
    const eligibility = await handleBargain(
      post('/api/bargain/eligibility', {
        productId: 'P101',
        variantId: 'blue',
        marketplaceId: 'amazon',
        marketplaceOfferId: 'P101-amazon',
      }),
      env,
    );
    assert.equal(((await eligibility.json()) as any).eligible, true);
    const session = await start(env);
    assert.equal(session.response.status, 201);
    assert.equal(session.body.attemptsRemaining, 3);
    assert.equal(
      (
        await handleBargain(
          new Request(`https://shop.example/api/bargain/sessions/${session.body.sessionId}`),
          env,
        )
      ).status,
      404,
      'A session is not readable without its opaque browser cookie',
    );

    const key = crypto.randomUUID();
    const send = () =>
      handleBargain(
        post(
          `/api/bargain/sessions/${session.body.sessionId}/messages`,
          { message: '₹50 में?', idempotencyKey: key },
          session.cookie,
        ),
        env,
      );
    const first = (await (await send()).json()) as any;
    const retry = (await (await send()).json()) as any;
    assert.equal(first.attemptsUsed, 1);
    assert.equal(retry.attemptsUsed, 1);
    assert.equal(first.offer.amountMinor, retry.offer.amountMinor);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM bargain_turn').get()!.count, 2);
    const deletion = await handleBargain(
      new Request('https://shop.example/api/bargain/history', {
        method: 'DELETE',
        headers: { Origin: 'https://shop.example', Cookie: session.cookie },
      }),
      env,
    );
    assert.equal(deletion.status, 200);
    assert.match(deletion.headers.get('Set-Cookie') || '', /Max-Age=0/);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM bargain_session').get()!.count, 0);
  } finally {
    db.close();
  }
});

test('Conversation language is validated, persisted, and used for replies', async () => {
  const { db, env } = environment();
  try {
    const session = await start(env, 'en');
    assert.equal(session.body.language, 'en');
    assert.match(session.body.assistantMessage, /Hello!/);
    const result = (await (
      await handleBargain(
        post(
          `/api/bargain/sessions/${session.body.sessionId}/messages`,
          { message: '₹50', idempotencyKey: crypto.randomUUID() },
          session.cookie,
        ),
        env,
      )
    ).json()) as any;
    assert.equal(result.language, 'en');
    assert.match(result.assistantMessage, /demo/i);
    assert.equal(
      db.prepare('SELECT preferred_language FROM bargain_session').get()!.preferred_language,
      'en',
    );
  } finally {
    db.close();
  }
});

test('Unclear and repeated offers do not consume attempts; acceptance remains demo-only', async () => {
  const { db, env } = environment();
  try {
    const session = await start(env);
    const send = async (message: string) =>
      (await (
        await handleBargain(
          post(
            `/api/bargain/sessions/${session.body.sessionId}/messages`,
            { message, idempotencyKey: crypto.randomUUID() },
            session.cookie,
          ),
          env,
        )
      ).json()) as any;
    assert.equal((await send('थोड़ा कम')).attemptsUsed, 0);
    assert.equal((await send('₹50')).attemptsUsed, 1);
    assert.equal((await send('फिर ₹50')).attemptsUsed, 1);
    const accepted = (await (
      await handleBargain(
        post(
          `/api/bargain/sessions/${session.body.sessionId}/accept`,
          { idempotencyKey: crypto.randomUUID() },
          session.cookie,
        ),
        env,
      )
    ).json()) as any;
    assert.equal(accepted.state, 'accepted_demo');
    assert.equal(accepted.coupon, null);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM bargain_coupon').get()!.count, 0);
  } finally {
    db.close();
  }
});

test('Demo campaigns can never become eligible in production', async () => {
  const { db, env } = environment('production');
  try {
    const response = await handleBargain(
      post('/api/bargain/eligibility', {
        productId: 'P101',
        variantId: 'blue',
        marketplaceId: 'amazon',
        marketplaceOfferId: 'P101-amazon',
      }),
      env,
    );
    assert.equal(((await response.json()) as any).eligible, false);
  } finally {
    db.close();
  }
});
