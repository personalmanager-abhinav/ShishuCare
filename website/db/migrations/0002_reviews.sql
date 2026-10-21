CREATE TABLE product_reviews (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 avatar TEXT NOT NULL DEFAULT 'initial',
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 review_text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL,
 deletion_hash TEXT NOT NULL,
 verification_status TEXT NOT NULL DEFAULT 'unverified',
 verification_source TEXT
);
CREATE INDEX reviews_public ON product_reviews(product_id,status,created_at);
