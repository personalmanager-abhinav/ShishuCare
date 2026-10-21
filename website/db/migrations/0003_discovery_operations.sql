CREATE TABLE recommendation_sets (
 id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, source_product_id TEXT NOT NULL,
 model_version TEXT NOT NULL, experiment_id TEXT NOT NULL, variant TEXT NOT NULL,
 product_ids_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX recommendation_sets_visitor ON recommendation_sets(visitor_id);
CREATE INDEX recommendation_sets_created ON recommendation_sets(created_at);
CREATE TABLE review_deletions (review_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL);
CREATE TABLE inventory_skus (
 sku TEXT PRIMARY KEY, product_id TEXT NOT NULL, variant TEXT NOT NULL,
 stock_on_hand INTEGER NOT NULL CHECK(stock_on_hand>=0), lead_days INTEGER NOT NULL CHECK(lead_days>=0),
 safety_days INTEGER NOT NULL CHECK(safety_days>=0), observed_at TEXT NOT NULL, source TEXT NOT NULL
);
CREATE TABLE sales_daily (
 sku TEXT NOT NULL REFERENCES inventory_skus(sku), day TEXT NOT NULL,
 units_sold INTEGER NOT NULL CHECK(units_sold>=0), units_returned INTEGER NOT NULL CHECK(units_returned>=0),
 source TEXT NOT NULL, imported_at TEXT NOT NULL, PRIMARY KEY(sku,day)
);
CREATE TRIGGER inventory_sku_identity BEFORE UPDATE OF product_id,variant ON inventory_skus
 WHEN NEW.product_id<>OLD.product_id OR NEW.variant<>OLD.variant
 BEGIN SELECT RAISE(ABORT,'SKU identity is permanent'); END;
