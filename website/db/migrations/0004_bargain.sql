-- Bargaining tables
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