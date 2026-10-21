import { defineConfig } from 'astro/config';
import site from './data/site.json' with { type: 'json' };
export default defineConfig({ site: site.url, output: 'static', trailingSlash: 'always' });
