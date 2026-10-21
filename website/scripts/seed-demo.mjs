// Explicit developer utility. Never run automatically over an owner's catalogue.
import { mkdir, writeFile } from 'node:fs/promises';
const samples = [
  [
    'P001',
    'Everyday cotton shirt',
    'clothing',
    799,
    'black',
    'cotton',
    'casual',
    'summer',
    'shirt',
  ],
  ['P002', 'Relaxed linen shirt', 'clothing', 1199, 'white', 'linen', 'casual', 'summer', 'shirt'],
  [
    'P003',
    'Classic cotton tee',
    'clothing',
    499,
    'blue',
    'cotton',
    'everyday',
    'summer',
    't-shirt',
  ],
  [
    'P004',
    'The everyday tote',
    'accessories',
    599,
    'cream',
    'canvas',
    'everyday',
    'all-season',
    'bag',
  ],
  [
    'P005',
    'Weekend crossbody',
    'accessories',
    899,
    'black',
    'cotton',
    'casual',
    'all-season',
    'bag',
  ],
  ['P006', 'Morning ceramic mug', 'home', 399, 'white', 'ceramic', 'everyday', 'all-season', 'mug'],
  [
    'P007',
    'Textured cushion cover',
    'home',
    449,
    'blue',
    'cotton',
    'everyday',
    'all-season',
    'cushion',
  ],
  [
    'P008',
    'Lightweight summer scarf',
    'accessories',
    349,
    'green',
    'cotton',
    'casual',
    'summer',
    'scarf',
  ],
];
await mkdir('data/products', { recursive: true });
await mkdir('public/images', { recursive: true });
for (const [id, name, category, price, color, material, occasion, season, type] of samples) {
  const product = {
    schema_version: 1,
    product_id: id,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    description: `A ${color} ${material} ${type} for ${occasion} use. This is sample content for exploring the catalogue; replace it with your own product description and photography.`,
    category_id: category,
    status: 'active',
    demo: true,
    images: [{ src: `/images/${id}.svg`, alt: `Sample image placeholder for ${name}` }],
    attributes: {
      color: [color],
      material: [material],
      occasion: [occasion],
      season: [season],
      type: [type],
    },
    tags: [type, occasion, season],
    offers: ['meesho', 'amazon', 'flipkart'].map((m) => ({
      offer_id: `${id}-${m}`,
      marketplace_id: m,
      url: null,
      price_minor: price * 100,
      currency: 'INR',
      availability: 'unknown',
      last_verified_at: null,
    })),
    created_at: '2026-09-17T00:00:00Z',
    updated_at: '2026-09-17T00:00:00Z',
  };
  await writeFile(`data/products/${id}.json`, JSON.stringify(product, null, 2));
  const bg = {
    black: '#dddde2',
    white: '#e8e8e5',
    blue: '#cbd7e7',
    cream: '#e6e0d4',
    green: '#cad6cf',
  }[color];
  await writeFile(
    `public/images/${id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="960" viewBox="0 0 800 960"><rect width="800" height="960" fill="${bg}"/><text x="400" y="465" text-anchor="middle" font-family="Georgia,serif" font-size="130" fill="#2b3545" opacity=".2">${id.slice(1)}</text><text x="400" y="545" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="5" fill="#465166">SAMPLE PHOTOGRAPH</text><text x="400" y="890" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#465166">${name}</text></svg>`,
  );
}
