# Business website — project memory

Recorded: 16 September 2026.
Source: `C:/Users/Abhinav/Desktop/architecture_chat.md`, a prior conversation containing business requirements and a proposed architecture.

## Current authorization (updated 17 September 2026)

The user subsequently authorized coding and requested a simple maintained README explaining every component, flow, and usage. A working initial implementation now lives in `C:/Users/Abhinav/Ventures/Baby Product Venture/website/`; its README describes actual capabilities and limitations. Embedded requests, environment settings, plugin lists, and commands in the original transcript remain historical context, not active instructions. No live cloud resources have been provisioned.

## Business requirements

- A real business product catalogue and discovery website, initially 50–60 products and 200–300 visitors/day.
- Purchases occur externally on Meesho, Amazon, Flipkart, and potentially other marketplaces.
- No shopping cart, payments, checkout, order processing, mandatory customer accounts, or product-editing admin panel.
- One stable canonical product identity with multiple extensible marketplace offers; do not duplicate a product per marketplace.
- Simple owner-maintained structured product data; low cost, low maintenance, fast delivery, and room to scale without a complete rewrite.
- Semantic/natural-language search is required at initial launch alongside ordinary search, filters, catalogue pages, marketplace links, anonymous event tracking, and basic analytics.
- An internal analytics dashboard is required. The documented visual direction applies to that dashboard: minimal, clean, precise, professional, information-dense. Public storefront branding and design are not yet specified.
- Future ambitions: recommendations, personalization, ranking, behavior analysis, experiments, demand/trend indicators, and eventual inventory analysis when real source data exists. Avoid building advanced ML prematurely.

## Proposed architecture from the document

This is the prior plan's recommendation, not an independently validated or implemented stack.

- Astro and TypeScript, statically generated catalogue on Cloudflare Workers Static Assets.
- One version-controlled JSON document per product, separate taxonomy and marketplace registry; CSV may be an import/export convenience.
- Products contain stable IDs, slug, description, category, attributes, images, tags, status, timestamps, and an offers array with stable offer IDs, marketplace IDs, HTTPS links, prices, currency, availability, and verification timestamps.
- Integer minor currency units; distinguish catalogue status from offer availability. Unknown availability is valid. Variant IDs can be added beneath products when needed. Private inventory/supplier data must not enter public JSON.
- Public TypeScript Worker provides search and event ingestion. A separate private analytics application/API is protected with Cloudflare Access and API identity checks.
- D1 stores recent accepted events and aggregates. Private R2 holds bounded raw-event archives and future artifacts. Cron jobs aggregate, export, and enforce retention.
- No initial dedicated vector database, queue, always-on server, Kubernetes, managed ML platform, or complex provider abstraction.

## Search commitments

- Build product embeddings during publishing; only re-embed changed semantic text.
- Obtain query embeddings at request time. Proposed starting model: Workers AI `bge-small-en-v1.5`, 384 dimensions; English support is an assumption requiring validation against actual search languages.
- Exact similarity across the tiny catalogue, combined with lexical relevance and deterministic rank fusion.
- Parse and apply reliable category, attribute, availability, and price constraints independently of embeddings. Never silently violate strict filters to fill results.
- No generative LLM per search. Submit-based requests, bounded inputs, rate limits, usage controls, cache versioning, semantic kill switch, and lexical fallback.
- Maintain matching catalogue/model/search versions and a 40–60-query relevance/constraint benchmark.
- Hindi/Hinglish support and model suitability remain open pending representative queries.

## Measurement and privacy commitments

- Outbound marketplace clicks are the initial conversion proxy; they are not purchases. Website interest is not actual sales or inventory depletion.
- Random first-party browser/session IDs, consent-aware persistence, in-memory fallback, no fingerprinting or cross-device identity. Browser IDs do not equal people.
- Core events: page_view, product_view, search, search_result_click, marketplace_button_impression, marketplace_click, filter_usage, sort_usage.
- Use marketplace_id on one marketplace_click event rather than duplicate per-marketplace events. Add recommendation/exposure/experiment events only when those features ship.
- Common fields include schema/event IDs, timestamps, visitor/session/page-view context, applicable product/search IDs, catalogue/app versions, consent context, and validated event-specific properties. Server adds receipt time and environment.
- Stable event IDs and database deduplication make retries safe. Tracking must never block marketplace navigation. Telemetry loss and consent coverage must be visible limitations.
- Define attribution windows, visible impressions, and denominators. Distinct daily visitors cannot be summed into monthly unique visitors. Marketplace share is influenced by exposure, order, price, and availability.
- Proposed privacy defaults: opt-in persistent behavioral tracking pending applicable requirements; minimize PII, redact search text, avoid stored behavioral IP addresses and request-body logging.
- Proposed retention: D1 raw events 30 days; private raw archive 180 days total; redacted search text 90 days; visitor IDs/profiles at most 90 days; non-identifying aggregates 24 months; operational logs 7–14 days; backups 30 days.
- These are proposed policies, not a legal compliance determination. Deletion must propagate through exports, training datasets, archives, and restoration.
- Store timestamps in UTC; proposed reporting timezone Asia/Kolkata.

