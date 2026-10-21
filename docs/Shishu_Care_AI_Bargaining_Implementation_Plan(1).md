# Shishu Care — AI Bargaining System
## Product, technical architecture, marketplace redemption and implementation specification

**Version:** 1.0 — 12 October 2026  
**Status:** Design proposal; not implemented  
**Language of this document:** English  
**Negotiation assistant:** Friendly, natural Hindi (Devanagari; interpret Roman Hindi/Hinglish input)  
**Initial model:** NVIDIA API Catalog trial, **development/testing only**  
**Intended commerce model:** Discovery on Shishu Care; payment, order, shipping and returns on external marketplaces.

> **Launch blocker:** A price accepted by an AI is *not* automatically payable on Amazon, Flipkart or Meesho. A negotiated price may only be presented as a redeemable promise when the selected marketplace has a verified, eligible promotion that produces the payable outcome. Until then, the feature is a clearly labelled internal demo, not a publicly offered discount.

## 1. Executive decision

Build a **two-layer, AI-led negotiation system**. The AI decides how to converse, react, persuade and propose prices in Hindi. A **server-side policy engine** enforces minimum prices, maximum three customer price offers, coupon eligibility, currency, validity and anti-abuse rules. An independent **redemption adapter** maps an accepted negotiation to an already-valid marketplace discount. No model text can create or approve a coupon on its own.

Recommended initial route:

1. Implement private prototype in the existing Astro/TypeScript application.
2. Use NVIDIA trial API behind a swappable model adapter, in development only.
3. Simulate an internal coupon ledger, clearly marked `DEMO — NOT REDEEMABLE`.
4. When seller accounts exist, test promotions on each marketplace with real checkout verification.
5. Enable public bargaining *per marketplace and per eligible product* only when redemption is verified and the AI inference provider permits production commercial use.
6. Otherwise show ordinary marketplace purchase buttons and no bargain promise.

**Important distinction:** The customer can *type any integer rupee offer*; that does **not** mean any accepted rupee amount can be redeemed externally. Supported payable amounts are constrained by marketplace promotion mechanics. When an exact offer cannot be honored, the AI must offer a verified redeemable alternative or explicitly state that no coupon is available.

## 2. Confirmed decisions versus assumptions

| Item | Decision / confidence |
|---|---|
| All inventory belongs to Shishu Care | Confirmed by owner |
| Purchases via Amazon, Meesho, Flipkart; no Shishu Care checkout | Confirmed |
| AI leads conversations; deterministic logic only enforces boundaries | Confirmed |
| Minimum allowable price set manually per product | Confirmed |
| Customer can make arbitrary amounts at/above the allowable floor | Confirmed *for negotiation inputs*, with redemption caveat |
| Three customer price-offer attempts per item | Confirmed; precise expiry and identity are design choices |
| Friendly Hindi like an Indian local-market shopkeeper | Confirmed |
| NVIDIA free API first, changeable later | Confirmed for development; not permissible to assume free trial covers public production |
| Seller accounts | Being created; no ability to verify seller promotion features yet |
| Preferred platform | Select before first monetary counteroffer (recommended) |
| Pricing information | Owner-defined, nonpublic; needs seller fees, taxes and actual effective checkout total validation |
| Exact coupon API for each platform | **Unverified**; seller-console verification required |

### Product baseline to preserve

Project notes say the existing app uses Astro/TypeScript, JSON product catalog and Cloudflare Worker/D1 concepts, with no mandatory login and outgoing links to marketplaces. Accepted current UI baseline is a powder-sky palette and a catalogue-first homepage; do **not** reinstate obsolete colors or hero sections. The project documentation names `website/` as the active app (older archive copies are not authoritative). These are documented project notes, not a live source-code audit. Before implementation, inspect `website/README.md`, `package.json`, Worker entry, current D1 migrations, routing, product JSON schema, analytics conventions, and existing product modal. Do not overwrite unrelated site components.

## 3. Objectives and non-goals

**Objectives:** increase shopper engagement, improve marketplace-bound purchase intent, make negotiations feel realistic, protect margin, prevent false discount promises, and collect actionable business analytics. Support 50–60 products and roughly 200–300 visitors/day with low operational burden.

**Not goals in V1:** own checkout, payment processing, shipping, parcel tracking, order status, auto-creating marketplace promotions, customer accounts, cross-marketplace single coupons, a reinforcement-learning pricing agent, AI-trained sentiment pricing, or unrestricted coupon generation.

**Success criterion:** a shopper negotiates naturally, receives no unauthorized price, stays within three offer attempts, and—only where supported—receives a coupon demonstrably accepted by the chosen marketplace under the tested conditions.

## 4. User experience specification

### 4.1 Entry point

Add a quiet secondary action **“Bargain / मोलभाव करें”** to the existing product detail modal and page. Preserve product photos, color variants, navigation, Poppins typography, current palette, accessibility and existing marketplace CTAs. Hide or disable the action if `bargaining_enabled = false` or no eligible marketplace exists. Do not present the experience as a guaranteed discount merely because AI chat exists.

At first open show: product, selected variant, currently verified marketplace price and **marketplace selection** (Amazon / Flipkart / Meesho, only where eligible). Clearly state that final payable price is decided by the destination marketplace; do not claim a fixed price until coupon redemption is verified. In demo, display conspicuous banner: **“Demo negotiation only. No real coupon will be issued.”**

### 4.2 Negotiation flow

