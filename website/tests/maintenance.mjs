import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const cli = 'node_modules/wrangler/bin/wrangler.js';
const run = (...args) =>
  execFileSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const old = new Date(Date.now() - 10 * 86400000).toISOString();
const day = old.slice(0, 10);
const kept = crypto.randomUUID(),
  removed = crypto.randomUUID();
await mkdir('work', { recursive: true });
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
let sql = '';
for (const visitor of [kept, removed]) {
  const values = [
    crypto.randomUUID(),
    'search',
    old,
    old,
    visitor,
    crypto.randomUUID(),
    crypto.randomUUID(),
    '/',
    'maintenance',
    JSON.stringify({
      query: 'sensitive text must not enter archives',
      result_count: 0,
      top_ids: [],
      fallback: true,
    }),
  ];
  sql += `INSERT INTO events(event_id,event_type,occurred_at,received_at,visitor_id,session_id,page_view_id,page_path,catalogue_version,properties_json) VALUES(${values.map(literal).join(',')});\n`;
}
sql += `DELETE FROM archive_manifest WHERE day=${literal(day)};\nINSERT INTO deletion_requests(visitor_id,requested_at) VALUES(${literal(removed)},${literal(new Date().toISOString())});`;
await writeFile('work/maintenance.sql', sql);
run('d1', 'execute', 'catalogue-analytics', '--local', '--file', 'work/maintenance.sql');
// Drain earlier local fixtures too; bounded loop verifies the actual target completion.
let completed = false;
for (let i = 0; i < 30; i++) {
  assert.equal((await fetch('http://127.0.0.1:8787/__scheduled')).status, 200);
  const status = JSON.parse(run('d1', 'execute', 'catalogue-analytics', '--local', '--json', '--command', `SELECT completed_at FROM deletion_requests WHERE visitor_id=${literal(removed)}`));
  if (status[0].results[0]?.completed_at) { completed = true; break; }
}
assert.ok(completed, 'Deletion job completes within the bounded maintenance drill');
run(
  'r2',
  'object',
  'get',
  `catalogue-private-events/raw/${day}.ndjson`,
  '--local',
  '--file',
  'work/archive-test.ndjson',
);
const raw = await readFile('work/archive-test.ndjson', 'utf8');
assert.ok(raw.includes(kept), 'Archive preserves accepted raw events');
assert.ok(!raw.includes(removed), 'Archive honors browser-history deletion');
assert.ok(!raw.includes('sensitive text'), 'Archive excludes search query text');
await writeFile(
  'work/maintenance-cleanup.sql',
  `DELETE FROM events WHERE visitor_id IN (${literal(kept)},${literal(removed)});DELETE FROM daily_metrics WHERE day=${literal(day)};DELETE FROM archive_manifest WHERE day=${literal(day)};DELETE FROM deletion_requests WHERE visitor_id=${literal(removed)};`,
);
run('d1', 'execute', 'catalogue-analytics', '--local', '--file', 'work/maintenance-cleanup.sql');
run('r2', 'object', 'delete', `catalogue-private-events/raw/${day}.ndjson`, '--local');
console.log(
  'Maintenance checks passed: verified raw export, query removal, archive history deletion.',
);
