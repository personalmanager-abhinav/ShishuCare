# Marketplace catalogue

## Public GitHub Pages preview

The public storefront preview is hosted at https://personalmanager-abhinav.github.io/.
The source is on `main`; the built `website/dist` output is published separately to the
`gh-pages` branch. Rebuild with `PUBLIC_STATIC_PREVIEW=true` before publishing updates.
This static preview retains demo labels and production-content guards; it does
not deploy the Cloudflare Worker or provide bargaining, reviews, analytics collection or owner APIs.
Search uses its existing browser fallback and favourites remain browser-local.

## Age-stage discovery and gift finder

`/age-stages/` links to catalogue filters via `?age=newborn`, `3-6`, `6-12` or `12-24`.
Optional product `age_suitability` contains integer `min_months`, `max_months`, `source`,
ISO `verified_at` and optional `notes`. A match must cover the entire chosen stage; missing
verification is excluded. Demo products have no fabricated suitability. `/gift-finder/` combines
these stages with strict maximum price, colour and category choices and shareable filter URLs.
See `../docs/FEATURE-ROLLOUT.md` for remaining requested features.

## Active editorial redesign — 28 October 2026

The customer-facing storefront has been rebuilt around a clean, energetic baby-boutique direction
based on the supplied visual reference rather than a conventional marketplace grid. The visual system
uses a white navigation bar, sunny yellow product hero, cloud-shaped transitions, pastel promotion
panels, circular category browsing, trust highlights and a pink family/footer area. Subtle hover,
press, reveal, loading and colour-change effects include reduced-motion fallbacks. The homepage now
introduces the brand before discovery, while search, strict filters, colour previews, Mannpasand,
reviews, bargaining demo, analytics consent and external marketplace handoff retain their existing
behavior.

The active reference-led layer is `src/styles/boutique.css`, loaded last by `src/layouts/Layout.astro`,
with micro-interactions in `src/scripts/boutique.ts`.
Homepage composition is in `src/pages/index.astro`; collection and card structure live in
`src/components/Catalogue.astro` and `src/components/ProductCard.astro`. The Stage and Wardrobe
experiments remain available from the footer but no longer compete with core shopping paths in the
primary navigation. The older powder-sky/doodle baseline below is retained as implementation history,
not the active visual direction.

## Architecture continuation — 20 September 2026

Related-product discovery, explicit session preferences, recommendation measurement, private experiment/trend/inventory reports, full recovery preparation and separate production entry points are now implemented. See [architecture progress](../docs/ARCHITECTURE-PROGRESS.md) for remaining evidence-dependent work. Run `pnpm run db:local` to apply additive migration `0003_discovery_operations.sql` before testing these flows.

### Related products, preferences and experiments

Product pages and popups show three related products. `src/lib/recommendations.ts` ranks by category and attribute overlap, optionally adding current catalogue vectors. It excludes the source, archived products and products whose offers are all unavailable. API category/budget constraints remain hard filters. Static related links work without JavaScript; browser content ranking is the fallback if `/api/recommendations` fails.

The separate checkbox on Privacy allows up to eight recent product IDs in this tab to influence ranking. It is off by default. Session history expires from use after 30 minutes idle, and is cleared on opt-out/history deletion. Analytics consent is separate; declining analytics does not prevent browsing or this explicitly chosen session behavior.

`data/discovery.json` controls the feature and model version. Its ranking experiment is **disabled by default**. When enabled, only analytics-consenting, authenticated anonymous browser identities enter stable content/hybrid cohorts. Hybrid adds a bounded popularity signal from products with at least five consenting browsers in the preceding week. Use a new experiment ID and model version for changed ranking behavior. No learned model or long-lived personal profile is present.

Recommendation telemetry requires analytics consent. An impression means at least half of the link was visible continuously for one second with the tab visible. Events carry placement, position, request, model and experiment context, validated against a server-issued receipt. Receipts expire after three days; history deletion removes them. New analytics consent choices propagate across tabs. Navigation does not wait for tracking.

`pnpm run discovery:evaluate work/judged-discovery.json` evaluates private cases such as `[{"source_id":"P101","relevant_ids":["P103","P105"],"recent_ids":[],"popularity":{}}]`. These IDs illustrate the file format, not validated relevance judgments. The report in `work/discovery-evaluation.json` compares baseline/challenger precision, recall and NDCG at three. Supply real judgments; evaluation never enables experiments automatically.

### Private discovery and inventory

Open `/internal/insights` through the owner dashboard. Trends compare rolling seven-day product-session rates against the preceding seven days; low-support comparisons are withheld. Recommendation reports count distinct visible request/product pairs and subsequent clicks within 30 minutes. These are descriptive measures from consenting traffic, not purchases, population estimates or evidence of a causal winner.

The inventory section imports a private JSON batch below 16 KB, with at most 50 SKUs and 150 sales-day rows. Split large imports into batches; include the referenced SKU snapshot in each batch. Example format only:

```json
{
  "source": "Your reconciled marketplace sales export",
  "observed_at": "2026-09-20T08:00:00.000Z",
  "skus": [
    {
      "sku": "CAP-BLUE",
      "product_id": "P101",
      "variant": "blue",
      "stock_on_hand": 12,
      "lead_days": 5,
      "safety_days": 2
    }
  ],
  "sales": [{ "sku": "CAP-BLUE", "day": "2026-09-19", "units_sold": 2, "units_returned": 0 }]
}
```

Use actual values and timestamps. SKU-to-product/colour mappings cannot be reassigned. Reimporting a day replaces its totals instead of adding duplicates; stale snapshots and unknown mappings are rejected. Never include customer names or order-level personal details.

Planning requires all 28 completed India-calendar days, with explicit zero rows for days without sales, and stock observed within 24 hours. Gross daily sales estimate days of cover and lead-time-plus-safety stock needs. Returns are reported separately because their resale status is unknown. Missing days/stale stock produce no estimate; zero sales produces no depletion date. This is a simple baseline, not a seasonal/ML forecast or automatic purchasing system.

### Full backups and recovery

The original `restore:prepare` command below remains an event-only importer. New full-state commands are:

```sh
pnpm run backup:local
pnpm run backup:tombstones
pnpm run recovery:prepare work/backups/<snapshot> work/tombstones-<timestamp>.json
```

Backups include D1 SQL and retained raw R2 objects listed in its archive manifest, with SHA-256 checksums. A second D1 export must match the first before a completed manifest is written. Outputs are private under ignored `work/`; they contain review data, credential hashes and inventory. Protect and expire backups after 30 days. Native SQLite tooling is exercised on Node 24.