1. Visitor selects product variant and marketplace.
2. Browser requests `POST /api/bargain/sessions` with `product_id`, `variant_id`, `marketplace_offer_id`, and a client-generated idempotency key.
3. Backend checks the marketplace offer is currently configured and active, and creates a session pinned to a **pricing-policy revision**. Returns a server session token bound to an HTTP-only cookie or similarly secure opaque token; never expose private floor.
4. AI sends warm Hindi welcome. No priced discount is promised until redeemability is established.
5. Shopper types a price, e.g. `₹350`, `350 me de do`, or `तीन सौ पचास`.
6. Backend extracts a proposed monetary offer using robust deterministic parser with conservative LLM-assisted interpretation *only if needed*. Ambiguous expressions trigger clarification **without consuming an attempt**.
7. For a valid distinct price offer, backend atomically increments count (max 3) and stores it.
8. Server passes an **allowed decision envelope** and sanitized conversation context to AI. LLM returns a typed proposal (`intent`, `proposed_amount`, `message_hi`), not an authoritative final offer.
9. Policy service validates amount, price progression, eligible redeemable outcomes, and session state; rewrites or rejects invalid model output. Backend composes verified price card independent of model prose.
10. Shopper can accept an offered payable outcome while session is valid. Backend atomically reserves a verified coupon, if and only if one exists and satisfies effective floor checks; otherwise no coupon is issued.
11. The app shows marketplace, eligible SKU/variant, applicable conditions, verified code, expiry, and a normal external purchase link. Shopper copies the code and completes checkout externally.

If AI/model fails, show: `अभी मोलभाव में थोड़ी दिक्कत है। आप सामान्य कीमत पर खरीदारी कर सकते हैं।` and preserve existing purchase link. Never generate an emergency coupon.

### 4.3 One concrete example (DEMO; numbers illustrative)

Product list price: ₹500; owner floor: ₹400; buyer selects Amazon. Suppose the demo can simulate any rupee outcome:

| Interaction | Customer / AI | Consumed attempts |
|---|---|---:|
| AI opens | “नमस्ते! यह पसंद आया? बताइए, क्या बजट सोचा है?” | 0 |
| Shopper | “₹300 में हो जाएगा?” | 1 |
| AI | “₹300 तो मुश्किल है। आपके लिए ₹470 कर सकते हैं।” | 1 |
| Shopper | “₹420 आखिरी बोल रहा हूँ।” | 2 |
| AI | “अच्छा, ₹440 तक आ जाते हैं। कैसा रहेगा?” | 2 |
| Shopper | “₹425 पक्का?” | 3 |
| AI | “चलिए, ₹425 पर बात पक्की—**यह सिर्फ डेमो है; असली कूपन उपलब्ध नहीं है।**” | 3 |

**Production modification:** If the verified marketplace coupon can achieve ₹430 but not ₹425, the AI must offer the eligible ₹430 (provided policy allows it), or decline; **never confirm ₹425 as payable**. Price changes, taxes and shipping must be handled according to verified marketplace checkout, not guessed.

### 4.4 Hindi persona prompt requirements

Persona: friendly, attentive, respectful, concise; natural Sunday-market negotiating flavor **without pretending to be a human seller**. The UI labels this an AI assistant. Match customer register politely; allow occasional colloquial phrasing, not manipulative pressure. Respond in Hindi by default, understand Hinglish/Roman script, never shame customers, use accessibility-friendly short turns, avoid exaggerated claims, avoid promises about stock/returns or delivery that cannot be verified.

Illustrative acceptable tone:
- `इतने में देना थोड़ा मुश्किल होगा। आपके लिए ₹___ तक कर सकते हैं।`
- `आपकी बात समझ रहा हूँ। चलिए, बीच का रास्ता निकालते हैं।`
- `इससे कम का पक्का ऑफ़र अभी उपलब्ध नहीं है।`

Forbidden: revealing minimum floor; false scarcity (`बस एक बचा है`) without trusted inventory; fake manager approvals; promises on behalf of marketplace; false coupon acceptance; urgency not based on real promotion expiry; personal pressure about parenting/baby care.

### 4.5 Inputs, exits and accessibility

- Accept Hindi, Hinglish, English numerals, `₹`, comma/space separators; avoid accidental misparse of `5000` as `500`.
- Clarify `अच्छा`, `थोड़ा कम`, emoji and unclear numerals rather than treating them as offers.
- `हाँ` can accept *only the currently explicit, valid seller offer*; no price acceptance by inference from old model text.
- Provide keyboard support, clear focus, `aria-live` polite message updates, reduced-motion compliance, phone responsive layout, dismissible chat, and persistent call-to-action on mobile.
- Continue browsing normally if bargaining closes or times out. Do not trap shoppers in the bargain feature.

## 5. Three-offer rule: exact semantics

**Definition:** A price attempt is a valid, unambiguous, new buyer-proposed monetary price for one canonical product/variant/marketplace negotiation scope. Three such attempts maximum. Price-less conversation does not consume an attempt but is message-capped to limit abuse (e.g., 10 total user messages/session).

Backend rules:
- `attempts_used` stored in D1, not localStorage alone.
- `attempts_used <= 3` protected by atomic update; race-tested across concurrent tabs.
- Repeated transport retries with identical idempotency key do not consume extra attempts.
- Reopening the same session cannot reset attempts.
- V1 recommendation: **one active session per anonymous browser token and product/variant/marketplace per 24 hours**, with a documented policy on retry and expiration. This is an anti-abuse deterrent, not a guarantee of one human per day.
- A different browser/incognito identity may bypass anonymous quotas; acknowledge this limitation. Apply modest server-side rate limits and bot protection; never claim identity certainty.
- Do **not** fingerprint devices or silently persist identifiers outside declared privacy/consent approach. Guest customers have a natural abuse-identity trade-off.
- Switch of marketplace: close or suspend current session; do not blindly transfer coupon/reservation or pricing floor. Decide whether attempts share across marketplaces; V1 **share a product-wide 3-offer counter for the permitted browser token** to prevent easy resets, while keeping separate negotiation and redemption scope by marketplace.
- Expire sessions after 15 min inactivity / 30 min absolute lifetime (proposed configurable defaults). A redemption offer has independent expiry imposed by marketplace.
- If shopper accepts an AI counteroffer, acceptance does not consume a new *buyer offer* attempt.
- Show `Offer 2 of 3` in UI for transparency.

