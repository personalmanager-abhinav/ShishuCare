import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { prepareBundle } from '../scripts/recovery-bundle';

test('Recovery bundle verifies archived bytes, applies deletion to SQL and R2, and rejects tampering', async () => {
  const now = Date.now(),
    time = new Date(now).toISOString();
  await mkdir('work', { recursive: true });
  const root = await mkdtemp('work/bundle-fixture-');
  await mkdir(`${root}/raw`);
  const day = new Date(now - 10 * 86400000).toISOString().slice(0, 10);
  const migrations = (
    await Promise.all(
      ['0001_initial.sql', '0002_reviews.sql', '0003_discovery_operations.sql'].map((f) =>
        readFile(`db/migrations/${f}`, 'utf8'),
      ),
    )
  ).join('\n');
  const sql =
    migrations +
    `INSERT INTO archive_manifest VALUES('${day}','${time}',1200);
    INSERT INTO product_reviews VALUES('gone','P101','Parent','initial',4,'Private note','approved','${time}','hash','unverified',NULL);
    INSERT INTO product_reviews VALUES('kept','P101','Parent','initial',4,'Retained note','approved','${time}','hash','unverified',NULL);`;
  const archive = Array.from({ length: 1200 }, (_, i) =>
    JSON.stringify({
      event_id: `e${i}`,
      visitor_id: i % 2 ? 'keep' : 'remove',
      received_at: `${day}T12:00:00.000Z`,
      properties_json: JSON.stringify({ query: 'private query', result_count: 0 }),
    }),
  ).join('\n');
  const digest = (s: string) => createHash('sha256').update(s).digest('hex');
  await writeFile(`${root}/database.sql`, sql);
  await writeFile(`${root}/raw/${day}.ndjson`, archive);
  await writeFile(
    `${root}/manifest.json`,
    JSON.stringify({
      version: 1,
      created_at: time,
      files: [
        { path: 'database.sql', sha256: digest(sql) },
        { path: `raw/${day}.ndjson`, sha256: digest(archive) },
      ],
    }),
  );
  await writeFile(
    `${root}/tombstones.json`,
    JSON.stringify({ exported_at: time, visitors: ['remove'], reviews: ['gone'] }),
  );
  const out = await prepareBundle(root, `${root}/tombstones.json`, now);
  const recovered = await readFile(`${out}/raw/${day}.ndjson`, 'utf8');
  assert.equal(recovered.split('\n').length, 600);
  assert.ok(!recovered.includes('private query'));
  assert.ok(!recovered.includes('"remove"'));
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await readFile(`${out}/database.sql`, 'utf8'));
    assert.equal(db.prepare('SELECT event_count FROM archive_manifest').get()!.event_count, 600);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM product_reviews').get()!.n, 1);
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
  } finally {
    db.close();
  }
  await writeFile(`${root}/raw/${day}.ndjson`, archive + '\n{}');
  await assert.rejects(
    () => prepareBundle(root, `${root}/tombstones.json`, now),
    /checksum mismatch/,
  );
});
