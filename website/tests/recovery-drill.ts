import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { prepareRestore } from '../scripts/restore';

const db = new DatabaseSync(':memory:');
try {
  db.exec(readFileSync('db/migrations/0001_initial.sql', 'utf8'));
  const now = Date.now();
  // Simulate 30 days, 200 opted-in browsers/day, four events/browser (24,000 events).
  const rows = Array.from({ length: 24000 }, (_, i) => ({
    event_id: `drill-${i}`, visitor_id: `browser-${Math.floor(i / 4) % 200}`,
    event_type: 'search', occurred_at: new Date(now - (1 + Math.floor(i / 800)) * 86400000).toISOString(),
    received_at: new Date(now - (1 + Math.floor(i / 800)) * 86400000).toISOString(),
    session_id: `session-${Math.floor(i / 4)}`, page_view_id: `page-${i}`, page_path: '/', catalogue_version: 'drill',
    properties_json: JSON.stringify({ query: 'must not restore query text', result_count: 1 }),
  }));
  const deleted = new Set(Array.from({ length: 20 }, (_, i) => `browser-${i}`));
  // A newer tombstone already present at the destination must also win.
  db.prepare('INSERT INTO deletion_requests(visitor_id,requested_at) VALUES(?,?)').run('browser-20', new Date(now).toISOString());
  const restore = prepareRestore([...rows, ...rows.slice(0, 2000)], deleted, now);
  db.exec(restore.sql);
  const expected = 24000 - 21 * 120;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM events').get()!.n, expected);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM events WHERE json_extract(properties_json,'$.query') IS NOT NULL").get()!.n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM events JOIN deletion_requests USING(visitor_id)').get()!.n, 0);
  db.exec(restore.sql);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM events').get()!.n, expected);
  assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
  console.log(`Recovery drill passed: 24,000 source events, ${expected} restored; deletion tombstones, duplicate imports, query redaction and integrity verified in isolated SQLite.`);
} finally { db.close(); }
