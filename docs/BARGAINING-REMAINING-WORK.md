# Bargaining system — remaining work and production gates

Updated: 13 October 2026.

This is the authoritative checklist for work that remains after completing the persistent local bargaining demo. The current implementation is intentionally non-redeemable and production-disabled. The detailed design rationale remains in `Shishu_Care_AI_Bargaining_Implementation_Plan(1).md`.

## Current safe boundary

The application supports a D1-backed demo conversation with marketplace and language selection, an opaque browser-scoped session, three distinct price offers, conservative amount parsing, floor-safe deterministic counters, idempotent requests, explicit demo acceptance, consent-controlled analytics, history deletion and an authenticated owner report.

The demo does **not** issue a coupon, promise a marketplace checkout price, call a production AI model, or represent an order or sale. Generated production configuration disables the feature.

## Required owner inputs

- Confirm real product, variant and marketplace-specific list prices.
- Approve the confidential minimum payable price and contribution-margin method for every eligible scope.
- Decide whether attempts remain product-wide across marketplaces; the demo currently shares three attempts per product for 24 hours.
- Approve session duration, abuse limits, languages, customer disclosures and support wording.
- Supply the business/removal contact and final privacy/retention decisions.
- Choose which products and marketplaces may enter a controlled pilot.

## Marketplace validation — external blocker

For each eligible Amazon, Flipkart or Meesho listing, the owner must verify in the seller account:

- promotion/claim-code eligibility and permitted distribution;
- listing, SKU and variant scope;
- supported discount values, rounding, taxes, shipping and stacking;
- customer restrictions, limits, expiry, budget and seller settlement;
- whether codes are single-use, multi-use or API-manageable;
- refunds, cancellations, revocation and failed-code support;
- applicable marketplace policies for links from this website.

Perform a compliant low-value checkout test and record the payable item amount before enabling any public promise. Public documentation alone is insufficient. A negotiated amount must never be called redeemable unless an independently verified marketplace promotion achieves that outcome.

## Coupon and redemption engineering

Do not activate these tables or flows with real codes until marketplace validation is complete.

- Choose a secrets system and encryption/key-rotation design; never store usable codes as plaintext or return ciphertext directly.
- Build an owner-only audited import with strict campaign/SKU/variant/expiry validation.
- Reserve codes atomically, release expired reservations, and make issuance idempotent.
- Distinguish available, reserved, issued, revoked, expired and unknown-redemption states.
- Provide truthful checkout instructions and a failure-reporting path.
- Reconcile issued codes against authorized seller exports or APIs. A code copy or marketplace click is not a redemption or sale.
- Add deletion, backup, recovery and incident procedures for coupon state and audit records.

## AI provider work

- Select a provider and contract that explicitly permits public commercial production use. NVIDIA trial access is for development/evaluation and must not be treated as production authorization.
- Keep a provider interface so a model can be changed without rewriting policy enforcement.
- Send only a server-generated allowed-decision envelope; never send private data that the model does not need.
- Validate typed model output and rewrite or reject amounts outside the deterministic envelope.
- Add timeouts, quotas, cost limits, circuit breakers and deterministic fallback behavior.
- Evaluate Hindi, Hinglish and English tone with owner-reviewed conversation cases, adversarial prompts and ambiguity tests.
- Record model/prompt/config versions without retaining unnecessary customer text.

## Privacy, abuse and operations

- Obtain legal review for the actual audience and jurisdiction; current retention text is a proposal, not a legal determination.
- Decide the retention period for sanitized turns and essential anti-abuse state. Add scheduled expiry/purge after approval.
- Confirm whether bargaining lifecycle analytics require separate disclosure or consent wording.
- Configure Cloudflare rate-limiting/bot controls and monitor bypass behavior across browsers/incognito sessions.
- Add production alerts for error rate, latency, expired campaigns, exhausted code pools, floor-policy failures and unusual attempt volume.
- Include bargaining tables, deletions and coupon material in a complete cloud backup/recovery rehearsal.
- Add an owner UI for policy/campaign management only after real pricing and redemption semantics are approved. The current owner endpoint is read-only by design.

## Evaluation and rollout

- Create owner-reviewed conversation cases for all supported languages and price boundaries.
- Verify zero floor violations, zero false coupon promises and correct three-attempt behavior under concurrent tabs.
- Test keyboard, screen-reader, reduced-motion, narrow-phone and slow-network behavior on physical devices.
- Run a private staff pilot before any customer pilot.
- If experimentation is approved, measure verified marketplace outcomes rather than optimizing chat engagement alone.
- Start with a small allowlist of products and one proven marketplace. Keep a per-marketplace kill switch.

## Production acceptance gate

Public bargaining stays disabled until all of the following are true:

1. Real product/variant/marketplace pricing policies are owner-approved.
2. At least one marketplace redemption method has passed seller-account and checkout verification.
3. Coupon secrets are encrypted and operationally recoverable.
4. The AI provider permits the intended commercial use, or an approved deterministic-only experience is chosen.
5. Legal/privacy/customer-support wording is approved.
6. Production D1/R2, Access, secrets, monitoring, rate controls and recovery have been rehearsed.
7. Automated and physical-device acceptance tests pass.
8. `BARGAIN_MODE` and `BARGAIN_PUBLIC_ENABLED` are changed only for the specifically approved pilot scope.

Until then, keep the demo disclosure, return no coupon, and preserve ordinary marketplace navigation.
