import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const mode = process.argv.includes('--remote') ? '--remote' : '--local';
const configIndex = process.argv.indexOf('--config');
const configArgs = configIndex >= 0 ? ['--config', process.argv[configIndex + 1]] : [];
const results = JSON.parse(
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      mode,
      '--json',
      '--command',
      'SELECT visitor_id FROM deletion_requests; SELECT review_id FROM review_deletions;',
      ...configArgs,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  ),
);
await mkdir('work', { recursive: true });
const path = `work/tombstones-${Date.now()}.json`;
await writeFile(
  path,
  JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      visitors: results[0].results.map((r: { visitor_id: string }) => r.visitor_id),
      reviews: results[1].results.map((r: { review_id: string }) => r.review_id),
    },
    null,
    2,
  ),
  { flag: 'wx' },
);
console.log(`Private deletion snapshot: ${path}`);
