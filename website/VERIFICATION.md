# Verification record

## Bargaining interface refinement — 13 October 2026

- Replaced the duplicated bargaining product/gallery view with one expandable conversation card inside the existing product-detail column.
- Promoted the action beside the listed price, added the same entry to direct product pages, required an explicit marketplace choice, and retained regular marketplace options below the conversation.
- Replaced the incomplete prototype handler with persistent D1 sessions/turns, opaque browser ownership, product-wide 24-hour reuse, conservative price parsing, atomic three-attempt enforcement, ten-message limits, message/session/acceptance idempotency, floor-safe deterministic demo replies, protected owner reporting and production-off configuration.
- Focused tests pass: numeral parsing, floor invariants, browser ownership, retry idempotency, unclear/repeated offers, demo acceptance without coupons, and production rejection. Frontend, Worker and test TypeScript checks pass.
- The Astro production build generated 15 pages. Real API browser journeys passed in Chrome at 1440px and 390px, covering marketplace selection, counters, repeated and unclear offers, acceptance, disabled completion state, no coupon exposure, no JavaScript errors and no horizontal overflow. Captures are in ignored `work/bargain-flow-*.png`.
- Existing browser and controls regression suites also pass, including search, catalogue filtering, modal gallery/focus/dismissal, colour previews, consent/history deletion, owner dashboard access and mobile layout.
- Local migrations `0005` and `0006` applied successfully. The normal `tsx` test launcher remains unusable in this restricted environment because Node reports `uv_os_get_passwd` / `ENOMEM`; the focused TypeScript test was compiled with `tsc` and run with Node's test runner instead.

## Remaining architecture implementation — 20 September 2026

- `pnpm run check`: passed Astro, frontend, Worker and separately configured test TypeScript checks with zero diagnostics. Browser DOM and Worker runtime types are checked separately to avoid conflicting global types.
- `pnpm run test`: 70 passing unit/contract tests. New coverage includes recommendation eligibility, ranking metrics, stable variants, receipt context, privacy schema, inventory completeness/idempotency/immutable identity, exposure attribution, split-route isolation, monitoring scope and recovery integrity.
- Build: 15 pages. Storefront-only and owner-only Worker dry runs passed. No cloud resources created and no public deployment.
- Existing browser, controls, community, design, ambient and entrance suites passed. New discovery browser suite passed no-consent/no-JS related products, explicit session preferences, consent withdrawal across tabs, visible impressions/clicks, mobile modal, history deletion and owner reports. Mobile recommendations and owner-report screenshots in `work/discovery-*.png` inspected.
- Existing API integration and review API suites passed. Architecture API tests passed anonymous/consented recommendations, forged context rejection, private reports, cross-origin import rejection, idempotent inventory and immutable SKU mapping. Disposable inventory fixtures removed afterward.
- Local maintenance passed verified export, query removal and archived deletion. Health CLI returned `status: ok`. Full local backup export and recovery bundle preparation completed successfully; outputs remain private in ignored `work/`.
- Full recovery test used 1,200 archived fixture events, retained 600 after tombstones, removed query text and a deleted review, verified database/archive manifest counts and integrity, and rejected tampered archive bytes. Separate existing 24,000-event recovery drill passed. These do not replace a live cloud cutover drill.
- Deterministic search evaluation: 56/56 cases. Recommendation ranking metric tests passed; no real judged relevance set or causal experiment evidence has been supplied. Experiments remain disabled. Hosted semantics, actual commercial content, actual sales forecasts, production Access, remote recovery, external alerts and physical-device accessibility/performance remain unverified.

## Continuation — 19 September 2026

- Type checks: zero errors, warnings or hints. Unit/contract suite: 59 passing. Static build: 15 pages. Worker deployment dry run passed; nothing published. Release gate correctly rejects demo content.
- Search evaluation: 56/56 generated catalogue cases passed locally. Tests cover spelling aliases with strict budget/negation, bounded cache expiry/version isolation/eviction, India calendar boundaries, responsive WebP dimensions/no enlargement/content hashes, and deletion-aware restore preparation.
- API integration passed, including owner-only health access and India reporting windows. Browser, controls, design, community, review API, ambient and branded entrance suites passed. Current layout and entrance desktop/mobile screenshots were inspected; no visual redesign was introduced.
- Local scheduled maintenance passed export, query-text removal and archived-history deletion. The initial drill hit an old local deletion backlog; it now checks completion of its own fixture instead of assuming three runs suffice.
- Isolated recovery drill: 24,000 source events; 21,480 restored after supplied and destination tombstones, with duplicate imports, redaction and SQLite integrity verified. It does not prove production D1/R2 backup recovery.
- Still unverified: hosted AI relevance/cache behavior against the actual provider, intended languages, real photos/marketplace links, production Access, external alert delivery, complete cloud restoration, physical-device performance and comprehensive accessibility. See `../docs/IMPLEMENTATION-STATUS.md`.

Initial implementation checked on 17 September 2026.

