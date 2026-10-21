-- Additive hardening for the demo bargaining prototype.
CREATE TABLE bargain_session_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES bargain_session(session_id)
);

CREATE TABLE bargain_acceptance_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES bargain_session(session_id)
);

CREATE UNIQUE INDEX idx_bargain_campaign_offer ON bargain_campaign(marketplace_offer_id);
CREATE UNIQUE INDEX idx_bargain_policy_scope
  ON bargain_policy(product_id, variant_id, marketplace_id);
CREATE INDEX idx_bargain_turn_session_created ON bargain_turn(session_id, created_at);

-- Local/demo-only configurations. They do not represent marketplace promotions.
INSERT OR IGNORE INTO bargain_campaign
  (campaign_id,marketplace_id,marketplace_offer_id,discount_kind,amount_minor,percentage_bps,status,verified_at,valid_from,valid_until,terms_json)
VALUES
  ('demo-P101-meesho','meesho','P101-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P101-amazon','amazon','P101-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P101-flipkart','flipkart','P101-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}');

INSERT OR IGNORE INTO bargain_policy
  (policy_id,product_id,variant_id,marketplace_id,base_floor_minor,marketplace_floor_minor,enabled,revision,updated_at)
VALUES
  ('demo-policy-P101-meesho','P101','','meesho',8000,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P101-amazon','P101','','amazon',8000,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P101-flipkart','P101','','flipkart',8000,NULL,1,1,'2026-10-13T00:00:00Z');
