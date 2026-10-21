import type { Env } from './types';
import catalogue from '../src/generated/catalogue.json';
import {
  inventoryImport,
  inventoryOutlook,
  type InventoryRow,
  type SalesRow,
} from '../src/lib/inventory';
import config from '../data/discovery.json';

export async function discoveryInsights(env: Env) {
  const now = new Date().toISOString(),
    current = new Date(Date.now() - 7 * 86400000).toISOString(),
    previous = new Date(Date.now() - 14 * 86400000).toISOString();
  const rows = await env.DB.prepare(
    `SELECT product_id,
    COUNT(DISTINCT CASE WHEN occurred_at>=? AND event_type='product_view' THEN session_id END) current_sessions,
    COUNT(DISTINCT CASE WHEN occurred_at<? AND event_type='product_view' THEN session_id END) previous_sessions,
    COUNT(DISTINCT CASE WHEN occurred_at>=? AND event_type='product_view' THEN visitor_id END) browsers,
    SUM(event_type='marketplace_click' AND occurred_at>=?) clicks
    FROM events WHERE occurred_at>=? AND occurred_at<=? AND product_id IS NOT NULL GROUP BY product_id`,
  )
    .bind(current, current, current, current, previous, now)
    .all<{
      product_id: string;
      current_sessions: number;
      previous_sessions: number;
      browsers: number;
      clicks: number;
    }>();
  const totals = await env.DB.prepare(
    'SELECT COUNT(DISTINCT CASE WHEN occurred_at>=? THEN session_id END) current_sessions,COUNT(DISTINCT CASE WHEN occurred_at<? THEN session_id END) previous_sessions FROM events WHERE occurred_at>=? AND occurred_at<=?',
  )
    .bind(current, current, previous, now)
    .first<{ current_sessions: number; previous_sessions: number }>();
  const trends = rows.results
    .filter((row) => catalogue.products.some((p) => p.product_id === row.product_id))
    .map((row) => {
      const rate = totals?.current_sessions ? row.current_sessions / totals.current_sessions : null;
      const prior = totals?.previous_sessions
        ? row.previous_sessions / totals.previous_sessions
        : null;
      return {
        ...row,
        name: catalogue.products.find((p) => p.product_id === row.product_id)!.name,
        interest_per_100_sessions: rate === null ? null : rate * 100,
        change_percentage_points:
          row.browsers >= 10 && row.previous_sessions >= 10 && rate !== null && prior !== null
            ? (rate - prior) * 100
            : null,
        support:
          row.browsers >= 10 && row.previous_sessions >= 10 ? 'descriptive' : 'insufficient_data',
      };
    });
  const experiments = await env.DB.prepare(
    `WITH exposures AS (
    SELECT visitor_id,product_id,json_extract(properties_json,'$.recommendation_id') request_id,
      json_extract(properties_json,'$.experiment_id') experiment_id,json_extract(properties_json,'$.variant') variant,
      json_extract(properties_json,'$.model_version') model_version,MIN(occurred_at) first_seen
    FROM events WHERE event_type='recommendation_impression' AND occurred_at>=? AND occurred_at<=?
    GROUP BY visitor_id,product_id,request_id,experiment_id,variant,model_version
  ) SELECT experiment_id,variant,model_version,COUNT(*) impressions,COUNT(DISTINCT visitor_id) browsers,
    SUM(EXISTS(SELECT 1 FROM events c WHERE c.event_type='recommendation_click' AND c.visitor_id=e.visitor_id AND c.product_id=e.product_id
      AND json_extract(c.properties_json,'$.recommendation_id')=e.request_id AND c.occurred_at>=e.first_seen AND c.occurred_at<=?
      AND julianday(c.occurred_at)<=julianday(e.first_seen)+30.0/1440)) clicked_impressions
    FROM exposures e GROUP BY experiment_id,variant,model_version`,
  )
    .bind(new Date(Date.now() - 30 * 86400000).toISOString(), now, now)
    .all();
  return {
    trends,
    experiments: experiments.results,
    experiment_enabled: config.experiment.enabled,
    totals,
    as_of: now,
    notice:
      'Rolling 7-day website interest versus the preceding 7 days; consenting browsers only. Changes are descriptive, not demand forecasts. Recommendation click rates use visible request/product pairs and a 30-minute window; no winner or causal claim is inferred.',
  };
}

