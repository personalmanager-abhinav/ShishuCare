import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { semanticText, type Product } from '../src/lib/catalogue';
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!account || !token)
  throw new Error(
    'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI permission) in your shell.',
  );
const catalogue = JSON.parse(await readFile('src/generated/catalogue.json', 'utf8'));
const artifact = JSON.parse(await readFile('data/embeddings.json', 'utf8'));
for (const p of catalogue.products as Product[]) {
  const text = semanticText(p);
  const hash = createHash('sha256').update(text).digest('hex');
  if (artifact.products[p.product_id]?.hash === hash) continue;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${artifact.model}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text] }),
    },
  );
  if (!response.ok) throw new Error(`Embedding request failed: ${response.status}`);
  const result = (await response.json()) as { result: { data: number[][] } };
  const vector = result.result?.data?.[0];
  if (!vector || vector.length !== artifact.dimensions || !vector.every(Number.isFinite))
    throw new Error('Invalid embedding response');
  artifact.products[p.product_id] = { hash, vector };
}
artifact.products = Object.fromEntries(
  Object.entries(artifact.products).filter(([id]) =>
    catalogue.products.some((p: Product) => p.product_id === id),
  ),
);
artifact.catalogue_version = catalogue.version;
await writeFile('data/embeddings.json', JSON.stringify(artifact));
console.log('Embedding artifact updated; rebuild before preview or deployment.');
