import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const columns = ['event_id', 'schema_version', 'event_type', 'occurred_at', 'received_at', 'visitor_id', 'session_id', 'page_view_id', 'page_path', 'product_id', 'marketplace_id', 'search_id', 'catalogue_version', 'properties_json'] as const;
const literal = (value: unknown) => value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;

// Generates a reviewable import only. This module never connects to a database.
export function prepareRestore(rows: Record<string, unknown>[], deleted: Set<string>, now = Date.now()) {
  const seen = new Set<string>();
  const statements: string[] = [];
  let omitted = 0;
  for (const row of rows) {
    if (typeof row.event_id !== 'string' || typeof row.visitor_id !== 'string' || typeof row.properties_json !== 'string') throw new Error('Invalid archive identity or properties');
    if (deleted.has(row.visitor_id)) { omitted++; continue; }
    const received = Date.parse(String(row.received_at));
    const occurred = Date.parse(String(row.occurred_at));
    if (!Number.isFinite(received) || !Number.isFinite(occurred) || received > now || occurred > now) throw new Error('Invalid archive timestamp');
    if (received < now - 180 * 86400000) { omitted++; continue; }
    if (seen.has(row.event_id)) continue;
    seen.add(row.event_id);
    const properties = JSON.parse(row.properties_json);
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new Error('Invalid archive properties');
    delete properties.query;
    for (const field of ['event_type', 'session_id', 'page_view_id', 'page_path', 'catalogue_version']) if (typeof row[field] !== 'string') throw new Error(`Missing ${field}`);
    statements.push(`INSERT OR IGNORE INTO events(${columns.join(',')}) SELECT ${columns.map(c => literal(c === 'properties_json' ? JSON.stringify(properties) : c === 'schema_version' ? 1 : row[c])).join(',')} WHERE NOT EXISTS (SELECT 1 FROM deletion_requests WHERE visitor_id=${literal(row.visitor_id)});`);
  }
  const tombstones = [...deleted].map(id => `INSERT OR IGNORE INTO deletion_requests(visitor_id,requested_at) VALUES(${literal(id)},${literal(new Date(now).toISOString())});\nDELETE FROM events WHERE visitor_id=${literal(id)};\nDELETE FROM visitors WHERE visitor_id=${literal(id)};`);
  return { sql: ['-- Restore only into a separate recovery database. Apply migrations first.', ...tombstones, ...statements].join('\n'), imported: seen.size, omitted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, tombstoneFile, output] = process.argv.slice(2);
  if (!directory || !tombstoneFile || !output) throw new Error('Usage: pnpm exec tsx scripts/restore.ts <archive-directory> <tombstones.json> <output.sql>');
  const tombstones: unknown = JSON.parse(await readFile(tombstoneFile, 'utf8'));
  if (!Array.isArray(tombstones) || !tombstones.every(x => typeof x === 'string' && x.length > 0)) throw new Error('Tombstones must be a JSON array of all deleted visitor IDs, including completed deletions');
  const rows = [];
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.ndjson')).sort()) {
    rows.push(...(await readFile(resolve(directory, file), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line)));
  }
  const result = prepareRestore(rows, new Set(tombstones));
  await writeFile(output, result.sql, { flag: 'wx' });
  console.log(`Prepared ${result.imported} events; omitted ${result.omitted} deleted/expired events. Review SQL and import only into an isolated recovery database.`);
}