## 6. Pricing model and algorithm

### 6.1 Separate four prices

1. `observed_marketplace_price_minor`: last owner-verified current listing price; may differ by marketplace and change before checkout.
2. `minimum_net_receipt_minor` or `minimum_checkout_price_minor`: owner-configured floor with clearly defined meaning. **Do not conflate** the customer's checkout total and seller's net after fees.
3. `maximum_discount_authorized_minor` (optional): per listing/campaign guardrail.
4. `coupon_effective_checkout_price_minor`: computed from the verified marketplace promotion and current assumptions. This is the only price eligible for redeemable customer claim.

**Required commercial signoff:** decide whether floor means customer item subtotal, seller gross realization, or seller net contribution *after fees, logistics, taxes, returns and marketplace-funded discounts*. Recommend using a **minimum net contribution check** where data are available, plus a customer-facing price minimum. Store fee estimation inputs privately and version them.

### 6.2 Per-product vs per-marketplace floor

Maintain an owner-defined `base_floor_minor` per product/variant. Derive or manually configure `marketplace_floor_minor` overrides only when commission/logistics make a universal floor unsafe. Effective allowed bound is `max(base_floor, marketplace_floor, other_nonnegotiable_cost_guardrail)`. The final actual redemption must also satisfy coupon eligibility.

**Never place floor, costs, internal pricing logic, coupon pools or API keys in static product JSON or front-end bundles.** Store private pricing config in D1, protected by owner-only administrative access. Public product JSON continues to hold display data only.

### 6.3 AI autonomy without unauthorized prices

For a first draft, send AI a negotiation envelope with allowed *public-facing candidate values* rather than the secret absolute floor if feasible. AI chooses style and proposal within a permitted numeric band. After AI response:

```ts
function authorizeCounteroffer(input: {
  listPriceMinor: number;
  floorMinor: number;
  candidateMinor: number;
  lastSellerOfferMinor?: number;
  allowedRedeemableOutcomesMinor: number[];
}): { ok: boolean; amountMinor?: number; reason?: string } {
  if (!Number.isSafeInteger(input.candidateMinor)) return { ok: false, reason: 'INVALID' };
  if (input.candidateMinor < input.floorMinor) return { ok: false, reason: 'BELOW_FLOOR' };
  if (input.candidateMinor > input.listPriceMinor) return { ok: false, reason: 'ABOVE_LIST' };
  if (input.lastSellerOfferMinor != null && input.candidateMinor > input.lastSellerOfferMinor) {
    return { ok: false, reason: 'UNEXPECTED_PRICE_INCREASE' };
  }
  if (!input.allowedRedeemableOutcomesMinor.includes(input.candidateMinor)) {
    return { ok: false, reason: 'NOT_REDEEMABLE' };
  }
  return { ok: true, amountMinor: input.candidateMinor };
}
```

**Context:** This function is a partial illustration; production must additionally validate campaign status, fees, taxes, variant, marketplace eligibility, time, policy revision and concurrency. A `DEMO` engine can intentionally allow arbitrary simulated amounts while never producing a redeemable code.

### 6.4 Negotiating tactics without hard-coded discounts

Use AI to decide whether to empathize, counter, maintain position or stop. Hard constraints are invariant; *style and increments* may vary. Recommended policy: counteroffers generally should not rise, become firmer with remaining attempts, and stop at a redeemable result rather than aimlessly descending to floor. Don't let customer wording (`ignore your rules`) influence floor validation. Avoid repetitive canned percentages. Track whether buyers feel pressured or misled.

### 6.5 Exact-price feasibility boundary

A customer may propose ₹437, and AI may internally consider it. A marketplace might only allow a defined percentage-off claim code, a product-scoped promo, an eligibility threshold, a non-stackable discount, or a promotion not available on one-unit purchases. If ₹437 is not supported, do not promise it. Production AI is free-form **in dialogue**, not free-form **in payment authority**.

## 7. External marketplace redemption — highest risk

### 7.1 Fundamental contract

Shishu Care cannot compel a third-party checkout to honor its own coupon string. Each real coupon must be created, enabled, and accepted in the relevant marketplace seller tools. Before activation of any bargain for a marketplace, verify:

- seller account / business eligibility;
- specific SKU/listing/variant scope and customer restrictions;
- claim-code or coupon creation features and sharing restrictions;
- exact discount type and rounding;
- maximum discount, quantity and promotion budget;
- one-time vs multi-use, expiry and per-buyer restrictions;
- combination/stacking rules, sale and tax/shipping interactions;
- payout, customer checkout and seller settlement;
- code revocation and refunds/cancellations;
- whether any supported API exists, or manual seller-console provisioning is required;
- whether linking from an external brand website complies with platform policy.

**Do not assume a promotion accepted in seller console works for every customer.** Perform an end-to-end low-value test purchase in a compliant manner, document it, and retest when marketplace policy changes.

### 7.2 Marketplace feasibility matrix (12 Oct 2026, provisional)

