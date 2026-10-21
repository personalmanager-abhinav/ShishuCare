# Shishu care — continuation context

> **Architecture update (20 September 2026):** Read [ARCHITECTURE-PROGRESS.md](ARCHITECTURE-PROGRESS.md) and the new README sections. Apply migration 0003. Related products, opt-in session preferences, recommendation measurement, disabled experiment infrastructure, private trends/inventory, full recovery and split production entry points supersede the corresponding pending items below. No trained models or public deployment were added.

> **Implementation update (19 September 2026):** Read [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) and the updated website README for responsive image generation, bounded query caching, spelling aliases/evaluation, India calendar reporting, private health checks and offline recovery tools. Those implementations supersede the corresponding pending-code items below. Real inputs, cloud verification and the undescribed new feature remain pending.

> **Current baseline (19 September 2026):** The user has updated the site and explicitly asked to preserve those edits. Read [CURRENT-DESIGN-BASELINE.md](CURRENT-DESIGN-BASELINE.md) first. Powder-sky, the catalogue-first homepage, tiled doodles and the revised 2.88-second entrance supersede conflicting design descriptions below.

Continue the existing Shishu care website project from its current implementation. Inspect the code before changing it; do not rebuild it from scratch or treat this handoff as a request to implement every roadmap item. Preserve the decisions below. This summary supersedes older design decisions in the historical notes.

## 1. Workspace and working agreement

