export {};
const endpoint = new URL(process.argv[2] || 'http://127.0.0.1:8787');
if (
  endpoint.protocol !== 'https:' &&
  !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
)
  throw new Error('Remote monitoring requires HTTPS');
const token = process.env.MONITOR_TOKEN || process.env.LOCAL_ADMIN_TOKEN;
if (!token) throw new Error('Set MONITOR_TOKEN (or LOCAL_ADMIN_TOKEN for local checks)');
const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
}
try {
  const response = await fetch(new URL('/internal/api/health', endpoint), {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (![200, 503].includes(response.status))
    throw new Error(`Health endpoint returned HTTP ${response.status}`);
  const health = await response.json();
  if (!['ok', 'attention'].includes(health.status)) throw new Error('Unexpected health response');
  console.log(
    JSON.stringify({
      status: health.status,
      warnings: health.warnings,
      checked_at: new Date().toISOString(),
    }),
  );
  if (!response.ok || health.status !== 'ok') process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Health check failed');
  process.exitCode = 1;
}