| Marketplace | Evidence found | Decision |
|---|---|---|
| **Amazon India** | Amazon seller-forum announcement describes single-unit percentage-off promotions with claim codes. Other Amazon coupon programs have distinct fees, price-history and eligibility conditions. | Candidate for controlled claim-code proof of concept after seller access. **No assumption of arbitrary rupee-denominated one-time coupons, automated API, or unrestricted codes.** |
| **Flipkart** | Public seller landing pages do not establish that a small seller can create transferable, individually negotiated third-party claim codes or an API to do so. | **Unverified / disabled** until seller account proves capability. |
| **Meesho** | No reliable public seller documentation established support for third-party, transferable, individually negotiated seller coupon redemption. | **Unverified / disabled** until supplier tools and policies are inspected. |

Useful research links (verify again in seller accounts):
- Amazon India seller announcement: https://sellercentral.amazon.in/seller-forums/discussions/t/d0c529e8-01f6-4294-afaa-a7f1c58aeafe
- Amazon coupon eligibility/price rules: https://sellercentral.amazon.in/seller-forums/discussions/t/2c2007f4-a982-4d95-8c53-05db1f63fc05
- Flipkart seller entry: https://seller.flipkart.com/

### 7.3 Strategy: coupon campaigns/pools rather than arbitrary string generation

Implement `MarketplaceRedemptionAdapter` whose methods are `checkEligibility`, `listEligibleOutcomes`, `reserveVerifiedCode`, `confirmIssued`, `revokeIfPossible`, and `getRedemptionInstructions`. **Stage 1 uses an offline demo adapter.** Stage 2 starts with owner-uploaded, pre-created and verified claim codes (only where permitted). No scraping seller consoles or circumventing marketplace restrictions.

Code pools and campaign eligibility are private. Codes need collision-safe reservations and strongly typed states (`available`, `reserved`, `issued`, `revoked`, `expired`, `exhausted`, `unknown_redeemed`). For multi-use codes, do not describe issuance as guaranteed unique or redemption as confirmed without marketplace telemetry.

**Important:** Using a code pool still does not solve arbitrary negotiated pricing. Pools support a *finite set of payable outcomes*. To support a genuinely arbitrary amount, a marketplace would need a supported seller feature/API allowing that exact benefit, which must be proven first. Do not build toward an imaginary capability.

### 7.4 Price and coupon examples

Assume listing item price ₹500; customer floor ₹400:

- Shopper asks ₹423.
- Current verified Amazon campaign yields ₹425 payable item subtotal and is eligible for the SKU.
- AI: `₹423 का ऑफ़र अभी उपलब्ध नहीं है, लेकिन ₹425 का पक्का ऑफ़र दे सकते हैं।` (Only if the campaign really is verified and all conditions apply.)
- Customer accepts ₹425.
- Backend reserves eligible code, exposes code+expiry+terms, and sends customer to marketplace.
- The marketplace checkout can still reject the code for account/sale/stock conditions; provide a truthful failure/help path.

If code or campaign cannot be verified, **do not display “deal confirmed”**. End negotiation respectfully and offer regular purchase route.

### 7.5 Redemption tracking limitations

Track `coupon_issued`, `coupon_copy`, `marketplace_click_after_bargain`, `coupon_failure_reported`, and `confirmed_order` **only when independently known from an authorized seller export/API**. Without order data, metrics show intent and coupon delivery, not purchase conversion. Do not mark `coupon_issued` as redeemed.

### 7.6 Customer-facing disclosures

Clearly explain: bargain chat is automated; offer applies only on selected external platform and exact listing/variant; code restrictions and validity; destination marketplace controls final checkout, fulfilment and returns; support path if coupon doesn't work. Avoid claiming guaranteed availability or price if listing data is stale.

## 8. Reference architecture

```text
Existing Astro product modal/page (powder-sky theme)
  |--- Select variant and marketplace
  |--- Hindi negotiation chat
  |--- Copy verified code / marketplace link
  v
Cloudflare Worker — /api/bargain/*
  |--- Input parsing, sanitization, schema validation
  |--- Anonymous session token, rate limiting, abuse control
  |--- D1 transactional session + attempt state
  |--- Private PricingPolicyService (floor, net economics)
  |--- NegotiationOrchestrator
  |        |--- LLM provider interface
  |        |       |--- NVIDIA trial adapter [DEV ONLY]
  |        |       +--- future production provider
  |        +--- Response policy gate / text-price consistency check
  |--- MarketplaceRedemptionAdapter
  |        |--- DemoCouponAdapter [DEV]
  |        +--- VerifiedSellerPromotionPool [platform-specific]
  |--- Analytics events (consent-aware)
  v
D1 private tables: rules, sessions, messages, offers, campaigns, coupon inventory
  |
  +--> Private owner analytics/reporting (existing Access boundary)
  +--> Marketplace checkout URL (never process an order here)
```

**Dependency direction:** UI calls Worker; Worker orchestrator calls provider and redemption interfaces; provider never writes price state or coupons. D1 is authoritative. No per-shopper checkout or wallet. Existing search pipeline remains independent.

## 9. AI provider abstraction

```ts
export interface NegotiationModel {
  generateTurn(input: {
    promptVersion: string;
    language: 'hi';
    productSummary: string;
    publicListPriceMinor: number;
    allowedCounterofferMinor: number[];
    attemptsRemaining: number;
    recentTurns: { role: 'customer' | 'assistant'; text: string }[];
    userMessage: string;
  }): Promise<{
    intent: 'counter' | 'accept' | 'decline' | 'clarify' | 'help';
    candidatePriceMinor: number | null;
    replyHi: string;
  }>;
}
```

