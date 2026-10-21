-- Extend the explicitly non-redeemable local demo to the remaining preview products.
INSERT OR IGNORE INTO bargain_campaign
  (campaign_id,marketplace_id,marketplace_offer_id,discount_kind,amount_minor,percentage_bps,status,verified_at,valid_from,valid_until,terms_json)
VALUES
  ('demo-P102-meesho','meesho','P102-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P102-amazon','amazon','P102-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P102-flipkart','flipkart','P102-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P103-meesho','meesho','P103-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P103-amazon','amazon','P103-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P103-flipkart','flipkart','P103-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P104-meesho','meesho','P104-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P104-amazon','amazon','P104-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P104-flipkart','flipkart','P104-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P105-meesho','meesho','P105-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P105-amazon','amazon','P105-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P105-flipkart','flipkart','P105-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P106-meesho','meesho','P106-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P106-amazon','amazon','P106-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P106-flipkart','flipkart','P106-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P107-meesho','meesho','P107-meesho','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P107-amazon','amazon','P107-amazon','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}'),
  ('demo-P107-flipkart','flipkart','P107-flipkart','demo',NULL,NULL,'active',NULL,'2026-01-01T00:00:00Z','2030-01-01T00:00:00Z','{"demo":true}');

INSERT OR IGNORE INTO bargain_policy
  (policy_id,product_id,variant_id,marketplace_id,base_floor_minor,marketplace_floor_minor,enabled,revision,updated_at)
VALUES
  ('demo-policy-P102-meesho','P102','','meesho',14400,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P102-amazon','P102','','amazon',14400,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P102-flipkart','P102','','flipkart',14400,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P103-meesho','P103','','meesho',9600,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P103-amazon','P103','','amazon',9600,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P103-flipkart','P103','','flipkart',9600,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P104-meesho','P104','','meesho',16000,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P104-amazon','P104','','amazon',16000,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P104-flipkart','P104','','flipkart',16000,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P105-meesho','P105','','meesho',10400,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P105-amazon','P105','','amazon',10400,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P105-flipkart','P105','','flipkart',10400,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P106-meesho','P106','','meesho',15200,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P106-amazon','P106','','amazon',15200,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P106-flipkart','P106','','flipkart',15200,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P107-meesho','P107','','meesho',13600,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P107-amazon','P107','','amazon',13600,NULL,1,1,'2026-10-13T00:00:00Z'),
  ('demo-policy-P107-flipkart','P107','','flipkart',13600,NULL,1,1,'2026-10-13T00:00:00Z');