- Astro/browser/Worker TypeScript checks: passed.
- Static production build: passed.
- Cloudflare deployment dry run: passed; no public deployment performed.
- Production content gate: correctly rejects the current demo catalogue.
- 49 automated tests: passed, including 40 sample search queries, budget boundaries, negation, semantic eligibility, duplicate product IDs, marketplace hostname validation, event schema validation, and redaction.
- Local API integration: passed. Checked authentication boundaries, cross-origin rejection, search fallback, consent identity creation, event deduplication, invalid events, recent-history deletion, and rejection of revoked credentials.
- Browser checks in installed Chrome: passed at desktop and 390px mobile viewport. Checked catalogue, search, clearing filters, details, disabled demo offers, no horizontal overflow, consent, history deletion, and authenticated dashboard. No JavaScript page errors observed.
- Local scheduled maintenance: passed. Verified R2 export, search-text removal, and archived browser-history deletion using test fixtures.
- Screenshots reviewed for desktop, mobile, product details, and dashboard. Corrected a narrow-screen wordmark wrap.

Not established by these checks: real product accuracy, live hosted embedding quality/latency, Cloudflare production deployment, actual Access policy configuration, load/abuse resilience at scale, legal privacy requirements, full accessibility compliance, or a production backup/restore exercise. The README lists remaining launch work.

## Design refinement — 17 September 2026

- Poppins self-hosted across the storefront and dashboard. Rounded elements, category navigation, subtle hover states, and a restrained glass product popup implemented.
- 51 unit/contract tests pass, including optional video path validation and popup marketplace event placement.
- Type checks, production build, and local API integration pass.
- Updated browser checks pass for popup opening without navigation, multi-photo carousel buttons/thumbnails/arrow keys, one-photo states, focus trapping and restoration, Escape/backdrop closure, mobile scrolling, and consent-gated product views with distinct view IDs.
- Verified whole-card hover scaling, reduced-motion behavior, category-page popups, and a close control that remains visible when scrolling to marketplace options on mobile.
- Hover-video support is implemented for future supplied files; no real product video has been supplied or visually evaluated.
- Company-name replacement awaits the user's exact company name; the demo brand remains until confirmed.

## Shishu care visual update — 18 September 2026

Confirmed brand and MOTHERSBLESSING 10% promotion; warm blush/ivory palette with original green fallback and pre-change snapshots. Added staggered hover arrows and inset rounded scrollbar. `pnpm run check` passed with no diagnostics, `pnpm run test` passed all 51 tests, and `pnpm run build` built 15 pages. Chrome desktop/mobile browser suite passed with no JavaScript errors. `tests/design.mjs` verified the offer text, arrows idle/on hover/reduced motion, exact original foreground on palette rollback, and scrollbar width/hidden buttons. Visually inspected desktop storefront and mobile popup screenshots. No deployment or actual marketplace coupon creation was performed.

## Baby catalogue and controls — 18 September 2026

Seven active baby products (P101–P107), archived legacy IDs, three illustrated colour previews per product, card/popup/detail swatches, animated budget/sort listboxes, updated tagline, removed footer demo line, and refined close/hover motion. Prices and marketplace links remain unknown, with no fabricated stock claims.

Validation: build produced 14 pages; check reported zero errors/warnings; all 52 unit tests passed. Browser, API integration, design, and new controls suites passed. Controls checks cover keyboard open/dismissal, filter reset, unknown-price exclusion, colour carry-over from card to popup, carousel synchronization, direct-detail colours, and mobile overflow. Inspected screenshots of desktop/mobile menus and the product popup. README and project memory updated. Real photos, confirmed colours/specifications/prices, and marketplace URLs remain required.

## Colour galleries and image fallback — 18 September 2026

Added explicit per-colour photo galleries and per-product illustration_fallback setting (enabled by default). Missing variant files are omitted during generation; failed browser photo loads recover to the configured illustration, with neutral fallback if disabled. Arrows/swipe/thumbnails stay within the selected colour; one-image galleries hide arrows and thumbnails. Tagline uses serif italic. Temporary offer prices now span Rs100–Rs200.

Build succeeded (14 pages), type checks clean, 54 unit tests passed including gallery isolation, real-photo priority, and enabled/disabled fallback. Updated browser and controls checks passed, including colour preservation under keyboard arrows and simulated failed-photo recovery. README documents JSON examples and all temporary prices.

## Mannpasand, reviews and contextual discovery — 18 September 2026

Implemented shared category/home catalogue controls, hidden initial homepage refinement bar, metadata-backed blue-variant search presentation, browser-local Mannpasand with dedicated page, compact reviewer avatars/names, optional guest reviews, once-only later-visit reminders, protected moderation and author withdrawal. Applied additive local D1 migration 0002_reviews.sql. Purchasing stays on the three marketplaces; no cart/account/checkout was added.