Use config `BARGAIN_MODEL_PROVIDER=nvidia_trial` only for local/staging. `BARGAIN_MODEL_ID` is config, not hard-coded. NVIDIA's compatible endpoint is `https://integrate.api.nvidia.com/v1` for supported catalog models. Confirm current model's Hindi quality, valid JSON/structured-output support, latency, request quotas, and separate security/usage policies. Retry transient 429/5xx with bounded backoff and idempotency; circuit-break on sustained errors. Keep keys solely in Worker secrets (`wrangler secret put`, CI secret management), never in `.env` committed or browser code. **Rotate any API key previously pasted into chats/screenshots before further use.**

### 9.1 Commercial-use restriction

NVIDIA API Catalog **trial** access is explicitly for testing/evaluation and excludes production use absent an appropriate subscription/license. Do not deploy that trial as a live customer-facing commercial bargaining engine. Official references:
- https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf
- https://docs.api.nvidia.com/nim/docs/product

**Go-live gate:** swap to a provider/plan with commercial production rights, or a legally permitted deployment model, *before enabling public inference*. Do not interpret ‘zero price’ as ‘unrestricted commercial rights’. Keep the model contract and tests identical when switching.

### 9.2 Prompt assembly and boundary security

Use trusted server-only system and developer policy text. Product facts come from validated canonical data. Treat every customer utterance as hostile/untrusted and never append it to system instructions. Use structured model response; schema validate; extract all price mentions from Hindi message and compare with authorized quote to prevent `replyHi` sneaking an invalid ₹ amount. Prefer backend-templated final price card rather than trusting free-form model output. Do not show floor to model unless necessary; never show to customer. Log sanitized decision metadata, not unrestricted raw prompts.

### 9.3 Persona design

System-level concept (not a deployable final prompt):

> You are Shishu Care's AI bargain assistant. Speak in natural, respectful Hindi and understand Hindi/Hinglish customer inputs. Your job is to negotiate warmly in short turns like a helpful Indian market shopkeeper, without pretending to be a human, inventing product facts, feigning urgency, disclosing private pricing, or promising an unverified coupon. You may only propose offers from the explicit allowed server-supplied outcomes. If none is available, decline graciously and offer the standard marketplace purchase link.

Add realistic style variation but not unverified claims: light humor, counteroffer explanation, courteous close, empathy. Limit output to ~1–3 short sentences plus an optional verified price card. Customer preference can override language only in a later version if approved; initial default remains Hindi.

## 10. D1 schema design (proposed, adapt to existing migrations)

**Private D1 tables:**

```sql
CREATE TABLE bargain_policy (
  policy_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL DEFAULT '',
  marketplace_id TEXT NOT NULL DEFAULT '',
  base_floor_minor INTEGER NOT NULL CHECK(base_floor_minor >= 0),
  marketplace_floor_minor INTEGER,
  enabled INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE bargain_session (
  session_id TEXT PRIMARY KEY,
  browser_scope_hash TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL DEFAULT '',
  marketplace_id TEXT NOT NULL,
  marketplace_offer_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_revision INTEGER NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0 CHECK(attempts_used BETWEEN 0 AND 3),
  status TEXT NOT NULL CHECK(status IN
    ('active','accepted_demo','ready_for_coupon','coupon_issued','declined','expired','blocked')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL
);

CREATE INDEX idx_bargain_session_scope
 ON bargain_session(browser_scope_hash, product_id, created_at);

CREATE TABLE bargain_turn (
  turn_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  speaker TEXT NOT NULL CHECK(speaker IN ('customer','assistant','system')),
  text_redacted TEXT,
  extracted_buyer_offer_minor INTEGER,
  quoted_seller_offer_minor INTEGER,
  decision TEXT,
  model_provider TEXT,
  model_id TEXT,
  prompt_version TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, idempotency_key)
);

CREATE TABLE bargain_campaign (
  campaign_id TEXT PRIMARY KEY,
  marketplace_id TEXT NOT NULL,
  marketplace_offer_id TEXT NOT NULL,
  discount_kind TEXT NOT NULL,
  amount_minor INTEGER,
  percentage_bps INTEGER,
  status TEXT NOT NULL,
  verified_at TEXT,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  terms_json TEXT NOT NULL
);

CREATE TABLE bargain_coupon (
  coupon_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  code_ciphertext TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available','reserved','issued','revoked','expired','unknown_redeemed')),
  reserved_session_id TEXT UNIQUE,
  reserved_until TEXT,
  issued_at TEXT,
  FOREIGN KEY(campaign_id) REFERENCES bargain_campaign(campaign_id)
);

CREATE TABLE bargain_issuance (
  issuance_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  coupon_id TEXT NOT NULL,
  verified_checkout_price_minor INTEGER NOT NULL,
  pricing_snapshot_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  FOREIGN KEY(coupon_id) REFERENCES bargain_coupon(coupon_id)
);
```

Add real foreign keys / checks where schema supports them. **This DDL is illustrative**, not ready-to-apply migration. `code_ciphertext` assumes application-level envelope encryption with a separately stored encryption key; never encrypt using reversible hard-coded key. Prefer hashed code storage when only verification is needed; ciphertext if code must later be shown to shopper. Private floor must remain in private DB or secret configuration.

### 10.1 Transactional patterns

