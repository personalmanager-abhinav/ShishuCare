import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const remote = process.argv.includes('--remote');
if (remote && !process.argv.includes('--quiesced'))
  throw new Error(
    'Pause application writes and scheduled jobs first, then use --remote --quiesced. Backup never pauses production itself.',
  );
const configIndex = process.argv.indexOf('--config');
const configArgs = configIndex >= 0 ? ['--config', process.argv[configIndex + 1]] : [];
const run = (...args: string[]) =>
  execFileSync(
    process.execPath,
    ['node_modules/wrangler/bin/wrangler.js', ...args, ...configArgs],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
  );
const mode = remote ? '--remote' : '--local';
const root = resolve('work/backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(root, { recursive: true });
await mkdir(`${root}/raw`);
run('d1', 'export', 'DB', mode, '--output', `${root}/database.sql`);
const sql = await readFile(`${root}/database.sql`, 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(sql);
const digest = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const manifest: {
  version: number;
  created_at: string;
  mode: string;
  files: { path: string; sha256: string }[];
} = {
  version: 1,
  created_at: new Date().toISOString(),
  mode,
  files: [{ path: 'database.sql', sha256: digest(sql) }],
};
try {
  const configText = await readFile(
    configIndex >= 0 ? process.argv[configIndex + 1] : 'wrangler.jsonc',
    'utf8',
  );
  const ts = await import('typescript');
  const config = ts.default.parseConfigFileTextToJson('config', configText).config;
  const bucket = config.r2_buckets.find(
    (b: { binding: string }) => b.binding === 'ARCHIVE',
  ).bucket_name;
  const days = db
    .prepare('SELECT day FROM archive_manifest WHERE day>=? ORDER BY day')
    .all(new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10));
  for (const row of days) {
    if (typeof row.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.day))
      throw new Error('Invalid archive day');
    const path = `raw/${row.day}.ndjson`;
    run('r2', 'object', 'get', `${bucket}/${path}`, mode, '--file', `${root}/${path}`);
    manifest.files.push({ path, sha256: digest(await readFile(`${root}/${path}`)) });
  }
  // Incomplete/actively changing exports never receive a completed manifest.
  run('d1', 'export', 'DB', mode, '--output', `${root}/database-verify.sql`);
  if (digest(await readFile(`${root}/database-verify.sql`)) !== digest(sql))
    throw new Error(
      'Database changed during backup; pause writes and retry. No completed manifest was written.',
    );
  await writeFile(`${root}/manifest.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log(
    `Private backup completed: ${root}. Contains credentials, reviews and business data; keep private and expire after 30 days.`,
  );
} finally {
  db.close();
}
