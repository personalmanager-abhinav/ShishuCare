import worker from './public';
import type { Env } from './types';
// Production owner deployment: authenticated reports and scheduled maintenance only.
export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.redirect(new URL('/internal/', url).href, 302);
    if (url.pathname.startsWith('/fonts/') && ['GET', 'HEAD'].includes(request.method))
      return env.ASSETS.fetch(request);
    if (!url.pathname.startsWith('/internal')) return new Response('Not found', { status: 404 });
    return worker.fetch(request, env);
  },
  scheduled: worker.scheduled,
};
