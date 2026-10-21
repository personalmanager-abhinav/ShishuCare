import type { Env } from './types';
type Row = {
  event_id: string;
  visitor_id: string;
  properties_json: string;
  [key: string]: unknown;
};
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
async function processDeletions(env: Env) {
  const pending = await env.DB.prepare(
    'SELECT visitor_id,cursor FROM deletion_requests WHERE completed_at IS NULL LIMIT 5',
  ).all<{ visitor_id: string; cursor: string | null }>();
  for (const deletion of pending.results) {
    const objects = await env.ARCHIVE.list({
      prefix: 'raw/',
      limit: 30,
      ...(deletion.cursor ? { cursor: deletion.cursor } : {}),
    });
    for (const object of objects.objects) {
      const value = await env.ARCHIVE.get(object.key);
      if (!value) continue;
      const lines = (await value.text()).split('\n').filter(Boolean);
      const kept = lines.filter(
        (line) => (JSON.parse(line) as Row).visitor_id !== deletion.visitor_id,
      );
      if (kept.length !== lines.length)
        await env.ARCHIVE.put(object.key, kept.join('\n'), {
          httpMetadata: { contentType: 'application/x-ndjson' },
        });
    }
    await env.DB.prepare('UPDATE deletion_requests SET cursor=?,completed_at=? WHERE visitor_id=?')
      .bind(
        objects.truncated ? objects.cursor : null,
        objects.truncated ? null : new Date().toISOString(),
        deletion.visitor_id,
      )
      .run();
  }
}
export async function runJobs(env: Env) {
  // Export partitions older than the 3-day late-arrival window before hot-data cleanup.
  const days = await env.DB.prepare(
    'SELECT DISTINCT substr(received_at,1,10) day FROM events WHERE received_at<? AND substr(received_at,1,10) NOT IN (SELECT day FROM archive_manifest) ORDER BY day LIMIT 4',
  )
    .bind(ago(4).slice(0, 10))
    .all<{ day: string }>();
  for (const { day } of days.results) {
    const rows = await env.DB.prepare(
      'SELECT * FROM events WHERE received_at>=? AND received_at<? ORDER BY event_id',
    )
      .bind(day, new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10))
      .all<Row>();
    const lines = rows.results.map((row) => {
      const properties = JSON.parse(row.properties_json);
      delete properties.query;
      return JSON.stringify({ ...row, properties_json: JSON.stringify(properties) });
    });
    const key = `raw/${day}.ndjson`;
    await env.ARCHIVE.put(key, lines.join('\n'), {
      httpMetadata: { contentType: 'application/x-ndjson' },
    });
    const verify = await env.ARCHIVE.get(key);
    if (!verify || (await verify.text()) !== lines.join('\n'))
      throw new Error('Archive verification failed');
    await env.DB.prepare(
      'INSERT OR REPLACE INTO archive_manifest(day,exported_at,event_count) VALUES(?,?,?)',
    )
      .bind(day, new Date().toISOString(), lines.length)
      .run();
  }
  await processDeletions(env);
  const old = await env.ARCHIVE.list({ prefix: 'raw/', limit: 1000 });
  for (const item of old.objects)
    if (item.key.slice(4, 14) < ago(180).slice(0, 10)) await env.ARCHIVE.delete(item.key);
  // Rebuild hot-window counts in one transaction; longer-term aggregates remain intact.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM daily_metrics WHERE day>=?').bind(ago(30).slice(0, 10)),
    env.DB.prepare(
      "INSERT OR REPLACE INTO daily_metrics(day,event_type,product_id,marketplace_id,count) SELECT substr(occurred_at,1,10),event_type,COALESCE(product_id,''),COALESCE(marketplace_id,''),COUNT(*) FROM events WHERE occurred_at>=? GROUP BY 1,2,3,4",
    ).bind(ago(30).slice(0, 10)),
    env.DB.prepare(
      'DELETE FROM events WHERE received_at<? AND substr(received_at,1,10) IN (SELECT day FROM archive_manifest)',
    ).bind(ago(30)),
    env.DB.prepare('DELETE FROM visitors WHERE expires_at<?').bind(ago(0)),
    env.DB.prepare('DELETE FROM counters WHERE expires_at<?').bind(ago(0)),
    env.DB.prepare(
      'DELETE FROM recommendation_sets WHERE created_at<? OR visitor_id IN (SELECT visitor_id FROM deletion_requests)',
    ).bind(ago(3)),
    env.DB.prepare('DELETE FROM daily_metrics WHERE day<?').bind(ago(730).slice(0, 10)),
    env.DB.prepare(
      "INSERT OR REPLACE INTO job_runs(name,completed_at,details) VALUES('maintenance',?,'Archive verified; retention and deletion processed')",
    ).bind(ago(0)),
  ]);
}
