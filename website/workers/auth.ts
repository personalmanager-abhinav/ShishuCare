import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './types';
export async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export const local = (request: Request) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
export async function isAdmin(request: Request, env: Env) {
  if (
    env.ENVIRONMENT === 'development' &&
    local(request) &&
    env.LOCAL_ADMIN_TOKEN &&
    request.headers.get('Authorization') === `Bearer ${env.LOCAL_ADMIN_TOKEN}`
  )
    return true;
  if (
    !env.ACCESS_TEAM_DOMAIN ||
    !env.ACCESS_AUD ||
    !env.OWNER_EMAIL ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)
  )
    return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  try {
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    const { payload } = await jwtVerify(
      token,
      createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
      { issuer, audience: env.ACCESS_AUD },
    );
    return (
      typeof payload.email === 'string' &&
      payload.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()
    );
  } catch {
    return false;
  }
}
export async function visitor(request: Request, env: Env) {
  const token = request.headers
    .get('Cookie')
    ?.match(/(?:^|;\s*)catalogue_visitor=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  return env.DB.prepare('SELECT visitor_id FROM visitors WHERE credential_hash=? AND expires_at>?')
    .bind(await hash(token), new Date().toISOString())
    .first<{ visitor_id: string }>();
}
export async function limit(env: Env, key: string, max: number, expires: string) {
  const row = await env.DB.prepare(
    'INSERT INTO counters(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
  )
    .bind(key, expires)
    .first<{ count: number }>();
  return Boolean(row && row.count <= max);
}