For remote reads, pass `--remote --config wrangler.production-owner.json` to the backup/tombstone commands. Remote backup additionally requires `--quiesced`: first pause application writes and scheduled jobs yourself for a consistent capture. The script does not pause or mutate production. Export fresh tombstones after the outage/recovery decision; `recovery:prepare` requires a deletion export less than one hour old and a backup no older than 30 days. Include completed visitor deletions and review deletions. Older backups predating review tombstone tracking cannot prove previously deleted reviews were excluded.

The preparer checks every checksum and required archive, scrubs deleted visitors/reviews and archive query text, removes expired credentials, resets transient counters/receipts/job status, requeues deletion checks, and updates archive counts. It writes `database.sql`, scrubbed raw files and a checksum report under `work/recovery/`. Full SQL includes schema and migration state: import it into **empty isolated D1 resources**, with a separate empty private R2 bucket, rather than applying it over live tables. Unlike the event-only importer, do not precreate its tables. Verify the report, counts, migrations, integrity, retention and auth behavior. Refresh tombstones again before any traffic cutover. No automatic production restore or cutover command is provided.

### Production separation and monitoring

Local preview retains the combined Worker. `workers/storefront-only.ts` rejects owner paths; `workers/owner-only.ts` accepts only owner routes and local fonts. Both share code/database contracts. Scheduled maintenance runs on the owner deployment only.

Set `PRODUCTION_DOMAIN`, `OWNER_DOMAIN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `ARCHIVE_BUCKET`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `OWNER_EMAIL`, then run `pnpm run production:configure`. This writes ignored `wrangler.production-storefront.json` and `wrangler.production-owner.json` without provisioning anything. Existing configuration files are not overwritten. Use separate hostnames. Configure Cloudflare Access for the owner hostname, apply all migrations, and set secrets using Wrangler; never put them into these JSON files. Set `RATE_SALT` for public rate limiting and stable experiment assignment. Optionally set a separate random `MONITOR_TOKEN` of at least 32 characters on the owner Worker.

Before deployment run `pnpm run release:check --config wrangler.production-storefront.json`, `pnpm run build`, and Wrangler dry runs for both generated configurations. Demo content/current embeddings still gate publishing. Deploy each configured Worker only after the remaining launch inputs and verification are complete; the existing generic `deploy` command still targets the default combined configuration.

`pnpm run health:check https://your-owner-host` uses `MONITOR_TOKEN` from the environment (or `LOCAL_ADMIN_TOKEN` locally). When Access protects that host, supply `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` for an appropriately scoped service policy too. Monitor authentication grants health access only, not reports. The command prints a status and exits nonzero on stale jobs, overdue deletions, backlog, auth failures or connection failures. External scheduling and alert delivery are separate configuration steps; this project sends no unsolicited messages.

## Continuation tooling — 19 September 2026