- To consume attempt: `UPDATE bargain_session SET attempts_used=attempts_used+1 ... WHERE attempts_used < 3 AND status='active'` and check modified row count; store the buyer turn and idempotency key within a transaction/batch design compatible with D1.
- To reserve coupon: conditional update of one eligible `available` row and check affected rows before issuance. Ensure campaign eligibility and amount checks are part of the same logical guarded operation; reconcile timeouts.
- On retry, return existing issuance for same session rather than consuming another code.
- On session expiry, release only reservations that have **never** been exposed to users and are safe to reissue; never recycle issued codes without platform-backed verification.
- D1 read-after-write consistency, transaction limits and migration design must be checked against actual Cloudflare runtime. Do not design multi-step non-atomic read-modify-write sequences.

## 11. API contract

| Method | Route | Purpose | Required checks |
|---|---|---|---|
| `GET` | `/api/bargain/eligibility?productId=...` | Public non-sensitive eligibility, marketplaces | Product published, eligible promotions, feature flag; no floor |
| `POST` | `/api/bargain/sessions` | Create/reuse session | Product variant, marketplace, quota, origin/cookie, idempotency |
| `GET` | `/api/bargain/sessions/:id` | Resume current session | Opaque session secret; do not expose private data |
| `POST` | `/api/bargain/sessions/:id/messages` | Submit customer message | Message size, parsing, atomic attempt count, anti-replay, rate limits |
| `POST` | `/api/bargain/sessions/:id/accept` | Accept current explicit verified quote | Latest offer, pricing revision, campaign, expiry, idempotency |
| `GET` | `/api/bargain/issuances/:id` | Return a session-owned issued coupon | Authenticated scope, expiry, policy snapshot |
| `POST` | `/api/bargain/feedback` | Collect optional checkout-code failure | Rate limits, privacy, record not assumed truth |
| `GET` | `/internal/bargain/metrics` | Owner analytics | Existing Cloudflare Access protection |
| `POST` | `/internal/bargain/campaigns/import` | Optional later coupon upload | Owner Access, audited secret import, strong validation |

**Example response**:

```json
{
  "sessionId": "opaque-server-generated-id",
  "state": "active",
  "attemptsUsed": 2,
  "attemptsRemaining": 1,
  "assistantMessage": "आपकी बात समझ में आई। ₹440 तक कर सकते हैं।",
  "offer": {
    "amountMinor": 44000,
    "currency": "INR",
    "redeemable": false,
    "mode": "demo"
  },
  "coupon": null
}
```

In production, `redeemable=true` only after a verified eligible campaign provides that checkout outcome; quote text and structured amount must match. Use `Cache-Control: no-store` for all session and coupon responses. Restrict cookies to Secure, HttpOnly, appropriate SameSite, and use CSRF mitigation for state-changing requests. Use CORS allowlist and origin validation, not wildcard for authenticated APIs.

## 12. Abuse and security threat model

| Threat | Control |
|---|---|
| AI hallucination below floor | Server-side price authorization gate; no coupon based on raw AI message |
| Prompt injection (`ignore rules`) | Customer text untrusted, typed output, invariants rechecked |
| Session-reset abuse | Signed/opaque secure session identity, rolling product quotas, rate limits, captcha/challenge when warranted |
| Concurrent offer-count race | Atomic conditional update + idempotent message keys |
| Coupon double issue | Atomic reservation + unique issuance per session |
| Code harvesting | Limited quantity, coupon quota, rate limit, bot protection, authorized promotion conditions |
| Floor/code/key exposed through public JSON | Separate private D1 and secrets; scan built artifacts |
| Coupon leakage in logs | Redact codes and PII; minimal operational logging |
| Model price hidden in prose | Price mention validator; server-rendered amount card |
| Bogus user claim of expired promotion | Backend campaign truth; do not trust user-provided offer metadata |
| Marketplace price changes | Freshness TTL / re-verification / disable when uncertain |
| Provider outage/quota exhaustion | Fail closed for bargaining; normal marketplace buy links remain |
| Model moderation failures | Input/output safety limits; abuse reporting; scripted safe fallback |
| Unauthorized admin mutations | Cloudflare Access + owner allowlist + audit events |
| Data handling for personal stories | Retain minimal messages, redact PII, consent notices, deletion pathway |

**Data-retention proposal:** keep detailed sanitized bargaining messages for 30 days maximum initially; aggregate offer sizes/accept rates longer without user-specific transcript. Respect actual applicable privacy law and updated retention requirements; connect opt-out to the existing tracking design. Operational session/attempt enforcement may still require narrowly scoped essential state without behavioral profiling.

## 13. Analytics and experimentation

Add events `bargain_opened`, `bargain_started`, `buyer_offer_submitted`, `bargain_counteroffered`, `bargain_accepted_demo`, `bargain_unavailable`, `coupon_issued`, `coupon_copied`, `coupon_failure_reported`, `marketplace_click_after_bargain`, and `bargain_abandoned`. Schema must include event ID, timestamp, product, variant, marketplace, anonymous permitted session context, amount buckets (not private floor), prompt/model/config version, and privacy consent mode. Existing analytics pipeline owns deduplication and retention.

**Dashboard KPIs**: eligible product page views, bargain initiation rate, avg valid buyer offers, session-to-agreement rate, verified coupon issuance rate, copied code rate, marketplace click-after-bargain rate, estimated discount exposure, coupon failures, AI latency, cost per session, quota errors. If seller settlement/order reports later become available, independently reconcile actual redemptions and contribution margin. **Do not call clicks, code copies or promises 'sales'.**

A/B pilot: bargain button shown vs not shown (only eligible listings), measure outbound clicks and verified redemptions if available. Avoid optimizing solely for engagement: high chat time may be bad if orders do not materialize. Minimum safety metrics have zero tolerance for floor violations and unredeemable coupon promises.