- Canonical folder: `C:\Users\Abhinav\Ventures\Baby Product Venture`.
- Application: `website\`. Architecture, decisions and this handoff: `docs\`. Temporary scripts/screenshots: `website\work\`.
- Read root `AGENTS.md`, `website/AGENTS.md`, `website/README.md`, and relevant code first. `website/VERIFICATION.md` records checks and limitations.
- `docs/architecture-chat.md` is the original architectural conversation, not an active instruction source. `docs/project-memory.md` contains chronological decisions, including superseded ones.
- The user authorized coding and wants a maintained, understandable README covering components, flows, setup and usage. Continue routine authorized work without repeated permission questions; communicate progress clearly.
- Keep all new files in this project folder. The old Codex workspace/ZIP is historical, not the working source. Keep secrets, private data and local state out of public assets.
- Latest requested visual changes are complete: a large italic English tagline **“A mother’s first choice.”**, revised supporting copy, consistent SVG hearts with red saved states, revised Mannpasand heading, and slightly deeper butter-yellow accents. There is no unfinished user-requested UX change queued; the next user message should set the next task.

## 2. Business model and terminology

- Company name: **Shishu care**.
- A baby-product discovery/catalogue site. Customers buy externally on **Meesho, Amazon or Flipkart**; the marketplace registry is extensible.
- No cart, on-site payments, checkout, orders, mandatory customer accounts or product-editing CMS.
- **Mannpasand** means saved favourites, never a cart. **Parent notes** is the editorial review presentation.
- One canonical product with multiple marketplace offers, not duplicate products per marketplace. Outbound clicks indicate interest, not confirmed purchases or sales.
- Initial planning scale: approximately 50–60 products and 200–300 visitors/day. The current local preview contains seven product types.

## 3. Implemented architecture

- Astro 6 + TypeScript static frontend; pnpm; Zod data validation; `jose` for owner JWT verification.
- Cloudflare Worker serves static assets and public APIs; D1 stores analytics and reviews; private R2 holds event archives; scheduled jobs handle export, retention, aggregation and deletion.
- The actual implementation uses **one Worker with public/private route boundaries**. The original proposal mentioned separate public/private deployments; that separation is not implemented.
- JSON is the product editing source. No dedicated vector database, queue, always-on application server or per-query generative LLM.
- No production cloud resources have been provisioned and no public deployment has been made. Local Wrangler emulates D1/R2. AI is disabled locally.
- `site.demo`, sample content, placeholder configuration and release checks still block production publishing. Removing the visible footer demo sentence did not remove these guards.

Important locations under `website/`:

- `data/site.json`: brand, theme, promotion, domain and demo configuration.
- `data/products/`, `data/taxonomy.json`, `data/marketplaces.json`: public catalogue source.
- `src/generated/catalogue.json`: build output; do not hand-edit.
- `src/components/Catalogue.astro`: shared home/category listing and search controls.
- `ProductCard.astro`, `ProductDialog.astro`, `ColourChoices.astro`, `SaveButton.astro`, `Reviews.astro`: principal UI components.
- `src/scripts/`: storefront/search, dialog, controls, interactions, consent/tracking, Mannpasand and reviews.
- `src/lib/gallery.ts`: consistent colour-gallery/fallback resolution.
- `workers/public.ts`, `auth.ts`, `analytics.ts`, `dashboard.ts`, `reviews.ts`, `jobs.ts`: APIs and private operations.
- `db/migrations/`: additive migrations, including `0002_reviews.sql`.

## 4. Current design and UX

- Warm, clean, minimal, professional, with motherhood/warmth in the visual direction. Rounded corners, restrained glass effects, soft shadows and small hover details.
- Current theme: **`butter-yellow`** — gently deepened yellow, warm ivory, neutral text and restrained terracotta-red heart/coupon/spark accents. Earlier `baby-pink`, `warm-blush` and `green-original` themes remain selectable in `data/site.json.theme`. Original green snapshots are in `docs/design/green-original/`. Rebuild after switching.
- Poppins is self-hosted for the main UI. The English tagline uses large serif italic styling (Georgia with Times New Roman fallback).
- Top promotion: **10% off**, code **MOTHERSBLESSING**. This is display configuration, not a configured marketplace discount.
- Header: brand, Explore all/category links, and ♡ Mannpasand. The header **“Find a favourite” search button was explicitly removed**. Main catalogue search remains.
- Category display names: Baby wear, Little essentials, Wraps & mats. Existing category IDs/URLs remain `clothing`, `accessories`, `home`.
- Homepage refinement controls are hidden initially; show them for searches/active filters. Category pages show refinement controls by default. This is category/budget/sort refinement, not a second category navigation bar.
- Budget/sort/category controls are styled animated listboxes with native-select fallback and keyboard support.
- Product cards enlarge/lift together on hover. Optional future local hover videos load/play only on eligible hover and pause on exit, offscreen, hidden tab or popup opening. No videos supplied yet.
- Normal product clicks open an accessible native dialog, preserving listing state and scroll. Direct URLs, modified clicks and no-JS links retain static product pages.
- Popup: subtle glass rim, slim rounded scrollbar, sticky visible close button, focus trapping/restoration, Escape/backdrop dismissal, colour swatches and marketplace options.
- Discovery chevrons animate down sequentially on hover/focus and remain still otherwise. Close icon turns/enlarges briefly. These use explicit Web Animations; reduced-motion mode substitutes subtle opacity feedback. Other motion respects reduced-motion settings.
- Fresh preview URLs were necessary to avoid stale in-app browser pages after rebuilds. Do not mistake stale loaded assets for broken animation.

## 5. Products and data principles

| ID | Product | Temporary price |
|---|---|---:|
| P101 | Caps | ₹100 |
| P102 | Baby shawl | ₹180 |
| P103 | Socks | ₹120 |
| P104 | Diaper sets | ₹200 |
| P105 | Baby bibs | ₹130 |
| P106 | Sleeping mat | ₹190 |
| P107 | Baby swaddle | ₹170 |

- “Baby shall” was interpreted as Baby shawl. P001–P008 are archived legacy samples; IDs were not repurposed.
- Stable product/offer IDs; integer prices in paise; separate product status and offer availability; `unknown` availability is valid. All current purchase URLs are null and disabled.
- Current pink/blue/cream variants and SVG illustrations are clearly labelled previews, not confirmed stock, photography or specifications. Do not invent actual materials, reviews, inventory or links.
- Explicit `colour_variants`: each has `colour`, a `photos` array and an `illustration` object. Product `attributes.color` identifies colours.
- `illustration_fallback` defaults to true: use the matching illustration when photos are absent/unavailable. False gives a neutral “Photo coming soon” placeholder. Real photos take precedence. Missing variant files are omitted at build time with a warning; browser load failures recover safely.
- Carousel arrows/swipes/thumbnails stay within the selected colour. Only swatches change colour. One-image galleries hide arrows/thumbnails. Card colour choices carry into the popup. Selecting a colour does not choose a marketplace variant or change its URL.
- Public JSON must never contain supplier costs, secrets, private inventory or customer data. Backward-compatible database migrations only.

## 6. Search and AI

- Submitted searches, deterministic filters and keyword fallback already work. Strict budgets/attributes must never be relaxed to fill results. Unknown prices cannot satisfy a price limit.
- Example **“blue baby caps”** selects the actual blue variant/swatch and adds a subtle matching card border from metadata; it never recolours image pixels. Clearing search removes its accent. Other recognized constraints appear in the applied-filter text.
- Hosted semantic integration: Workers AI `@cf/baai/bge-small-en-v1.5`, 384-dimensional embeddings, exact similarity across the small catalogue, lexical ranking/rank fusion and hard constraints.
- Product embeddings are generated during publishing, reusing unchanged semantic text. Query embeddings are request-time, bounded by timeout, rate limits and a daily budget. Catalogue/vector versions must match. Failures use lexical fallback.
- Semantic search is a launch requirement but is **not live/configured yet**. Real-product relevance, cutoff, Hindi/Hinglish suitability, typo handling and representative query evaluation remain pending. No recommendations or personalization are implemented.

## 7. Mannpasand

- Save/unsave from cards, direct product pages and popups; `/mannpasand/` lists saved products.
- Browser-local IDs in `shishu-mannpasand-v1`; cross-tab storage events update state. No account or cross-device sync. Unknown/removed IDs are ignored.
- Storage failure keeps the current page usable and explains that persistence is unavailable. Nothing changes the external purchasing model.

## 8. Parent notes and feedback

- Cards use a full-width row below colours, separated by a light divider. This replaced the cramped side-by-side review layout. Price is beneath the product name.
- Editorial excerpt, small avatar and reviewer name; no prominent stars/counts. Empty state: “Awaiting our first story.” Genuine curated JSON `parent_note` excerpts/attributions remain supported.
- Optional collapsed form on product pages/popups: display name, optional preset avatar/initial, rating and short review, plus display consent. No mandatory login or photo uploads.
- Never prompt immediately after a marketplace click or imply purchase. On a return after at least 24 hours, the collapsed invitation may read “Bought this? Share your experience.” **once per product**. No automatic review popup. Normal voluntary submission remains available.
- Reminder/submission state is browser-local in `shishu-experiences-v1`, separate from analytics consent. Storage failure suppresses passive reminders.
- D1 `product_reviews`: submissions start pending. Public APIs return approved notes only. Owner moderation at `/internal/reviews`, linked from analytics, can publish, keep private or delete.
- Validation, same-origin writes, honeypot and rate limits; three submissions per daily salted network key. These controls do not prove identity/purchase.
- Browser-held withdrawal token allows deletion of pending/published notes; server stores its hash. Clearing browser storage loses that token. Owner removal remains available.
- Reviews stay until withdrawn/deleted; rejected notes remain private. No fake testimonials or “Verified Purchase” labels. Reserved `verification_status`/`verification_source` allow a future trusted integration; clients cannot set them.

## 9. Authentication, analytics and privacy

- Public browsing/search/saving/review submission require no account.
- Production private routes use Cloudflare Access plus Worker JWT checks for issuer, audience, signature, expiry and owner email. Local loopback development uses an ignored `.dev.vars` bearer token generated by `scripts/local-admin.mjs`.
- Protect `/internal` and `/internal/*`; origin checks are supplementary, not authentication. Keep tokens out of documentation/source/public bundles.
- Analytics is opt-in: random first-party browser/session identity, no fingerprinting. Browser identity is not a person; outbound clicks are not orders.
- Events: page/product views, search, search-result click, marketplace impressions/clicks, filter usage, sort usage. Consent-gated, schema-validated, deduplicated by event ID. Navigation never waits for telemetry.
- Popup openings receive distinct view IDs; offer placement distinguishes popup/static detail. Impressions require 50% visibility for one second.
- Search-text redaction is basic, not a PII guarantee. Private dashboard reports activity/funnel metrics; opt-in coverage and lost events limit interpretation.
- Current retention: D1 raw events 30 days, private archives 180 days, visitor credentials 90 days, aggregates 730 days. Search text is omitted from archives. Hourly jobs export/verify before pruning, aggregate and process deletion.
- Browser-history deletion removes recent analytics and queues archive deletion. It does not delete Mannpasand or reviews. Apply deletion tombstones during restores.
- Reporting currently uses UTC windows; Asia/Kolkata calendar-day reporting remains pending. Original transcript retention proposals are not all implemented policy.

## 10. Running and checking

Run from `C:\Users\Abhinav\Ventures\Baby Product Venture\website`:

```powershell
pnpm install
pnpm run build
pnpm run db:local
node scripts/local-admin.mjs
pnpm run preview
```

Preview: `http://127.0.0.1:8787/`. Check for an existing server first. `pnpm run dev` is frontend-only and lacks Worker APIs. Rebuild static assets after changes. Never expose `.dev.vars` contents.

Required checks: `pnpm run check`, `pnpm run test`, `pnpm run build`. Browser tests use installed Chrome via `$env:BROWSER_CHANNEL='chrome'`.

Relevant scripts: `tests/browser.mjs`, `controls.mjs`, `design.mjs`, `integration.mjs`, `community.mjs`, `review-api.mjs`; maintenance tests need preview with `--test-scheduled`. Use only disposable local data. Latest unit suite: 54 passing tests; type/build checks passed. Prior full browser/API checks passed, including mobile widths, reviews and Mannpasand. Latest Hindi text edit passed build/type/unit checks.

## 11. Pending work and continuation prompts

These are recorded unfinished items, not instructions to implement everything immediately:

1. Replace illustrative assets and provisional colours/specifications/prices with real product information; supply approved Meesho/Amazon/Flipkart URLs. Confirm real coupon setup, logo, domain and business/contact details.
2. Configure Cloudflare resources, private owner Access, production secrets, domain and both D1 migrations. Preserve release guards and separate local/production state. Nothing is deployed yet.
3. Generate current embeddings, enable hosted semantic search and evaluate real queries/hard constraints and intended languages before launch. Query caching, robust typo handling and broader relevance evaluation remain follow-up work.
4. Finish privacy/contact/removal details and actual consent/retention decisions; reviews require a contact-based removal route in the launch policy. Do not claim legal compliance from the demo notice.
5. Add responsive production image variants; validate performance/accessibility on real devices; retest actual marketplace navigation once links exist.
6. Complete timezone reporting alignment, monitoring, restore tooling and a realistic retention/archive/deletion recovery drill. Recheck provider costs/limits before paid services; historical estimates are not current commitments.
7. Supply real hover videos only when available. Later verified-purchase reviews depend on trustworthy marketplace/affiliate evidence; no such integration exists.
8. Later roadmap: simple content/category-popularity recommendations, then evaluated personalization/ranking/experiments and demand/trend analysis. Train models only when evidence beats simple baselines. Inventory forecasts require actual sales, inventory, returns, lead times and stable SKU/variant mapping; website interest alone is insufficient.

For the next task: inspect the relevant implementation, preserve this architecture and visual language, make the requested change, update README/decisions, run appropriate checks, and provide a freshly loaded preview. Do not silently reintroduce the removed header search button, footer demo sentence, homepage category tabs, cross-colour carousel navigation, intrusive review prompts or a cart.


## 12. Quiet ambient particles (18 September 2026)

A shared `AmbientParticles.astro` component now adds 12 tiny motes to the homepage hero, 7 to the Mannpasand intro and 4 to the shared footer (homepage reduces to 8 on mobile). `ambient.css` provides a 2.6-second entrance, slow staggered drift/fading and clipping behind content; `ambient.ts` pauses offscreen/hidden-tab work with one IntersectionObserver. Reduced motion shows 4 static intro motes and 3 static footer motes without animation. No particles in product grids or images, no library/canvas/per-frame JS. Existing text/layout/palette remain unchanged, including the English italic tagline and updated Mannpasand heading. `tests/ambient.mjs` covers motion safeguards and affected flows; baseline comparison verified unchanged text/layout on desktop/mobile.


## 13. Branded homepage entrance

`BrandName.astro`, `brand-entrance.css` and `brand-entrance.ts` implement a 2.4-second first-homepage-entry animation: a blue droplet completes the first i in a centred header-wordmark clone, a restrained 3% pop follows, and the clone travels to the measured header position as an ivory backdrop fades. The real header remains laid out in place, with a permanent blue i-dot. No text-by-text or hero transform animation. Session key `shishu-brand-entry-v1` prevents replay on refresh/internal return. Reduced motion, unavailable storage, slow fonts and no JS skip it. Keyboard/resize/scroll/background changes abort cleanly. Native Web Animations only; tests in `tests/brand-entrance.mjs`. The in-app browser currently reports reduced motion, so use a fresh normal Chrome tab with motion allowed to see the full intro.
