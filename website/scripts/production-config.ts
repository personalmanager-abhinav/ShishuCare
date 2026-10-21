import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { z } from 'zod';
const hostname = z
  .string()
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/)
  .refine((s) => !s.endsWith('.example') && !s.endsWith('example.com'));
const input = z
  .object({
    PRODUCTION_DOMAIN: hostname,
    OWNER_DOMAIN: hostname,
    CLOUDFLARE_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/),
    CLOUDFLARE_DATABASE_ID: z.uuid(),
    ARCHIVE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
    ACCESS_TEAM_DOMAIN: z.string().regex(/^[a-z0-9-]+\.cloudflareaccess\.com$/),
    ACCESS_AUD: z.string().min(10),
    OWNER_EMAIL: z.email(),
  })
  .parse(process.env);
if (input.PRODUCTION_DOMAIN === input.OWNER_DOMAIN)
  throw new Error('Storefront and owner hostnames must differ');
if (input.CLOUDFLARE_DATABASE_ID.startsWith('00000000'))
  throw new Error('Use the actual D1 identifier');
const base = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile('wrangler.jsonc', 'utf8'),
).config;
const shared = {
  ...base,
  account_id: input.CLOUDFLARE_ACCOUNT_ID,
  workers_dev: false,
  d1_databases: [{ ...base.d1_databases[0], database_id: input.CLOUDFLARE_DATABASE_ID }],
  r2_buckets: [{ binding: 'ARCHIVE', bucket_name: input.ARCHIVE_BUCKET }],
  vars: {
    ...base.vars,
    ENVIRONMENT: 'production',
    SEMANTIC_ENABLED: 'true',
    ACCESS_TEAM_DOMAIN: input.ACCESS_TEAM_DOMAIN,
    ACCESS_AUD: input.ACCESS_AUD,
    OWNER_EMAIL: input.OWNER_EMAIL,
    BARGAIN_MODE: 'disabled',
    BARGAIN_PUBLIC_ENABLED: 'false',
  },
};
for (const [name, main, domain, crons] of [
  ['storefront', 'workers/storefront-only.ts', input.PRODUCTION_DOMAIN, []],
  ['owner', 'workers/owner-only.ts', input.OWNER_DOMAIN, ['15 * * * *']],
] as const) {
  const config = {
    ...shared,
    name: `shishu-${name}`,
    main,
    routes: [{ pattern: domain, custom_domain: true }],
    triggers: { crons },
    assets: {
      ...base.assets,
      run_worker_first: name === 'owner' ? true : base.assets.run_worker_first,
    },
  };
  await writeFile(`wrangler.production-${name}.json`, JSON.stringify(config, null, 2), {
    flag: 'wx',
  });
}
console.log(
  'Prepared ignored production configurations. No resources created or deployed. Configure Access and secrets, apply migrations, then run release checks.',
);