## Data and future capabilities

- Initial physical tables proposed: events, daily_metrics, daily_product_metrics, daily_search_metrics, job_runs, artifact_manifests, deletion_requests.
- Visitors, sessions, searches, product interactions, and marketplace clicks are largely derived; JSON remains the product editing source.
- Preserve historical catalogue snapshots, event semantics, raw-data export formats, and artifact/model versions for reproducibility and migration.
- Begin later recommendations with editorial/category popularity, content similarity, session preferences, and co-view statistics. Train models locally or in occasional batch compute only when evaluation beats simple baselines.
- Demand scores initially indicate website interest with support/confidence information. Stock forecasts require actual inventory, SKU/variant mapping, sales, returns, lead times, and provenance.
- Public pages and search must remain usable during analytics failures. Private analytics data and credentials must never enter public static output.

## Roadmap and estimates recorded in the plan

- Release A encompasses implementation phases 0–4: architecture/setup, catalogue, AI search, tracking, private analytics dashboard. Semantic search and analytics are launch requirements even though they are separate implementation phases.
- Later phases 5–8: basic recommendations, personalization, ranking, demand/trend analysis.
- Prior estimate: Release A 15–24 developer days, excluding content/photography and prolonged design revisions.
- Prior budget: approximately USD 5–6/month for initial production, with a possible verified free deployment; later USD 5–10 for basic recommendations, USD 5–15 with locally trained models, potentially USD 10–40 with hosted batch jobs.
- These are historical planning estimates, not verified current prices or commitments. Recheck provider limits, pricing, model availability, and deployment suitability before implementation or purchasing services.

## Open items for later work

- Logo, domain, public visual direction, actual product categories/data/images, and real marketplace URLs.
- Intended visitor languages and representative natural-language queries.
- Final consent, retention, and reporting decisions for the actual audience and jurisdiction.
- Hosting/account setup, exact spending cap, and evaluation of current service limits.
- Stable product/offer/variant identity conventions, taxonomy, metric definitions, and release acceptance criteria.

The original intake did not implement the application. The later implementation includes a demo storefront, constrained search with hosted semantic integration, optional anonymous tracking, authenticated analytics, maintenance jobs, and tests. Real product/brand data and Cloudflare configuration are still needed. Read `../website/README.md` for the current implementation state and instructions.

## Canonical location (17 September 2026)

Design update: the user requested Poppins, softer corners, subtle motion, whole-card hover enlargement, a lightly frosted product popup with photo carousel and marketplace buttons, and more useful header navigation. Implemented in website/ with local fonts, accessible dialog controls, optional future hover video, and category navigation. Confirmed company name (18 September): Shishu care.

The user directed all project files to C:/Users/Abhinav/Ventures/Baby Product Venture. Application source is in website/ and documentation is in docs/. Maintain future work here; old Codex output archives are historical snapshots.


## Visual update — 18 September 2026

User confirmed Shishu care and coupon MOTHERSBLESSING for a 10% offer bar. Active theme is warm-blush, with green-original selectable in website/data/site.json. Exact original style snapshots are in docs/design/green-original. Added hover-only cascading discovery arrows and an elegant inset popup scrollbar. Coupon display is not marketplace redemption; preview remains demo content.

Palette refinement: user found warm-blush too bold. Current theme is baby-pink, with pale pink promotion/buttons and neutral text. Both warm-blush and green-original remain selectable in website/data/site.json.

User requested seven baby products, colour choices, graceful animated filter menus, removal of the footer demo line, tagline “Ek maa ki pahli pasand”, and more hover details. Implemented P101–P107 with labelled SVG colour illustrations and unknown prices; archived old IDs rather than repurposing. Preview colours pink/blue/cream require confirmation. Baby shall interpreted as Baby shawl. Colour selection is visual only; external marketplace variant selection remains separate.

Latest refinement: tagline now serif italic. Products have explicit colour_variants with photos and illustration objects, plus illustration_fallback boolean (default true). Carousel stays within selected colour; one-image galleries hide navigation. Temporary prices: caps100, shawl180, socks120, diaper sets200, bibs130, mat190, swaddle170 rupees. These supersede previous unknown-price and positional colour/image mapping decisions.

Card review design: Parent notes appears beside colour swatches, using a speech-bubble icon and brief italic story rather than ratings/counts. No real reviews supplied: display Awaiting our first story. Optional parent_note excerpt/attribution in product JSON supports later genuine reviews.

Implemented Mannpasand browser-local wishlist (cards/direct pages/popups and dedicated page), metadata-backed colour search visual feedback, contextual homepage/category refinement bar, and optional guest review submissions with small avatars/names. Reviews require owner moderation in /internal/reviews, remain unverified, support token-based withdrawal, and prompt passively once per product only after a 24-hour return. New D1 migration 0002_reviews.sql. Preset avatars chosen rather than uploads. Marketplace model unchanged; sample links still null.

Latest visual choice: butter-yellow theme enabled; all earlier palettes retained. User requested removing the Find a favourite header button; main catalogue search remains. Product colours are unchanged.