Checks: build generated 15 pages; type check clean; 54 unit tests passed. Community end-to-end, review API, existing controls/browser/API/design suites passed. Verified blue baby caps, category navigation, wishlist persistence/removal, 320/390/768px headers, pending review privacy, approval, avatar/name display, withdrawal, invalid and forged verification payload rejection, rate limiting, and unapproved links remaining disabled. Fixed popup focus trapping around collapsed review forms during regression testing. Visually inspected mobile and desktop screenshots. All test review fixtures were removed. Real marketplace links, verified-purchase data, final public content/policy, and production provisioning remain outstanding.

## 18 September 2026 — tagline, hearts and warm accents
- Passed: pnpm run check, pnpm run test (54 tests), pnpm run build.
- Chrome verification: italic English tagline; SVG heart fill, card/popup save and removal, persisted Mannpasand state, revised heading; no browser errors or horizontal overflow at 320, 390 and 768px.
- Visually inspected desktop and mobile captures in work/warm-hearts-*.png. Local preview only; no deployment.



## 18 September 2026 — quiet ambient particles
- Passed `pnpm run check` (0 errors/warnings), `pnpm run test` (54 passing), and `pnpm run build`.
- Chrome checks passed: 2.6s entrance, ongoing particle motion, offscreen pause/resume, simulated background visibility event, live reduced-motion changes and reduced-motion page entry; search, popup, saved/empty Mannpasand and non-intercepted controls. The three demo marketplace offers remain disabled; no real external checkout links exist to test.
- Compared pre/post intro/footer text and bounding boxes at 320, 390 and 1440px: exact matches. Particle visibility adds no document width/height; no horizontal overflow at 320/390/768/1440px. No particles are descendants of product grids/images; clipped section layers cannot escape into cards.
- Visually inspected desktop/mobile home, footer and empty/populated Mannpasand captures in `work/ambient-*.png`. No browser errors. Frame work is CSS transform/opacity only; low-end physical-device performance has not been measured.
- Short local Chrome performance sample (3 seconds each): running and paused particles both used about 8ms main-thread task time, 0ms script and 0ms layout time (rounded). This is a desktop smoke check, not a cross-device benchmark.

## Particle visibility follow-up
- Actual in-app preview reports prefers-reduced-motion: reduce. The original CSS hid particles entirely. Changed that mode to 4 static intro motes and 3 footer motes with no animation; verified computed visibility in the user's preview.
- Restarted the local Wrangler preview after fresh requests returned 404 following rebuilds. Fresh preview now loads correctly.
- Type checks, 54 tests and build passed; ambient browser checks passed with the static reduced-motion fallback.


## Chrome perceptibility adjustment
Chrome with its default no-preference setting confirmed motion was running, but the old combined opacity and 1-3px travel over four seconds were too subtle. Increased soft-core visibility, sizes to 2-3px and drift range/speed without adding particles. A fresh Chrome sample confirms roughly 6-10px travel over four seconds on sampled motes. Desktop capture visually checked. Check, all 54 unit tests, build and ambient browser checks passed.


## Stronger particle visibility
At user request, increased motes to 3-4.5px with a wider soft centre and 50-72% layer opacity. Reduced-motion static motes now use 60% layer opacity. Density, text, layout and interaction safeguards unchanged. Desktop screenshot inspected; check, 54 unit tests, build and ambient browser checks passed.



## Branded homepage entrance — 18 September 2026
- Passed type checks (0 errors/warnings), all 54 unit tests and production build.
- `tests/brand-entrance.mjs`: checked stages at 0/700/1200/1550/2050/2399ms; clone/header bounds match within 0.2px at widths 1440, 768 and 390. Verified blue dot, overlay/inert cleanup, refresh/internal-return suppression, reduced motion, keyboard/resize cancellation, storage failure and no-JS fallback. No horizontal overflow or JS errors.
- Inspected initial dotless logo, impact, reveal and mobile handoff screenshots in `work/entry-*.png`.
- Existing `tests/browser.mjs` and `tests/ambient.mjs` passed: search, dialogs, carousel, focus, dismissal, colour choices, mobile, consent, deletion/dashboard and ambient motion safeguards. Demo marketplace links remain disabled; real marketplace navigation is not available to test.
- Reduced-motion users see the normal page immediately. No production deployment.

## Powder-sky theme, site doodle background, doodle intro field — 19 September 2026
- New default theme `powder-sky` (soft blue accent, cool ivory surfaces, deep slate ink); butter-yellow/baby-pink/warm-blush/green-original remain selectable in data/site.json.theme. Red hearts retained via --heart-accent.
- Site-wide faint baby-product doodle background (sky-blue #5fb0e0, ~20%), a fixed seamless tile behind all content (src/styles/doodle.css); cards/header/promo keep solid backgrounds so doodles show only in open areas.
- Homepage intro backdrop is now white with a scattered doodle field; each doodle drifts a random direction (was a single downward-sliding tile). Fades in with the wordmark, out with the reveal; reduced-motion still skips the intro.
- Passed: pnpm run check (0), pnpm run build (15 pages), tests/brand-entrance.mjs. Local preview only; no deployment.
