import worker from './public';
import type { Env } from './types';
// Production public deployment: owner routes are unavailable on this hostname.
export default {
  fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname.startsWith('/internal'))
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return worker.fetch(request, env);
  },
};
