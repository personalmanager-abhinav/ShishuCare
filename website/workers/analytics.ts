import type { Env } from './types';
import { reportingWindow } from './reporting';
import { operationalHealth } from './health';
export async function dashboardData(env: Env, days: number) {
  const window = reportingWindow(days);
  const cutoff = window.start;
  const overview = await env.DB.prepare(
    `SELECT COUNT(DISTINCT visitor_id) visitors,COUNT(DISTINCT session_id) sessions,
 COALESCE(SUM(event_type='product_view'),0) product_views,COALESCE(SUM(event_type='search'),0) searches,COALESCE(SUM(event_type='marketplace_click'),0) marketplace_clicks FROM events WHERE occurred_at>=? AND occurred_at<=?`,
  )
    .bind(cutoff, window.end)
    .first();
  const products = await env.DB.prepare(
    `SELECT product_id,SUM(event_type='product_view') views,SUM(event_type='marketplace_click') clicks FROM events WHERE occurred_at>=? AND occurred_at<=? AND product_id IS NOT NULL GROUP BY product_id ORDER BY views DESC`,
  )
    .bind(cutoff, window.end)
    .all();
  const marketplaces = await env.DB.prepare(
    `SELECT marketplace_id,COUNT(*) clicks FROM events WHERE occurred_at>=? AND occurred_at<=? AND event_type='marketplace_click' GROUP BY marketplace_id ORDER BY clicks DESC`,
  )
    .bind(cutoff, window.end)
    .all();
  const searches = await env.DB.prepare(
    `SELECT json_extract(properties_json,'$.query') query,COUNT(*) searches,SUM(json_extract(properties_json,'$.result_count')=0) zero_results FROM events WHERE occurred_at>=? AND occurred_at<=? AND event_type='search' GROUP BY query ORDER BY searches DESC LIMIT 20`,
  )
    .bind(cutoff, window.end)
    .all();
  const funnel = await env.DB.prepare(
    `SELECT COUNT(*) viewed_sessions,COALESCE(SUM(clicked),0) clicked_sessions FROM (SELECT v.session_id,v.product_id,MAX(EXISTS(SELECT 1 FROM events c WHERE c.session_id=v.session_id AND c.product_id=v.product_id AND c.event_type='marketplace_click' AND c.occurred_at<=? AND c.occurred_at>=v.occurred_at AND julianday(c.occurred_at)<=julianday(v.occurred_at)+30.0/1440)) clicked FROM events v WHERE v.event_type='product_view' AND v.occurred_at>=? AND v.occurred_at<=? GROUP BY v.session_id,v.product_id)`,
  )
    .bind(window.end, cutoff, window.end)
    .first();
  const jobs = await env.DB.prepare('SELECT * FROM job_runs ORDER BY completed_at DESC').all();
  return {
    overview,
    products: products.results,
    marketplaces: marketplaces.results,
    searches: searches.results,
    funnel,
    jobs: jobs.results,
    health: await operationalHealth(env),
    days,
    as_of: window.end,
    timezone: window.timezone,
    window,
    notice:
      'Tracked browsers, not people. Marketplace clicks are not purchases. India calendar days include today so far.',
  };
}
