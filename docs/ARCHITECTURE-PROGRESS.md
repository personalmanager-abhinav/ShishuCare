# Architecture implementation — 20 September 2026

This update follows the request to start the remaining architecture work. It supersedes older statements that recommendations, session preferences, experiments and inventory imports do not exist. The catalogue-first powder-sky design, external purchases, no customer accounts and JSON product editing remain unchanged.

## Implemented

| Area                      | Delivered behavior                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommendations           | Three related products on direct pages and product popups, with category/attribute similarity, optional current product vectors, deterministic ranking, unavailable-product exclusion and hard-filter support. Static links work without JS; browser fallback works without APIs.                                                      |
| Session preferences       | Separate explicit choice on Privacy. Up to eight recently viewed IDs in this tab influence recommendations. No cross-device profile; history is not used after 30 minutes idle. Turning it off or deleting history clears it.                                                                                                          |
| Measurement               | Consent-gated recommendation impressions (50% visible for one second) and clicks; request, placement, position, catalogue, model and experiment metadata. Server-issued receipts validate visitor/product/position/model context. Receipts expire after three days and are removed on deletion.                                        |
| Experiments               | Disabled-by-default, stable salted browser assignment between content and content-plus-popularity ranking. Popularity uses at least five distinct consenting browsers per product. New experiment IDs are required when changing assignment semantics.                                                                                 |
| Ranking evaluation        | Private judged-case CLI compares content baseline against the session/popularity challenger using precision, recall and NDCG at three. It never invents labels, enables an experiment or trains a model.                                                                                                                               |
| Private reports           | `/internal/insights`: recommendation exposure/click rates, rolling seven-day product-interest comparisons and actual imported inventory. Click attribution requires a preceding visible request/product exposure within 30 minutes. Repeated events cannot multiply an exposure pair.                                                  |
| Trends                    | Product sessions per 100 tracked sessions, prior-week comparison, distinct-browser support and a low-data state. These are descriptive website-interest measures, not sales predictions or causal experiment conclusions.                                                                                                              |
| Inventory                 | Owner-only validated JSON import, immutable SKU/product/colour mapping, idempotent daily sales totals, source and snapshot timestamps. Planning baseline uses 28 complete India-calendar sales days plus stock updated within 24 hours; missing days and stale stock suppress estimates. Returns remain separate. No automatic orders. |
| Full recovery preparation | D1 SQL export plus retained raw R2 archives; checksum manifest; fresh visitor and review tombstones; sanitized database and archive bundle. Reviews, valid credentials, inventory, migrations and schema are retained. Transient receipts/counters/job status reset. Manifest counts match scrubbed archives.                          |
| Review deletion           | Additive deletion tombstones prevent withdrawn or owner-deleted reviews from being restored from older backups created with this schema. Historical deletions before tombstone tracking cannot be reconstructed from absent evidence.                                                                                                  |
| Production separation     | Separate storefront-only and owner-only Worker entry points, configuration generator for two hostnames, scheduled jobs only on the owner deployment. Both use shared source/schema; local development retains the single-Worker preview.                                                                                               |
| Monitoring                | A health-only monitor token cannot read reports. CLI emits a status and nonzero failure exit code; provider Access/service credentials and external scheduling/notifications still require setup.                                                                                                                                      |
| Bargaining                | Persistent D1-backed demo with explicit marketplace choice, browser-scoped sessions, three distinct offer attempts, conservative amount parsing, floor-safe deterministic counters, idempotent messages/acceptance, consent-gated telemetry, protected owner reporting and production-off feature flags. It never issues a coupon.     |

## Data and configuration

Apply all migrations through `website/db/migrations/0007_bargain_language.sql` before running the current APIs. Existing applied migrations were not edited; bargaining hardening, demo coverage and persisted language preference are additive.

`website/data/discovery.json` enables related products and selects the model version. Its experiment remains disabled. Increment the model version when ranking semantics change, and use a new experiment ID for a new experiment. Do not reuse old cohort results across materially changed rankers/catalogues.

The private import and recovery instructions are in `website/README.md`. Credentials, backup SQL, sales data, evaluation labels and generated production configuration are kept out of public assets and source control.

## Not completed by code alone

- Real product/brand/business data, photos, offer links and validated promotion details.
- Cloudflare resources, owner Access policy, secrets, domains and deployment.
- Live embeddings and representative English/Hindi/Hinglish search evaluation. General ambiguous-query handling and broader language/typo behavior remain subject to that evaluation.
- Real relevance judgments, adequate consenting traffic and a reviewed experiment before enabling popularity/ranking changes. No learned ranking model or durable server-side personal profiles have been introduced.
- Actual sales/stock history and validation of the simple planning baseline. Seasonal, promotion-aware and learned inventory forecasting remain future evaluated work.
- Complete production recovery rehearsal with isolated cloud resources and refreshed tombstones, including a controlled traffic cutover. Local drills do not establish cloud recovery time objectives.
- External monitor deployment and alert delivery, actual-device performance and comprehensive accessibility review.
- Final privacy/contact/retention policy and the user's still-undescribed additional feature.

## Verification

See `website/VERIFICATION.md`. Checks include pure ranking/eligibility, inventory completeness and identity, receipt validation, experiment attribution, split-route isolation, monitoring scope, full recovery redaction/tombstones/checksums, API and browser flows, and both Worker deployment dry runs. No resources were provisioned and nothing was published.
