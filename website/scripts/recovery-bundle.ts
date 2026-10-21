import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

export const tombstoneSchema = z
  .object({
    exported_at: z.iso.datetime(),
    visitors: z.array(z.string().min(1).max(100)),
    reviews: z.array(z.string().min(1).max(100)),
  })
  .strict();
const literal = (v: unknown): string =>
  v === null
    ? 'NULL'
    : typeof v === 'number' || typeof v === 'bigint'
      ? String(v)
      : typeof v === 'string'
        ? `'${v.replaceAll("'", "''")}'`
        : (() => {
            throw new Error('Unsupported database value');
          })();
const identifier = (v: string) => `"${v.replaceAll('"', '""')}"`;
function exportDatabase(db: DatabaseSync) {
  const schemas = db
    .prepare(
      "SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name",
    )
    .all() as { name: string; type: string; sql: string }[];
  const output = ['PRAGMA defer_foreign_keys=TRUE;'];
  for (const row of schemas.filter((s) => s.type === 'table')) {
    output.push(`${row.sql};`);
    for (const data of db.prepare(`SELECT * FROM ${identifier(row.name)}`).all())
      output.push(
        `INSERT INTO ${identifier(row.name)}(${Object.keys(data).map(identifier).join(',')}) VALUES(${Object.values(data).map(literal).join(',')});`,
      );
  }
  for (const row of schemas.filter((s) => s.type !== 'table')) output.push(`${row.sql};`);
  return output.join('\n');
}
export function sanitizeDatabase(
  sql: string,
  tombstones: z.infer<typeof tombstoneSchema>,
  now = Date.now(),
) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    db.exec('PRAGMA foreign_keys=ON;');
    const timestamp = new Date(now).toISOString();
    for (const visitor of tombstones.visitors)
      db.prepare(
        'INSERT OR IGNORE INTO deletion_requests(visitor_id,requested_at) VALUES(?,?)',
      ).run(visitor, timestamp);
    for (const review of tombstones.reviews)
      db.prepare('INSERT OR IGNORE INTO review_deletions(review_id,deleted_at) VALUES(?,?)').run(
        review,
        timestamp,
      );
    db.exec(
      'DELETE FROM events WHERE visitor_id IN (SELECT visitor_id FROM deletion_requests); DELETE FROM visitors WHERE visitor_id IN (SELECT visitor_id FROM deletion_requests); DELETE FROM product_reviews WHERE id IN (SELECT review_id FROM review_deletions); DELETE FROM recommendation_sets; DELETE FROM counters; DELETE FROM job_runs;',
    );
    db.prepare('DELETE FROM visitors WHERE expires_at<=?').run(timestamp);
    db.prepare(
      'DELETE FROM events WHERE received_at<? AND substr(received_at,1,10) IN (SELECT day FROM archive_manifest)',
    ).run(new Date(now - 30 * 86400000).toISOString());
    db.exec(
      "UPDATE events SET properties_json=json_remove(properties_json,'$.query'); UPDATE deletion_requests SET cursor=NULL,completed_at=NULL;",
    );
    db.prepare('DELETE FROM daily_metrics WHERE day<?').run(
      new Date(now - 730 * 86400000).toISOString().slice(0, 10),
    );
    db.prepare('DELETE FROM archive_manifest WHERE day<?').run(
      new Date(now - 180 * 86400000).toISOString().slice(0, 10),
    );
    if (db.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok')
      throw new Error('Recovery integrity check failed');
    if (db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Recovery has orphaned foreign keys');
    return {
      sql: exportDatabase(db),
      visitors: new Set(
        db
          .prepare('SELECT visitor_id FROM deletion_requests')
          .all()
          .map((r) => String(r.visitor_id)),
      ),
      reviewCount: Number(db.prepare('SELECT COUNT(*) count FROM product_reviews').get()!.count),
    };
  } finally {
    db.close();
  }
}
export async function prepareBundle(directory: string, tombstoneFile: string, now = Date.now()) {
  const root = resolve(directory);
  const work = resolve('work');
  const subpath = relative(work, root);
  if (subpath.startsWith('..') || isAbsolute(subpath))
    throw new Error('Keep private recovery inputs under website/work');
  const manifest = z
    .object({
      version: z.literal(1),
      created_at: z.iso.datetime(),
      files: z.array(
        z.object({
          path: z.string().regex(/^(database\.sql|raw\/\d{4}-\d{2}-\d{2}\.ndjson)$/),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      ),
    })
    .parse(JSON.parse(await readFile(`${root}/manifest.json`, 'utf8')));
  if (
    now - Date.parse(manifest.created_at) > 30 * 86400000 ||
    Date.parse(manifest.created_at) > now
  )
    throw new Error('Backup is outside the 30-day restore policy');
  if (
    new Set(manifest.files.map((f) => f.path)).size !== manifest.files.length ||
    !manifest.files.some((f) => f.path === 'database.sql')
  )
    throw new Error('Invalid backup file inventory');
  const tombstones = tombstoneSchema.parse(JSON.parse(await readFile(tombstoneFile, 'utf8')));
  if (
    now - Date.parse(tombstones.exported_at) > 3600000 ||
    Date.parse(tombstones.exported_at) > now
  )
    throw new Error('Export fresh deletion tombstones within one hour of preparing recovery');
  for (const file of manifest.files)
    if (
      createHash('sha256')
        .update(await readFile(`${root}/${file.path}`))
        .digest('hex') !== file.sha256
    )
      throw new Error(`Backup checksum mismatch: ${file.path}`);
  const sanitized = sanitizeDatabase(
    await readFile(`${root}/database.sql`, 'utf8'),
    tombstones,
    now,
  );
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sanitized.sql);
    const required = db
      .prepare('SELECT day FROM archive_manifest')
      .all()
      .map((row) => `raw/${row.day}.ndjson`);
    for (const path of required)
      if (!manifest.files.some((f) => f.path === path))
        throw new Error(`Missing retained archive: ${path}`);
    const out = resolve('work/recovery', new Date(now).toISOString().replace(/[:.]/g, '-'));
    await mkdir(out, { recursive: true });
    await mkdir(`${out}/raw`);
    const files = [];
    for (const file of manifest.files.filter((f) => f.path.startsWith('raw/'))) {
      if (file.path.slice(4, 14) < new Date(now - 180 * 86400000).toISOString().slice(0, 10))
        continue;
      const kept = (await readFile(`${root}/${file.path}`, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((row) => !sanitized.visitors.has(row.visitor_id))
        .map((row) => {
          if (typeof row.visitor_id !== 'string' || typeof row.properties_json !== 'string')
            throw new Error('Invalid archived event');
          const properties = JSON.parse(row.properties_json);
          delete properties.query;
          return JSON.stringify({ ...row, properties_json: JSON.stringify(properties) });
        });
      const bytes = kept.join('\n');
      await writeFile(`${out}/${file.path}`, bytes, { flag: 'wx' });
      db.prepare('UPDATE archive_manifest SET event_count=? WHERE day=?').run(
        kept.length,
        file.path.slice(4, 14),
      );
      files.push({
        path: file.path,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        events: kept.length,
      });
    }
    const recoveredSql = exportDatabase(db);
    await writeFile(`${out}/database.sql`, recoveredSql, { flag: 'wx' });
    await writeFile(
      `${out}/recovery-report.json`,
      JSON.stringify(
        {
          source: root,
          prepared_at: new Date(now).toISOString(),
          tombstones_exported_at: tombstones.exported_at,
          retained_reviews: sanitized.reviewCount,
          database_sha256: createHash('sha256').update(recoveredSql).digest('hex'),
          archives: files,
          notice:
            'Import only into empty isolated D1/R2 resources. Credentials and business data remain private. Recheck deletion tombstones before promotion.',
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    return out;
  } finally {
    db.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, tombstones] = process.argv.slice(2);
  if (!directory || !tombstones)
    throw new Error(
      'Usage: recovery-bundle.ts work/backups/<snapshot> work/current-tombstones.json',
    );
  console.log(`Prepared private recovery bundle: ${await prepareBundle(directory, tombstones)}`);
}
