import catalogue from '../generated/catalogue.json';
import site from '../../data/site.json';
import taxonomy from '../../data/taxonomy.json';
export function GET() {
  const paths = [
    '/',
    '/wardrobe/',
    '/about/',
    ...taxonomy.map((c) => `/categories/${c.id}/`),
    ...catalogue.products.map((p) => `/products/${p.slug}/`),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${new URL(p, site.url).href}</loc></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