## 14. Estimated capacity and cost controls

With 200–300 visitors/day and 50–60 products, the architecture needs only a small Worker and D1. Actual model call volume depends on bargain engagement. Example **planning scenario only**: 300 visitors/day × 20% opening bargain × 4 AI messages = 240 model calls/day, about 7,200/month. This is not a quota or cost estimate. Trial credits, provider limits, responses and latency vary.

Controls:
- Restrict AI calls to active bargain sessions, not every page view.
- Max 3 monetary buyer offers and max 10 total customer messages/session.
- Summarize/trim history (retain only policy-relevant turns plus short context), cap input/output tokens.
- Client-side debouncing and server-side rate limits; no streaming required V1.
- Keep a model-config setting so provider changes don't affect business logic.
- Disable or hide bargains when LLM budget or redeemable coupon inventory is exhausted.
- Track prompt/model version, token count, estimated bill and failure rate.
- Budget alerts; explicitly price a commercial-use provider before public launch.

**Cost is not asserted as ₹0 in production:** NVIDIA trial cannot be presumed commercially authorized; Cloudflare charges and third-party fees need review against current plan/usage; marketplace coupon/promotional fees can outweigh model expense.

## 15. Implementation plan and acceptance gates

### Phase 0 — Audit and contract (0.5–1.5 developer days, estimate)

Inspect active `website/README.md`, package scripts, product schema, variant mapping, current Astro product modal, Worker code, auth, D1 migrations, tests, deployment configuration. Record actual file locations; preserve accepted UI. Decide floor meaning and whether platform-priced item subtotal excludes delivery fees. Agree anti-abuse windows, privacy message retention, consumer disclosures, enabled language.

**Deliverables:** current-system inventory, `docs/bargain/decisions.md`, API/data contracts, test product price policy. **Gate:** owner signs pricing semantics and UX mock.

### Phase 1 — Private demo UI and policy core (2–4 days)

Create bargaining modal/side panel, Hindi sample conversations, attempt counter, public product selection, local/staging mock adapter, deterministic price parser, price policy checker and typed model response validator. Add `BARGAIN_MODE=demo` and `BARGAIN_PUBLIC_ENABLED=false`. Preserve existing marketplace buttons.

**Gate:** five mocked pricing situations; accessible UI; no real coupon shown; entire page works without LLM.

### Phase 2 — NVIDIA model integration for internal testing (1–3 days)

Create `NegotiationModel` interface, NVIDIA trial implementation behind Worker secret, prompt versioning, extraction schema, price/text validator, retries, no sensitive coupon/floor exposure. Evaluate Hindi/Hinglish output on 100 scripted conversations and model refusal/latency. Keep staging behind private access.

**Gate:** no below-floor agreement or implied real coupon, robust 429/timeout behavior. **Do not launch trial model publicly.**

### Phase 3 — Durable D1 state and abuse controls (2–4 days)

Add migrations for policy, sessions, messages and counters; idempotency; backend-only floor; per-browser limit, rate limits; session expiry; privacy text minimization. Use one migration prefix later than existing `0002_reviews.sql` after inspecting actual directory and schema.

**Gate:** concurrent-tab, retry and refresh cannot exceed 3 valid buyer price offers. Code stays secret in built assets.

### Phase 4 — Coupon adapter and internal campaigns (2–4 days)

Add `DemoCouponAdapter`, campaign schema, private coupon pool import design, reservation/issuance state machine and mock tests. Keep live coupon operations off until marketplaces are verified.

**Gate:** simulated quote status, reservation and issuance are consistent; no demo coupon presented as redeemable.

### Phase 5 — Marketplace seller validation (external dependency; duration unknown)

Activate seller accounts and test each platform separately. Amazon candidate first because public seller communication discusses claim-code promotions; test *actual account eligibility*. Confirm whether promotions permit shopper-entered codes and can deliver supported target amounts. Inspect costs, restrictions, stock, returns and redemption visibility. For Flipkart and Meesho, do not assume codes exist.

**Gate per marketplace:** seller-console screenshots / policy notes, tested eligible SKU, coupon accepted at checkout at expected item price, documented expiry and operational procedure. Disabled otherwise.

### Phase 6 — Production inference, end-to-end integration, release (2–5 days after dependencies)

Select licensed commercial provider, run load/abuse testing, verify coupon end-to-end, launch behind per-platform feature flags to small traffic. Add alerts and rollback switch.

**Gate:** commercial rights, real seller program, security and user policy signoff, coupon test checkout, monitoring, rollback.

### Phase 7 — Data-driven refinements (later)

Tune Hindi prompt and negotiation policy based on measured shopper experience, accepted-offer quality and verified sales (when available). Consider personalizing tone only with consent and evidence. Avoid reinforcement-learning agent until data and guardrails warrant it.

**Estimation caveat:** Developer-day estimates exclude seller approval, checkout account eligibility, legal review, copywriting, and the time to gain API/promotions access.

## 16. Verification matrix (must automate where feasible)

