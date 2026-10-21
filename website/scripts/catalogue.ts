import { readFile, readdir, mkdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateCatalogue } from '../src/lib/catalogue';
import site from '../data/site.json';
import embeddings from '../data/embeddings.json';
import ts from 'typescript';
import { generateImages } from './images';
const files = (await readdir('data/products')).filter((f) => f.endsWith('.json')).sort();
const products = validateCatalogue(
  await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(`data/products/${f}`, 'utf8'))),
  ),
);
// Missing variant photography is omitted from generated output so the configured fallback can render.
for (const product of products)
  for (const variant of product.colour_variants || []) {
    await access(`public${variant.illustration.src}`);
    const existing = [];
    for (const photo of variant.photos) {
      try {
        await access(`public${photo.src}`);
        existing.push(photo);
      } catch {
        console.warn(`Missing photo ${photo.src}: using configured fallback when needed.`);
      }
    }
    variant.photos = existing;
  }
const version = createHash('sha256').update(JSON.stringify(products)).digest('hex').slice(0, 16);
for (const product of products)
  for (const image of product.images) await access(`public${image.src}`);
for (const product of products) if (product.video) await access(`public${product.video.src}`);
if (process.argv.includes('--production')) {
  const configIndex = process.argv.indexOf('--config');
  const configPath = configIndex >= 0 ? process.argv[configIndex + 1] : 'wrangler.jsonc';
  const parsedConfig = ts.parseConfigFileTextToJson(configPath, await readFile(configPath, 'utf8'));
  if (parsedConfig.error) throw new Error('Invalid wrangler.jsonc configuration.');
  const config = parsedConfig.config;
  if (
    site.demo ||
    site.url.includes('example.com') ||
    products.some((p) => p.demo || (p.status === 'active' && !p.offers.some((o) => o.url)))
  )
    throw new Error(
      'Production blocked: replace demo branding, domain, products and marketplace links first.',
    );
  if (!products.some((p) => p.status === 'active'))
    throw new Error('Production requires active products.');
  for (const product of products.filter((p) => p.status === 'active')) {
    for (const image of product.images) {
      if (
        image.src.endsWith('.svg') &&
        (await readFile(`public${image.src}`, 'utf8')).includes('SAMPLE PHOTOGRAPH')
      )
        throw new Error('Replace sample image placeholders before publishing.');
    }
  }
  if (new URL(site.url).protocol !== 'https:')
    throw new Error('Production site URL must use HTTPS.');
  if (
    config.vars.ENVIRONMENT !== 'production' ||
    !config.vars.ACCESS_TEAM_DOMAIN ||
    !config.vars.ACCESS_AUD ||
    !config.vars.OWNER_EMAIL ||
    config.d1_databases[0].database_id.startsWith('00000000')
  )
    throw new Error('Configure production database and owner authentication first.');
  const artifact = embeddings as {
    catalogue_version?: string;
    products: Record<string, { vector: number[] }>;
  };
  if (
    config.vars.SEMANTIC_ENABLED !== 'true' ||
    artifact.catalogue_version !== version ||
    !products
      .filter((p) => p.status === 'active')
      .every((p) => artifact.products[p.product_id]?.vector.length === 384)
  )
    throw new Error(
      'Initial production release requires current embeddings and enabled semantic search.',
    );
}
await mkdir('src/generated', { recursive: true });
await writeFile(
  'src/generated/images.json',
  JSON.stringify(await generateImages(products), null, 2),
);
await writeFile(
  'src/generated/catalogue.json',
  JSON.stringify({ version, products: products.filter((p) => p.status === 'active') }, null, 2),
);
console.log(`Validated ${products.length} products. Catalogue ${version}.`);