**Photography:** Add referenced JPG/PNG/WebP/AVIF photos to `public/images/` and rebuild. `scripts/images.ts` uses [Sharp resizing](https://sharp.pixelplumbing.com/api-resize/) to produce content-hashed WebP derivatives in ignored `public/images/generated/`, with a public manifest in `src/generated/images.json`. Proportions are preserved and small originals are not enlarged. Source files are unchanged. Generated files are not hand-edited; retire obsolete generated files during clean release builds when removing photos.

**Search evaluation:** `pnpm run search:evaluate` checks 56 sample queries and writes `work/search-evaluation.json`, including filters, results and elapsed time. For real data, pass `--cases work/real-search-cases.json --endpoint https://your-real-domain --require-semantic`. Cases use `[{"query":"blue caps under 150","expected_ids":["P101"]}]`. Semantic-required mode fails on fallback for nonempty queries. API evaluation uses normal rate/budget limits and sends no analytics events. Curate representative queries before claiming real-world or multilingual relevance.

**Operational health:** Authenticated `GET /internal/api/health` returns 200 when checks pass, or 503 with warnings for maintenance older than three hours, deletions older than 24 hours, or more than four eligible unarchived days. The dashboard displays these conditions. Configure an authenticated external monitor separately; no notification service is automatically provisioned.

**Recovery:** `pnpm run recovery:drill` checks 24,000 synthetic events in isolated in-memory SQLite, including duplicate imports, query redaction, deletion tombstones and integrity. It never accesses the running D1 database.

`pnpm run restore:prepare work/recovery-archives work/deleted-visitors.json work/recovery.sql` prepares event-import SQL without connecting to a database. Download private raw NDJSON archives to the first directory. The required second file is a JSON array of **all** deleted visitor IDs, including completed deletion requests; refresh it immediately before recovery. Existing output files are not overwritten. The preparer excludes expired/deleted events, strips queries and deduplicates IDs. Destination tombstones also take precedence.

Import only into a separate recovery database with migrations applied. Validate counts, manifests, retention and deletion completion before switching traffic. This restores event rows only: reviews, credentials, manifests and other state require the separate D1 backup. Re-archive or prune imported events outside the 30-day hot window before promotion. A real D1/R2 backup/export/restore rehearsal remains necessary.

A small business website for discovering products and choosing where to buy them. The website has **no cart, payments, checkout, or order management**. Those belong to Meesho, Amazon, Flipkart, or another marketplace.

Working source location: `C:\Users\Abhinav\Ventures\Baby Product Venture\website`. All commands in this guide run from that folder. Business-level documentation is in `../docs/`.

This README is the starting point for understanding and maintaining the project. Update it whenever a feature, configuration, or workflow changes. `AGENTS.md` records these maintenance rules for future coding sessions.

## Historical design baseline — 19 September 2026

This was the accepted baseline before the 28 October editorial redesign above: `powder-sky` theme, a blue baby-doodle background, catalogue/search immediately below the header, and a revised branded entrance. See [the historical design record](../docs/CURRENT-DESIGN-BASELINE.md) for implementation files and verification caveats. It no longer overrides the active redesign.

## Current state

The implementation runs locally with seven baby-product previews. It includes a responsive Poppins-based storefront, product popups with photo carousels, static product pages for direct links, price/category filters, keyword search, a hosted semantic-search integration, optional anonymous analytics, a protected owner dashboard, and archive/retention/deletion jobs.

**Live semantic search requires Cloudflare credentials and generated product embeddings.** Until configured, the site uses a working keyword fallback and says so. No Cloudflare account has been provisioned or public website deployed. The sample names, prices, and image placeholders are demonstration content, not your actual inventory.

Production publishing is blocked while demo data remains. Real photography, product links, business details, a domain, Cloudflare resources, owner authentication, and the final privacy notice are still needed.

### Experimental wardrobe storefront

`/wardrobe/` is a complete alternative browsing experience backed by the same generated catalogue and public APIs. It deliberately does not inherit the classic product-card layout: individually layered photographic products hang from a searchable showroom rail, react to the pointer with damped spring motion, and update an in-scene product panel. On capable devices, a lazy-loaded Three.js renderer maps every product onto a subdivided front/back garment surface with computed normals, perspective, room-matched lighting and category-specific stiffness. Hovering produces moving folds and highlights; dragging rotates and twists the surface; release settles it against its pinned top edge. All products share one transparent renderer with scissored views rather than opening one GPU context per item. The original image remains the automatic fallback when WebGL is unavailable or reduced motion is requested. Detailed selection opens a dedicated responsive drawer with colour previews, Mannpasand, marketplace choices, direct product links and the multilingual bargaining demo. The classic catalogue remains at `/`, with reciprocal view-switch links so this experiment can be evaluated without duplicating product data or backend state.

Its isolated implementation is in `src/pages/wardrobe.astro`, `src/layouts/WardrobeLayout.astro`, `src/styles/wardrobe.css` and `src/scripts/wardrobe.ts`; optimized photographic layers are in `public/images/wardrobe-v2/`. Preserve the external-marketplace model, reduced-motion fallback and demo/production guards when extending it.

### Product Stage storefront

`/stage/` is a focused, full-screen alternative storefront using the same catalogue, favourites, reviews, recommendations, marketplace links and bargaining APIs. One product occupies the central visual stage while adjacent products, arrow keys, swipe gestures, a searchable command surface and the bottom visual index provide fast navigation without a product-card grid. The `?product=P101` state is URL-addressable and survives history navigation. On mobile, the single-screen composition becomes a vertically scrollable app view without hiding product actions.

The Stage is implemented in `src/pages/stage.astro`, `src/layouts/StageLayout.astro`, `src/styles/stage.css` and `src/scripts/stage.ts`. `public/stage.webmanifest` and the `/stage/`-scoped `public/stage-sw.js` provide installable app metadata and a conservative offline shell. Checkout, payments and delivery continue on the selected marketplace; there is no local cart.

### Bargaining interface

The product popup places a compact **Make an offer / मोलभाव करें** action beside the listed price; direct product pages provide the same entry. It expands a contained conversation card in the existing product-information column, requires an explicit marketplace choice, shows remaining customer price offers, and keeps ordinary marketplace choices available below it. Its browser behavior lives with the existing popup logic in `src/scripts/product-dialog.ts`, while its markup and scoped visual treatment are in `src/components/ProductDialog.astro` and `src/styles/refinement.css`.

The demo API is persistent in local D1. It binds sessions to a short-lived opaque HttpOnly browser cookie, reuses the product-wide allowance for 24 hours, consumes at most three distinct unambiguous price offers, caps conversation messages, and treats retries idempotently. A deterministic policy layer generates floor-safe Hindi responses; the private floor is never returned. Consent-gated analytics record lifecycle events without storing offer amounts. Owner-authenticated `GET /internal/api/bargain` returns configuration, recent sessions and aggregate demo outcomes.

Run `pnpm run db:local` to apply bargaining migrations `0004` through `0008`. Checked-in demo campaigns cover the seven preview products and three marketplace choices but are marked `discount_kind=demo`, have no verified promotion and issue no coupon. Visitors choose Hindi, Hinglish or English before starting; the choice persists with the 30-minute browser-scoped session. Sanitized history resumes without retaining customer text, bounded requests safely retry with the same idempotency key, and scheduled maintenance purges demo sessions after the provisional `BARGAIN_RETENTION_DAYS` window (30 days locally). Local `wrangler.jsonc` enables `BARGAIN_MODE=demo`; generated production configuration forcibly sets `BARGAIN_MODE=disabled` and `BARGAIN_PUBLIC_ENABLED=false`.

The authenticated owner dashboard links to `/internal/bargain`, a read-only operations view of configuration, campaigns, policies, aggregate demo outcomes and recent sessions. It exposes no browser scope hash or customer message text and cannot enable a campaign or issue a coupon.

Marketplace campaigns, seller validation, encrypted coupon operations, a commercially permitted production AI provider, final pricing inputs and end-to-end checkout evidence remain required for a real offer. Do not remove the demo disclosure or production gate until those dependencies are satisfied.

## 1. Run it locally

Install Node.js 22.12 or newer and pnpm. Commands below run from the folder containing this README.

```sh
pnpm install
pnpm run build
pnpm run db:local
node scripts/local-admin.mjs
pnpm run preview
```

Open **http://127.0.0.1:8787/**. Keep the preview terminal running. This runs the static website and the real API against local D1/R2 emulators. It does not create production resources. AI is disabled in the checked-in development configuration.

For fast visual editing, use `pnpm run dev` and open the address it prints. That Astro-only server has no Worker API: browser keyword fallback works, but analytics will not be collected there. Rebuild and use `preview` to test the full application after changes. JSON edits require rebuilding the generated catalogue.

### Common commands

| Command                                 | Purpose                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm run build`                        | Validate JSON, generate catalogue, build static pages                      |
| `pnpm run dev`                          | Frontend editing with live updates                                         |
| `pnpm run db:local`                     | Apply database migrations locally                                          |
| `pnpm run preview`                      | Full local Worker + website preview                                        |
| `pnpm run check`                        | Astro, browser TypeScript, and Worker TypeScript checks                    |
| `pnpm run test`                         | Search and data-contract regression tests                                  |
| `node tests/integration.mjs`            | Live API checks; needs local preview and `.dev.vars`                       |
| `pnpm exec playwright install chromium` | Install the browser used by UI checks                                      |
| `node tests/browser.mjs`                | Desktop/mobile interaction checks; needs local preview                     |
| `node tests/bargain-browser.mjs`        | Bargain start/counter/resume checks; needs migrated local preview           |
| `pnpm run embeddings`                   | Generate changed product embeddings using your Cloudflare account          |
| `pnpm run release:check`                | Reject unsafe/incomplete production content                                |
| `pnpm run deploy`                       | Run release checks/build and publish to your configured Cloudflare account |

`scripts/local-admin.mjs` creates a random local owner token in ignored `.dev.vars`, leaving an existing file unchanged. Do not commit that file. `.dev.vars.example` explains the setting. Browser tests use the token automatically. To inspect the dashboard manually, send `Authorization: Bearer <LOCAL_ADMIN_TOKEN>` to `/internal/` and its API using a local browser header tool, or use the API from your terminal. Production uses Cloudflare Access, not this local token.

## 2. Where everything lives

| Path                               | What it does                                                        |
| ---------------------------------- | ------------------------------------------------------------------- |
| `data/site.json`                   | Display name, description, canonical domain, demo flag              |
| `data/products/*.json`             | Owner-maintained product source: one file per product               |
| `data/marketplaces.json`           | Marketplace names and approved URL hostnames                        |
| `data/taxonomy.json`               | Product categories                                                  |
| `data/embeddings.json`             | Generated public product vectors; no visitor data                   |
| `public/images/`                   | Public product images; replace sample images with owned photography |
| `src/pages/`                       | Homepage, static product pages, privacy, buying guide, sitemap, 404 |
| `src/layouts/Layout.astro`         | Shared header, footer, metadata, consent controls                   |
| `src/components/ProductCard.astro` | Reusable product card                                               |
| `src/styles/global.css`            | Responsive visual design                                            |
| `src/scripts/storefront.ts`        | Search/filter/sort interactions and browser fallback                |
| `src/scripts/tracking.ts`          | Consent, sessions, event batching, outbound tracking, deletion UI   |
| `src/lib/catalogue.ts`             | Product schema, validation, pricing helpers                         |
| `src/lib/search.ts`                | Constraint parsing, eligibility, keyword/vector scoring             |
| `src/lib/events.ts`                | Strict event schemas and query redaction                            |
| `src/generated/catalogue.json`     | Build-generated active catalogue; do not edit by hand               |
| `workers/public.ts`                | API routes, validation, search orchestration, static asset serving  |
| `workers/auth.ts`                  | Owner JWT checks, anonymous credentials, rate counters              |
| `workers/analytics.ts`             | Dashboard SQL and metric definitions                                |
| `workers/dashboard.ts`             | Owner interface, served only after authentication                   |
| `workers/jobs.ts`                  | Raw export, archive deletion, aggregate refresh, retention          |
| `workers/types.ts`                 | Environment bindings and configuration contract                     |
| `db/migrations/`                   | Ordered SQL schema changes                                          |
| `scripts/catalogue.ts`             | Catalogue validation and version generation                         |
| `scripts/embeddings.ts`            | Product embedding generation with content-hash reuse                |
| `scripts/seed-demo.mjs`            | Explicit sample-data generator; never run over real products        |
| `tests/`                           | Regression, API integration, and browser checks                     |
| `wrangler.jsonc`                   | Cloudflare bindings, API-first routes, hourly maintenance schedule  |
| `dist/`                            | Generated public website; never add private analytics here          |
| `.wrangler/`                       | Ignored local database/object storage state                         |

Local development uses one Worker with strict public/private route boundaries. Separate production entry points and configuration generation are available above. Private dashboard HTML is generated only by authenticated routes and never written to static output.

## 3. Add or edit products

Copy one sample JSON file to a new stable product ID, then edit its fields. Keep `product_id` and `offer_id` unchanged when renaming an existing item; historical analytics depend on those IDs.

- `slug`: the product URL. Changing it requires planning a redirect for the old URL.
- `name`, `description`, `attributes`, `tags`: accurate customer-facing product details.
- `category_id`: an ID from `taxonomy.json`.
- `status`: `active` is published; `draft` and `archived` are excluded.
- `demo`: set false only after replacing all sample content.
- `images`: local `/images/...` paths and descriptive alternative text.
- `offers`: one array entry per marketplace listing. Each has a stable ID, approved HTTPS URL, integer price in paise, currency, availability, and verification timestamp.
- `availability`: `available`, `unavailable`, or `unknown`; a working URL does not prove stock exists.
- `price_minor`: `79900` means ₹799. Use null for an unknown price.
- `url`: null disables the marketplace button. Never invent purchase links.
- `created_at`, `updated_at`: UTC ISO timestamps.

The public price/filter value is the lowest known price among offers not marked unavailable. Products with no known price are excluded from strict budget searches. Final prices must be confirmed on the marketplace.

Run `pnpm run build` after editing. It rejects duplicate IDs/slugs, invalid fields, missing images, and unapproved marketplace URLs. Product JSON is public: do not put supplier costs, private stock data, credentials, or customer information in it.

To add another marketplace, add it to `marketplaces.json` with its exact allowed hostnames, then add offers to the appropriate products. The UI uses that registry. To add categories, update `taxonomy.json`; static category pages and API category validation use it automatically. Extend search dictionaries when new product attributes/types appear.

For production photography, supply owned WebP/AVIF/JPEG/PNG files with suitable dimensions. Builds generate responsive WebP derivatives up to 320/640/960/1280px without enlargement. Cards, colour changes, direct pages and galleries use them. SVG previews remain unchanged. See continuation tooling below.

## 4. Customer flows

### Browse → detail → marketplace

```text
JSON products → catalogue build → static HTML + public assets
                                      ↓
Visitor browses cards → product popup + photo carousel → approved marketplace link
                                                ↓
                            External checkout/payment/delivery
```

Browsing needs no database request. Marketplace links open directly; telemetry never delays navigation. Missing/unavailable links are disabled. There is no checkout endpoint.

Normal card clicks open a native modal dialog without changing the URL or losing search/filter/scroll state. Escape, the close button, and the backdrop dismiss it. Focus remains in the popup while open and returns to its trigger when closed. Photos support previous/next buttons, thumbnails, left/right arrow keys, and horizontal swipe. Single-photo products hide unnecessary controls. Direct product URLs and modified clicks still open static pages, including when JavaScript is unavailable.

Each modal opening records one consent-gated `product_view` with a new view-instance ID. Marketplace buttons use `placement: product_modal`; static detail pages continue using `product_detail`. Closing the popup disconnects its visibility observers and event handlers.

### Search

```text
Submit query → /api/search → validate and rate-limit
                             ↓
                 parse budget/colour/material/type/season
                             ↓
                 filter eligible active products
                             ↓
                 keyword ranks + optional query embedding
                             ↓
                 exact vector similarity + rank fusion
                             ↓
                 product IDs + interpreted filters + mode
```

“Under 800” means strictly less than ₹800; “up to 800” includes ₹800. Explicit budget controls can narrow a query budget, never relax it. Known attributes are deterministic filters. Search is submitted, not called on every keystroke. The browser reorders existing static cards and can fall back locally if the API is unavailable.

The semantic path uses `@cf/baai/bge-small-en-v1.5`, 384-dimensional vectors, a bounded query timeout, daily embedding request budget, and exact cosine similarity across the small catalogue. It requires a matching catalogue version and vectors for every active product. Hosted failures or exhausted limits produce keyword results. No LLM generates answers; no separate vector database is needed.

The initial similarity cutoff is a provisional 0.55. **Evaluate it on real products and natural-language queries before launch.** Tests do not establish hosted-model relevance or Hindi/Hinglish support. A five-minute, 128-entry isolate-local query-vector cache avoids repeat AI calls without persisting query text. Conservative spelling aliases work in API and browser search, with a visible interpretation notice. General fuzzy correction, multilingual evaluation and ambiguous-intent handling remain follow-up work.

### Enable real semantic search

1. Configure your Cloudflare account and Workers AI access.
2. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your terminal. Use a narrowly scoped token with Workers AI permission; do not write it into source files.
3. Run `pnpm run build`, then `pnpm run embeddings`.
4. Change `SEMANTIC_ENABLED` to `true` in your deployment configuration.
5. Rebuild. Deploy or run a correctly authenticated AI-bound preview.
6. Verify returned `fallback: false`, meaningful relevance, and hard-filter correctness on real queries.

Product text hashes avoid unnecessary re-embedding. Price-only changes reuse vectors, but the artifact must still be regenerated to record the new catalogue version. Local AI bindings call Cloudflare remotely when enabled and can incur usage charges.

## 5. Consent → tracking → storage

```text
Accept analytics → /api/identity → random visitor ID + HttpOnly credential cookie
       ↓
Browser events → batches of up to 10 → /api/events
       ↓
same-origin check → credential check → schema/product/offer validation
       ↓
D1 INSERT OR IGNORE by event_id → retries cannot duplicate the event
```

Declining leaves catalogue and search functional. No events are queued before consent. Preferences are stored locally when browser storage permits; sessions use sessionStorage with a 30-minute inactivity boundary. Storage failures degrade without breaking browsing. The credential expires after 90 days. It identifies a browser, not a person.

Core analytics events are `page_view`, `product_view`, `search`, `search_result_click`, `marketplace_button_impression`, `marketplace_click`, `filter_usage`, and `sort_usage`. Marketplace-specific events are represented by `marketplace_id`, avoiding double-counting. Common fields include event/session/page-view IDs, occurrence time, path, catalogue version, and applicable product/search IDs. The server supplies visitor identity and receipt time.

Marketplace impressions require 50% visibility for one second. Events have bounded in-memory retry queues, with unchanged event IDs and a one-minute retry lifetime. Telemetry can still be lost on navigation, blockers, outages, or denied consent. The dashboard represents tracked activity, not all site visitors.

Search text has email, phone-like number, and URL redaction. This is a basic safeguard, not a guarantee of removing all personal information. Do not enter personal data into searches. Query text is entirely removed from archived events.

## 6. Database and dashboard

| Table               | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `visitors`          | Random browser IDs, hashed deletion credentials, expiration          |
| `events`            | Deduplicated recent events; source for 7/14/30-day dashboard queries |
| `daily_metrics`     | Additive daily counts by event, product, marketplace                 |
| `counters`          | Expiring request and embedding-budget counters                       |
| `job_runs`          | Last successful maintenance completion                               |
| `archive_manifest`  | Verified raw exports, dates, counts                                  |
| `deletion_requests` | Archived-history deletion progress and tombstones                    |

Visitors, sessions, searches, and marketplace clicks are derived from events, not separate editing tables. The first dashboard reads the recent raw window, while longer-lived aggregate counts provide a later reporting foundation.

The owner dashboard is at `/internal/`; `/internal/api/metrics?days=7` returns its data. Both require authentication. Production validates the Cloudflare Access JWT signature, issuer, audience, expiration, and the configured owner email. No secret is sent to storefront JavaScript. Unauthenticated requests receive 401, including direct Worker URLs.

Metrics include tracked browsers, sessions, product views, searches, marketplace clicks, per-product counts, marketplace choices, redacted popular queries, zero-result counts, a view-to-click funnel, and last maintenance time. Empty datasets show empty states rather than invented data.

The funnel counts distinct product/session pairs with a product view and later marketplace click within 30 minutes, divided by viewed product/session pairs. **A click is not a purchase.** Distinct visitors are calculated over the selected raw window, never by adding daily unique counts. Dashboard windows start at midnight in Asia/Kolkata and include today so far plus the preceding 6/13/29 days. Storage timestamps, archive partitions and historical daily aggregates remain UTC.

## 7. Archives, deletion, and maintenance

Hourly Cron invokes `workers/jobs.ts`:

1. Export up to four closed receipt-date partitions older than four days to private R2 NDJSON files.
2. Remove search text from archive payloads and verify the stored file against the export.
3. Continue pending browser-history deletions, processing 30 archive objects per request per run, up to five requests per run.
4. Remove archives older than 180 days.
5. Refresh recent daily counts and remove hot events older than 30 days **only when their receipt-date archive is verified**.
6. Expire visitor credentials/counters and remove aggregates older than 730 days.
7. Record successful maintenance completion.

Archive failure prevents unsafe hot-event deletion. A backlog can exceed the usual retention window until exports catch up; monitor `job_runs` and storage. At the intended 180 daily partitions, one deletion typically needs at most six hourly runs, but service failures/backlogs can extend that. The UI says normally within 24 hours, not an unconditional guarantee.

“Delete this browser’s history” uses possession of the HttpOnly credential: recent events and the credential are removed immediately, and archived deletion is queued. An arbitrary visitor ID cannot authorize deletion. Already non-identifying historical aggregate counts may remain. Tombstones must accompany backups and be reapplied during restores so old data does not return.

To exercise maintenance locally, start preview with `pnpm run preview --test-scheduled`, then visit `http://127.0.0.1:8787/__scheduled`. Local jobs use local storage. This debug route is supplied by Wrangler, not deployed application code.

## 8. Deploy to your own Cloudflare account

This project intentionally follows the Astro/Cloudflare architecture in your brief; it does not require Sites hosting.

1. Replace demo content, domain, photography, branding, privacy contact details, and marketplace links. Set `data/site.json.demo` and each real product's `demo` to false.
2. Sign in using `pnpm exec wrangler login`.
3. Create a D1 database: `pnpm exec wrangler d1 create catalogue-analytics`. Put its returned database ID into `wrangler.jsonc`.
4. Create a private R2 bucket: `pnpm exec wrangler r2 bucket create catalogue-private-events`. Keep public access disabled.
5. Configure a Cloudflare Access application covering `/internal` and `/internal/*`, with an owner-only policy. Set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `OWNER_EMAIL`. The Worker validates Access independently of the edge policy.
6. Set `ENVIRONMENT` to `production`, configure the AI binding and embedding budget, and use `pnpm exec wrangler secret put RATE_SALT` to save a long random rate-limit salt.
7. Generate embeddings and enable semantic search as described above.
8. Apply migrations: `pnpm exec wrangler d1 migrations apply catalogue-analytics --remote`.
9. Run `pnpm run check`, `pnpm run test`, and the local integration/browser checks.
10. Run `pnpm run deploy`, attach your domain, and smoke-test search, links, consent, private authentication, and scheduled maintenance.

Do not upload `.dev.vars`, local database state, or test screenshots. Development and production must use separate resources. Configure rate limits at Cloudflare's edge as well as the application counter; a determined attacker can rotate IPs. The database budget gate limits hosted embedding requests, not every possible infrastructure charge. Verify current provider pricing and limits before enabling paid services.

The local owner token only works with development configuration on loopback hosts. The production API refuses requests when its rate-limit secret is absent. Secrets stay in Worker bindings. CORS/origin checks are supplementary controls, not authentication. Third-party pages cannot authorize private analytics access.

## 9. Recovery and troubleshooting

- **No search results:** check active status, offer prices, parsed filters, attributes, and catalogue build. Strict budgets are never broadened automatically.
- **Keyword fallback:** check the semantic flag, generated embedding version, model vectors, AI binding/account permissions, budget, and provider availability.
- **No analytics:** confirm consent, use the Worker preview rather than Astro-only dev, apply migrations, and check event API responses. Preview/test traffic stays in the local database.
- **Dashboard 401:** check Access team domain/audience/email, policy coverage, and the logged-in owner. Locally, supply the generated bearer token.
- **Missing dashboard counts:** analytics is opt-in and may undercount; don't compare raw clicks to marketplace order totals as if equivalent.
- **Stale maintenance:** inspect Cron and Worker failures, then rerun jobs. Do not manually delete hot events before checking their archive.
- **Broken marketplace link:** set its URL to null or availability to unavailable and rebuild/deploy. The public catalogue keeps working independently of analytics.
- **Rollback:** keep source-control releases and previous Worker deployments. Roll back application code with backward-compatible database migrations; never assume a code rollback reverses a schema migration.
- **Restore:** restore D1 and private raw exports into a separate environment, apply deletion tombstones, validate counts, then switch traffic. Offline event-restore preparation and a 24,000-event isolated drill are available below; a full cloud backup/restore exercise is still required before launch.

## 10. What comes next

The first release foundation is implemented, but it is not a production sign-off. Remaining launch work includes real content, live AI evaluation, cloud authentication/resource setup, policy/contact finalization, external health-monitor setup, a cloud backup/restore exercise, and accessibility/performance measurement on real devices. See [implementation status](../docs/IMPLEMENTATION-STATUS.md) for the current breakdown.

The simple recommendation/session-preference and experiment infrastructure, website-interest reports and actual sales/inventory imports are now implemented above. Learned ranking, long-term personalization and advanced inventory forecasts remain evidence-dependent future work. There are still no customer accounts, on-site purchasing or product-editing CMS.

### Reference documentation

- [Astro installation](https://docs.astro.build/en/install-and-setup/)
- [Cloudflare Worker static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Workers AI embedding model](https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)

The original architecture discussion and project summary are preserved in `../docs/architecture-chat.md` and `../docs/project-memory.md`. This README describes the implemented code; when it differs from the proposal, the difference is stated above.

### Development notes

`src/lib/product.ts` holds browser-safe display and pricing helpers. It is separated from schema validation so the storefront does not download the validation library. Poppins is self-hosted: `scripts/fonts.mjs` copies the licensed 400/500/600/700 Latin WOFF2 fonts and their license from `@fontsource/poppins` into `public/fonts/` during builds. The storefront and internal dashboard use them without sending font requests to Google.

Static category pages are available at `/categories/clothing/`, `/categories/accessories/`, and `/categories/home/`. Category names on cards link to them. Homepage category controls filter the current collection without navigation.

For browser checks using an existing Chrome installation, set `BROWSER_CHANNEL=chrome` in your shell instead of downloading Playwright Chromium. PowerShell example: `$env:BROWSER_CHANNEL='chrome'`, then `node tests/browser.mjs`. The browser checks cover interactions and horizontal overflow, not a complete accessibility certification.

`node tests/maintenance.mjs` checks archive export, removal of query text, and archived-history deletion. Run it only against the disposable local database with preview's `--test-scheduled` flag; it writes and removes test fixtures. Never point test scripts at production data.

`pnpm exec wrangler deploy --dry-run --outdir work/worker-build` compiles deployment output without publishing. A successful dry run does not verify real Cloudflare credentials, owner Access configuration, or live AI relevance.

### Design and product previews

- `src/styles/global.css` contains base layout rules; `src/styles/refinement.css` provides the rounded Poppins theme, spacing, hover lift, frosted popup, and responsive adjustments.
- `src/components/ProductDialog.astro` is the shared popup shell. `src/scripts/product-dialog.ts` fills it from the generated catalogue using safe DOM text, controls the carousel and focus, and restores the previous scroll position.
- `src/scripts/interactions.ts` manages the header search shortcut and optional hover video playback. `src/scripts/tracking.ts` exports reusable offer tracking for both static pages and popups.
- The header uses “Explore all”, taxonomy categories, and a search shortcut. The buying guide remains available in the footer.
- Product cards lift and grow as a whole on mouse hover. Buttons, navigation, carousel changes, and popup entrances have restrained transitions. Reduced-motion preferences disable animation and card scaling.
- Change the company name in `data/site.json.name`; shared headers, footer, and page metadata read it. The confirmed company name is Shishu care.

To add photographs, append image objects to a product's `images` array and put the files in `public/images/`. Array order sets carousel order. P101–P107 each have a fallback illustration for pink, blue, and cream.

For future hover video, put an owned MP4 or WebM in `public/videos/`, then add this optional field to its product JSON:

```json
"video": { "src": "/videos/P001.mp4" }
```

Rebuild after changes. Validation checks the video path and file. Clips are muted, loop inline, and are fetched only on eligible mouse hover; they pause on pointer exit, off-screen visibility, hidden tabs, and popup opening. Touch-only devices, reduced-motion users, data-saving connections, and playback errors retain the product photograph. No sample video or third-party embed is inserted automatically.

### Palette and promotion (18 September 2026)

The active palette is soft baby pink, with pale pink buttons and offer bar, nearly white pink surfaces, and neutral readable text. In `data/site.json`, set `theme` to `green-original` to restore the previous green palette, `warm-blush` for the previous deeper rose version, or `baby-pink` for the current version, then run `pnpm run build`. This preserves the new brand, offer bar, interactions, and scrollbar. Original CSS and site settings were saved before editing in `../docs/design/green-original/`.

`src/styles/palette.css` supplies the warm color values. Base styles retain the exact original green values as fallbacks; palette token suffixes identify those original colors. `src/styles/delights.css` handles the offer bar, cascading arrows, small hover effects, and inset rounded popup scrollbar. Marketplace identity colors remain distinct.

Edit `promotion.percent` and `promotion.code` in `data/site.json` to change the top banner. Currently it displays **10% off** with **MOTHERSBLESSING**, as requested. This displays the promotion; it does not create a redeemable marketplace coupon or apply discounts. Configure the actual promotion with the selling marketplace before launch. The footer demo line was removed at your request. Illustrations remain labelled, product descriptions explain the preview, and production checks still block sample content.

The discovery arrows stay still until their link is hovered or keyboard-focused, then pulse down in sequence. Reduced-motion preferences disable this and other animations. The popup scrollbar remains scrollable with touch, wheel, and keyboard; its close control stays visible while scrolling.

Run `node tests/design.mjs` against the local preview for brand, coupon, palette rollback, arrow motion, and scrollbar checks (set `BROWSER_CHANNEL=chrome` to use installed Chrome).

### Baby catalogue, colours, and menus

The seven active items are Caps, Baby shawl (interpreting “Baby shall”), Socks, Diaper sets, Baby bibs, Sleeping mat, and Baby swaddle. They use new IDs P101–P107. Old sample products P001–P008 are archived so their identities are never reused. Category URLs remain stable, with display names Baby wear, Little essentials, and Wraps & mats.

Each card, product popup, and direct detail page has pink, blue, and cream swatches. These are suggested preview colours, not confirmed stock. Choosing a card swatch changes its illustration and carries the choice into the popup. Popup swatches and carousel controls stay synchronized. The choice does not select a marketplace variant or change a purchase URL; customers must confirm the colour on the marketplace. Temporary preview prices are ₹100–₹200, as requested. Replace them with confirmed marketplace prices before launch. Products with unknown prices remain excluded from budget-limited searches.

Each product uses explicit `colour_variants`, one entry per colour with its own `photos` array and `illustration`. Carousel arrows, thumbnails, and swipe cycle only through the selected colour’s images. Choosing a colour resets its photo position. One-image galleries hide arrows/thumbnails. Card and direct-page swatches show the first image of the chosen colour.

`src/scripts/controls.ts` enhances native budget/sort selects with styled listboxes. Native selects remain the source of truth and the no-JavaScript fallback. Menus support click, arrows, Home/End, letter navigation, Enter/Space, Escape, outside dismissal, and filter reset. `src/styles/controls.css` supplies their opening animation, swatches, and hover details; reduced-motion settings disable animation.

The product illustrations are local SVG design placeholders, not photographs or verified product specifications. Replace them with your product photography and confirmed materials, sizes, prices, colours, and marketplace listings before launch. The tagline is “Ek maa ki pahli pasand”.

Run `node tests/controls.mjs` for menu and colour flows in addition to the existing browser/API tests. Historical search boundary tests now use a dedicated legacy fixture; `baby-search.test.ts` checks all seven current product types and the unknown-price budget rule.

### Photos, illustration fallback, and temporary prices

Set `illustration_fallback` to `true` (default when omitted) in each product JSON to use its colour-specific illustration when no photo exists. Set it to `false` to show a neutral “Photo coming soon” placeholder instead. Real photos always take priority. Missing files are excluded from generated variant galleries at build time, with a warning; browser load failures also fall back without retry loops. Illustration files themselves must exist.

Example within a product JSON (paths must be local files in `public/images/`):

```json
"illustration_fallback": true,
"colour_variants": [
  {
    "colour": "pink",
    "photos": [
      { "src": "/images/caps-pink-front.jpg", "alt": "Pink cap, front view" },
      { "src": "/images/caps-pink-back.jpg", "alt": "Pink cap, back view" }
    ],
    "illustration": { "src": "/images/P101-pink.svg", "alt": "Illustrative pink cap preview" }
  }
]
```

Use an empty `photos` array until photography is available. Repeat for every colour listed in `attributes.color`. The legacy top-level `images` field remains supported for products without `colour_variants`; it is empty for the current baby products. `src/lib/gallery.ts` resolves gallery contents consistently for cards, direct pages, and popups. Colour shade values remain in `ColourChoices.astro` and `product-dialog.ts`.

Temporary prices: Caps ₹100; Baby shawl ₹180; Socks ₹120; Diaper sets ₹200; Baby bibs ₹130; Sleeping mat ₹190; Baby swaddle ₹170. These values are stored in paise on each offer. Marketplace links remain disabled until real URLs are supplied.

The tagline uses a local system serif italic (Georgia with Times New Roman fallback), while the rest of the site remains Poppins.

Discovery arrow alignment: the link vertically centres its text and fixed-size icon circle. Chevron hover motion cascades down and re-enters from above; it stays still at rest and respects reduced-motion preferences. Styles are in `src/styles/delights.css`.

Arrow hover uses explicit pointer/focus Web Animations in `src/scripts/interactions.ts`. It moves sequentially downward normally and provides an opacity-only cascade when the host reports reduced motion, avoiding the global CSS animation suppression. Pointer exit/blur cancels it immediately.

Popup close feedback: the cross turns and gently enlarges once on pointer hover or keyboard focus. Reduced motion uses a short opacity cue. Leaving the control or closing the popup cancels the effect; closing behavior and the sticky button position are unchanged.

### Parent notes on cards

A full-width Parent notes row sits below each card's colour choices, separated by a light divider. Price appears directly below the product name; swatches retain their normal size. This avoids squeezed review text on mobile. It uses a short parent story rather than stars or counts. With no review supplied it reads “Awaiting our first story”; no testimonials are invented. To publish a genuine review excerpt, add optional `parent_note` to that product JSON with `excerpt` (5–90 characters) and `attribution` (2–40 characters), then rebuild. Use only a real review you have permission to display; attribution is public, so avoid private customer details. Omit the object to show the empty state. Curated JSON notes remain supported; the optional review service below now also supplies approved customer notes. Layout and hover styling are in `controls.css` and `ProductCard.astro`.

## Mannpasand, parent experiences, and contextual results

### Mannpasand

The header link immediately left of search opens `/mannpasand/`. Heart buttons on cards, direct product pages, and product popups save/unsave a product. Saved IDs use `shishu-mannpasand-v1` in localStorage, scoped to this browser. Other tabs update through storage events. No accounts, server wishlist, checkout, or carts are introduced. Storage failure shows a message and keeps selections for the current page only. Unknown/removed product IDs are ignored. Remove products on the Mannpasand page to clear them. `SaveButton.astro` and `scripts/mannpasand.ts` implement this flow.

### Search and refinement

`components/Catalogue.astro` now shares listing/search markup between the homepage and category pages. The homepage refinement bar is hidden initially and appears after a nonempty search or active filters; clearing results hides it again. Category listings show it by default and reset to their own category. It is a compact category/price/sort control row, not a second navigation menu.

Recognized colour filters such as “blue baby caps” select the matching metadata-backed swatch and actual variant image/fallback. A subtle border uses that swatch colour. No image pixels are recoloured. Metadata without a matching explicit variant is not visually fabricated. Clearing the query removes its colour accent and resets query-selected swatches. Type, material, price and other filters continue to appear in the applied-filter description.

### Optional reviews

`components/Reviews.astro` adds a collapsed “Share an experience” form to direct pages and the product popup. It asks for a display name, optional preset avatar (or initial), a rating and a short note. There is no photo upload, login, purchase claim, or immediate outbound-click prompt. All content is displayed as plain text. Cards show a short editorial excerpt with a tiny avatar and reviewer name; full notes appear on product views without star/count badges.

The browser stores first product-view times and one-time reminder state in `shishu-experiences-v1`. After at least 24 hours, a return visit may change the collapsed link to “Bought this? Share your experience.” once per product. No popup opens automatically, and no marketplace click implies a purchase. If storage is unavailable, passive reminders are suppressed. Users can always choose the normal form themselves. This functional local state is separate from consent-gated analytics.

Submission requires explicit public-display consent and sends only review fields to `/api/reviews/submit`. The server validates the active product, field lengths, avatar, rating, honeypot and same-origin request; it applies the existing request limiter plus three submissions per daily salted network key. These basic anti-abuse controls do not establish identity or purchase verification. Responses return a withdrawal key, stored only in this browser. The form hides after submission and offers “Withdraw my note”; withdrawal removes pending or published notes. Clearing browser storage loses the withdrawal key, so the owner can also remove notes.

### Review storage and owner moderation

Apply `db/migrations/0002_reviews.sql` using `pnpm run db:local` locally, and apply the same new migration to the production D1 before deploying these routes. `product_reviews` stores submissions separately from analytics. New notes are pending and never returned publicly until approved. Notes remain until the author withdraws them or the owner deletes them; rejected notes remain private until owner removal. Include this workflow and a contact-based removal route in the final launch privacy policy.

The authenticated dashboard links to `/internal/reviews`. The owner can publish, keep private, or delete notes. It uses the same Cloudflare Access/local bearer authentication as analytics; local browser access needs the configured Authorization header. Both public and owner writes reject cross-origin requests. Public review responses contain no withdrawal hashes or private verification fields. Keep negative but relevant experiences; moderation is for privacy, abuse and relevance, not sentiment.

`verification_status` defaults to `unverified`, with reserved `verification_source` for a future trusted marketplace integration. Public submissions cannot set either field, and the current UI never labels a review “Verified Purchase”. Establish a trusted backend verification process before enabling such a designation.

### New files and checks

- `src/scripts/reviews.ts`: prompts, forms, approved-note rendering and withdrawal.
- `workers/reviews.ts`: submission validation, public queries, and private moderation page.
- `src/styles/community.css`: responsive header, save controls, review layout and result accents.
- `tests/community.mjs`: end-to-end search, Mannpasand, review/moderation/withdrawal, categories, mobile and marketplace states.
- `tests/review-api.mjs`: validation, rate limit, protected moderation, spoofed verification rejection and withdrawal-token checks.

Both new test scripts target only the disposable local preview and clean up their review fixtures. Existing demo offers still have null URLs; the three marketplaces remain visible but disabled. Actual checkout navigation must be checked again once real listing URLs are supplied.

### Butter-yellow visual update

The active theme is now `butter-yellow`: pale yellow accents, ivory surfaces and warm neutral text. `baby-pink`, `warm-blush`, and `green-original` remain available through `data/site.json.theme`. Rebuild after switching. Product swatches and illustrations retain their actual variant colours. The header search shortcut was removed; the main catalogue search and Mannpasand remain available.

The homepage tagline reads “A mother’s first choice.” in large serif italic English type. Supporting copy reads “Thoughtfully chosen for little ones, with a mother’s care in mind.” The butter-yellow promotion and buttons are slightly deeper, with muted terracotta-red hearts, coupon text and tagline spark. `HeartIcon.astro` supplies a consistent SVG heart for the header and save controls; saved hearts fill through `aria-pressed` styling. Mannpasand opens with “KEPT CLOSE, BECAUSE IT MATTERED”.

### Quiet ambient particles

`src/components/AmbientParticles.astro` is shared by the homepage hero (12 motes), Mannpasand intro (7) and the shared footer (4). Presets control placement, opacity, speed and drift range; sizes are 3–4.5px. The existing palette supplies their colour. Mobile positions move into the outer gutters and the hero reduces to 8 motes. Product grids, images and search controls contain no particles.

`src/styles/ambient.css` clips an absolutely positioned, pointer-transparent decorative layer behind content. Only particles animate: a 2.6-second entrance followed by small, slow transform/opacity changes on staggered 18–39-second drift cycles (slower in the footer). Unequal drift and fading periods avoid a synchronized repeat. No text, layout, copy or existing colours change.

`src/scripts/ambient.ts` uses one IntersectionObserver plus visibility/preference events to pause offscreen or hidden-tab animations. There is no per-frame JavaScript, canvas, network request or new dependency. Reduced motion shows only 4 static motes per intro and 3 in the footer; it disables all particle movement and fading. Without JavaScript or IntersectionObserver the decorative layer stays invisible and the page remains functional.

Run `node tests/ambient.mjs` against the local preview (installed Chrome by default) for entrance/idle, pause/resume, reduced motion, search, product popup, demo marketplace availability, saved/empty Mannpasand and responsive overflow checks. Current marketplace URLs remain unset, so real outbound navigation still requires approved listings.

Particle visibility was tuned after Chrome inspection: stronger soft centres, 50–72% layer opacity, and roughly 24–28px horizontal drift make the ambient effect perceptible while retaining sparse density and static reduced-motion fallback.

### Branded homepage entrance

On the first homepage entry in a tab session, a temporary centred Shishu care wordmark receives a blue droplet on its first i, makes a 3% pop and travels into the real header wordmark while an ivory backdrop fades. The 2.4-second sequence uses native Web Animations; no library, loading indicator or individual-letter animation. `BrandName.astro` draws the first i with a separate blue dot, which remains on the header across pages. The existing header symbol and page layout remain in place.

`brand-entrance.ts` waits briefly for the existing Poppins font, clones the header wordmark and measures its actual destination. Only the clone transforms; the backdrop reveals the unchanged page. Keyboard input, resizing, scrolling, backgrounding or reduced-motion changes immediately clean up the intro and restore interactions. No-JS, blocked session storage, missing/slow fonts and reduced-motion entry show the normal page. A fail-open timeout prevents a stuck overlay.

The inline head guard uses `shishu-brand-entry-v1` in sessionStorage. Refreshes and internal navigation do not replay the entrance; opening another internal page first also marks the session seen. This is functional session state, independent of analytics consent. For a fresh preview, open the homepage directly in a fresh Chrome tab/session with motion permitted; the in-app preview currently reports reduced motion and intentionally skips the entrance.

Run `node tests/brand-entrance.mjs` for desktop/tablet/mobile alignment, timing stages, blue dot, repeat-entry rules, reduced motion and failure/interaction cleanup. Existing browser checks cover search, dialogs, marketplace states and Mannpasand after entry.

Preview troubleshooting: if HTML loads but hashed CSS assets return 404 after edits/builds, restart the local Wrangler preview and open a fresh preview URL. This can be a stale preview asset index rather than a CSS syntax error; preserve the source styling.

Search layout: the submit button spans the input/help-text rows on desktop, centering it vertically in the full search band while retaining its right alignment. Mobile retains the stacked full-width button.