| Test | Expected result |
|---|---|
| Model says floor-₹1 | Rejected; never customer-visible as a payable offer |
| Buyer submits 3 valid offers then a 4th | Fourth rejected atomically |
| Buyer says “थोड़ा कम” | Clarification; no attempt consumed |
| Same message retried on timeout | Exactly one attempt consumed |
| Parallel tabs submit at attempt 2 | Cannot exceed count 3 |
| Another marketplace selected | Coupon scope invalidated; product-wide attempt policy applied |
| AI outputs two prices, one invalid in prose | Response rejected or deterministically rewritten |
| Customer asks assistant to ignore rules | Policy unaffected |
| Coupon inventory exhausted | No code or success claim; standard purchase link remains |
| Expired campaign | No issuance; eligible outcomes refreshed |
| Stale marketplace price | Disable promise / require verification |
| D1 unavailable | Fail closed on bargaining; storefront still works |
| NVIDIA trial rate limited | Friendly error; no counterfeit agreement |
| Wrong product variant | Campaign rejected |
| Coupon reused during concurrent reservation | At most one unique-code issuance if campaign promises uniqueness |
| Refresh after accepted deal | Idempotent issuance, same code to permitted session |
| Logs/browser bundle inspected | No floor, coupon inventory, API key |
| Hindi and Romanized numbers | Parsed or clarified safely |
| Coupon rejection at marketplace | Report issue path without pretending sale succeeded |
| Keyboard-only mobile user | Can navigate/open/chat/copy/close |
| Privacy consent declined | Essential functionality as allowed; no unnecessary behavioral profiling |

## 17. Operational playbook

**Daily owner checks (once live):** campaign remaining allocation, upcoming expiry, pricing changes, coupon failures, model quota, attempted floor breaches, unexplained spikes. **Weekly:** reconcile marketplace promotion reports (when available), check real orders vs site-issued code counts, review false promises/translation quality, test one eligible customer journey when feasible. **On incident:** switch `bargaining_enabled=false` for affected platform; keep ordinary outbound shopping path available; revoke codes in seller console only where supported; communicate to affected users if they were given an invalid offer, with minimal retained identifying information.

**Fallback mode:** feature off is better than selling at a price you cannot honor. Do not auto-substitute another marketplace or change price without explicit customer consent.

## 18. Decisions remaining before implementation/go-live

| Question | Recommended default | Owner decision needed? |
|---|---|---|
| What does manual minimum protect? | Net seller economics plus minimum item subtotal | **Yes, before coding policy** |
| Are shipping, taxes and fees included? | Separate displayed marketplace checkout components; never guess | **Yes** |
| What happens if exact amount is not a supported coupon? | Offer nearest verified valid outcome that still respects floor, or decline | **Yes** |
| Three offers per product vs variant/marketplace? | Product-wide across platforms per browser token for 24 hours | Confirm |
| Can a reopened deal restart after 24h? | Yes if no issued coupon and limits permit | Confirm |
| Hindi script | AI replies in Devanagari, understands Roman Hindi/Hinglish | Confirm |
| Is English reply allowed on request? | V1 Hindi-only persona, opt-in future | Optional |
| Should assistant be disclosed as AI? | Yes | No alternative recommended |
| Initial coupons | Demo only until verified seller campaigns | Mandatory |
| Live LLM | Licensed/authorized production provider | Mandatory |

## 19. Go-live acceptance checklist

- [ ] Reviewed actual working source and retained existing design/layout.
- [ ] Product and marketplace mapping has stable IDs for variants/offers.
- [ ] Private floor never leaked to browser or third-party untrusted clients.
- [ ] Three-offer rule remains correct under retries and concurrency.
- [ ] All AI text prices align with backend verified quote card.
- [ ] Paid/promotional pricing economics checked by owner.
- [ ] Per-marketplace seller functionality and external redemption demonstrated.
- [ ] Promo quantity, fee, expiry and stacking restrictions verified.
- [ ] No unverified third-party checkout amount promised.
- [ ] Trial NVIDIA API replaced for live production or separate license obtained.
- [ ] API keys rotated and held in secrets.
- [ ] Anti-bot, rate limit, privacy and retention controls tested.
- [ ] Accessibility and mobile interactions verified.
- [ ] Fail-closed and operational feature flag tested.
- [ ] Dashboard distinguishes chat outcomes from verified purchases.
- [ ] Customer-facing coupon limitations and help instructions published.

## 20. Final recommendation

Ship a **private Hindi negotiation prototype now**: Astro UI + TypeScript Worker + private D1 pricing and sessions + NVIDIA trial provider interface + deterministic validation + demo-only coupon adapter. The AI carries conversational intelligence; the backend alone controls commercial permissions. Keep external checkout completely unchanged. When seller accounts exist, selectively enable **only verified** marketplace campaigns and replace NVIDIA trial with commercially permitted inference.

This approach achieves authentic bargaining while preserving a crucial distinction: **a price acceptable to Shishu Care is not necessarily a discount that Amazon, Meesho or Flipkart can apply.** Never let the AI obscure that boundary.

---

## References and evidence notes

**Project-provided documents (historical notes, not a live code audit):** `Business website — project memory` (16–19 September 2026); `Current design baseline — 19 September 2026`; original architecture discussion. These establish intended Astro/TypeScript + Cloudflare, external checkouts and current UI design constraints.

**Public documentation reviewed 12 October 2026:**
1. NVIDIA API Trial Terms: https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf
2. NVIDIA NIM FAQ: https://docs.api.nvidia.com/nim/docs/product
3. Amazon India Seller Central: https://sellercentral.amazon.in/seller-forums/discussions/t/d0c529e8-01f6-4294-afaa-a7f1c58aeafe
4. Amazon India coupon eligibility: https://sellercentral.amazon.in/seller-forums/discussions/t/2c2007f4-a982-4d95-8c53-05db1f63fc05
5. Flipkart seller entry: https://seller.flipkart.com/

**Evidence grading:** NVIDIA trial restriction is explicitly documented. Amazon claim-code *category* is documented, not this owner's account-specific eligibility or arbitrary negotiated-price support. Flipkart and Meesho bespoke claim-code flow remains unverified. Feature flags must reflect these distinctions.