export async function importInventory(env: Env, input: unknown) {
  const parsed = inventoryImport.safeParse(input);
  if (!parsed.success)
    return {
      error: 'Invalid inventory import. Check required fields, duplicate rows and SKU mapping.',
    };
  const data = parsed.data;
  data.observed_at = new Date(data.observed_at).toISOString();
  const observedDay = new Date(Date.parse(data.observed_at) + 19800000).toISOString().slice(0, 10);
  if (
    Date.parse(data.observed_at) > Date.now() + 300000 ||
    data.sales.some((s) => s.day > observedDay)
  )
    return { error: 'Import contains future dates' };
  for (const sku of data.skus) {
    const product = catalogue.products.find((p) => p.product_id === sku.product_id);
    if (!product || !product.attributes.color.includes(sku.variant))
      return { error: 'Unknown product or variant' };
    const old = await env.DB.prepare(
      'SELECT product_id,variant,observed_at FROM inventory_skus WHERE sku=?',
    )
      .bind(sku.sku)
      .first<{ product_id: string; variant: string; observed_at: string }>();
    if (old && (old.product_id !== sku.product_id || old.variant !== sku.variant))
      return { error: 'Existing SKU mapping cannot be reassigned' };
    if (old && old.observed_at > data.observed_at)
      return { error: 'Stock snapshot is older than the stored snapshot' };
  }
  const statements = data.skus.map((s) =>
    env.DB.prepare(
      'INSERT INTO inventory_skus(sku,product_id,variant,stock_on_hand,lead_days,safety_days,observed_at,source) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET stock_on_hand=excluded.stock_on_hand,lead_days=excluded.lead_days,safety_days=excluded.safety_days,observed_at=excluded.observed_at,source=excluded.source WHERE inventory_skus.product_id=excluded.product_id AND inventory_skus.variant=excluded.variant AND inventory_skus.observed_at<=excluded.observed_at',
    ).bind(
      s.sku,
      s.product_id,
      s.variant,
      s.stock_on_hand,
      s.lead_days,
      s.safety_days,
      data.observed_at,
      data.source,
    ),
  );
  for (const s of data.sales)
    statements.push(
      env.DB.prepare(
        'INSERT INTO sales_daily(sku,day,units_sold,units_returned,source,imported_at) VALUES(?,?,?,?,?,?) ON CONFLICT(sku,day) DO UPDATE SET units_sold=excluded.units_sold,units_returned=excluded.units_returned,source=excluded.source,imported_at=excluded.imported_at WHERE sales_daily.imported_at<=excluded.imported_at',
      ).bind(s.sku, s.day, s.units_sold, s.units_returned, data.source, data.observed_at),
    );
  await env.DB.batch(statements);
  return { ok: true, skus: data.skus.length, sales_days: data.sales.length };
}
export async function inventoryReport(env: Env) {
  const skus = await env.DB.prepare(
    'SELECT * FROM inventory_skus ORDER BY sku',
  ).all<InventoryRow>();
  const sales = await env.DB.prepare('SELECT * FROM sales_daily WHERE day>=?')
    .bind(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    .all<SalesRow>();
  return {
    items: skus.results.map((s) => inventoryOutlook(s, sales.results)),
    notice:
      'Planning baseline from actual imported gross sales, not website clicks. Requires all 28 completed India calendar days (including explicit zero-sale days) and stock updated within 24 hours. Returns are reported separately because sellable return stock is unknown. No purchase orders are created.',
  };
}
