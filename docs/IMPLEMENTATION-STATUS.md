# Implementation status — 19 September 2026

> Updated architecture work is recorded in [ARCHITECTURE-PROGRESS.md](ARCHITECTURE-PROGRESS.md), dated 20 September. Recommendations, explicit session preferences, experiment infrastructure, trend/inventory reports, full recovery preparation and production Worker separation are now implemented. The historical pending list below must be read with that update.

The existing powder-sky, catalogue-first design and external marketplace purchasing model are preserved.

## Completed in this continuation

- Responsive WebP photography generation during catalogue builds; content-hashed 320/640/960/1280px candidates, preserving proportions and avoiding enlargement. Cards, direct pages, colour changes, popup galleries and thumbnails use responsive sources. SVG previews retain their original presentation.
- Bounded five-minute in-memory query-vector cache, keyed by catalogue/model/query hash. Cache hits avoid embedding budget consumption; hard filters are still applied on every request. No persistent query cache or analytics linkage.
- Conservative spelling aliases shared by browser fallback and API search, with visible interpretation text. Budget amounts and negation remain intact.
- Search evaluation CLI: 56 generated demo cases, optional owner-authored cases, API evaluation, latency output and an explicit semantic-required mode.
- Asia/Kolkata calendar-day dashboard windows (today so far plus the preceding 6/13/29 days). Storage, raw archive partitions and existing daily aggregates remain UTC; no historical aggregate reinterpretation.
- Authenticated operational health endpoint and dashboard warnings for missing/stale maintenance, overdue deletion requests and archive backlog.
- Offline recovery SQL generation with tombstones applied before import, destination-tombstone checks, event deduplication, query removal, expired-record exclusion and refusal to overwrite output files.
- Isolated SQLite recovery drill with 24,000 synthetic events; 21,480 survive supplied/destination tombstones. Repeated imports preserve counts and database integrity.
- Updated browser checks to match the accepted homepage, rather than expecting removed hero/arrow content. The maintenance drill now waits for its deletion fixture to finish behind any older local queue entries.
- **AI bargaining demo**: completed a D1-backed, fail-closed demo flow in the product popup and direct product pages. It includes explicit Hindi/Hinglish/English and marketplace selection, opaque browser-scoped 30-minute sessions, 24-hour product-wide reuse, three distinct price offers, a ten-message cap, conservative Hindi/English numeral parsing, atomic attempt updates, request idempotency, deterministic floor-safe localized counters, explicit demo acceptance, consent-gated telemetry and a protected owner report. Migrations `0004`–`0007` define and harden the schema and seed only clearly non-redeemable local demo campaigns. Production configuration disables bargaining.

## Still requires external inputs or live verification

- Real AI-led public bargaining remains gated on an approved commercial inference provider, seller-account promotion capabilities, verified marketplace checkout outcomes, encrypted coupon operations and owner-approved pricing inputs. The delivered deterministic demo intentionally issues no coupon and cannot be enabled by production configuration generation.
- Real product photos, colours, specifications, prices, stock/offer details, marketplace links, logo, domain, promotion validity and business/removal contact.
- Cloudflare provisioning, owner Access policy, production secrets, migrations and deployment. Demo production guards remain enabled.
- Current product embeddings and live semantic evaluation, especially representative Hindi/Hinglish queries. The new spelling aliases are not a general multilingual or fuzzy-search system.
- Final privacy/retention decisions and contact wording.
- A production D1/R2 backup export and restore rehearsal with real provider resources, manifests and recent deletion tombstones. The local drill validates import behavior, not cloud account recovery or complete review/credential backups.
- Actual photography/device performance and broader accessibility evaluation. Browser checks are useful regression coverage, not certification.
- External monitoring must be configured to call the protected health endpoint with the appropriate owner/service authentication; this code does not send alerts or provision a monitoring service.

## Later evidence-dependent work

Personalization, trained ranking, experiments, recommendations and demand/inventory forecasting remain later phases. They need explicit product behavior, relevance measurements and (for inventory) actual sales/stock/returns/lead-time data. The project docs advise against inventing those datasets or prematurely training models.

See `website/README.md` for executable commands and `website/VERIFICATION.md` for checks performed.
