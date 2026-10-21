CREATE TABLE visitors (visitor_id TEXT PRIMARY KEY, credential_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL);
CREATE TABLE events (
 event_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1, event_type TEXT NOT NULL,
 occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, visitor_id TEXT NOT NULL,
 session_id TEXT NOT NULL, page_view_id TEXT NOT NULL, page_path TEXT NOT NULL,
 product_id TEXT, marketplace_id TEXT, search_id TEXT, catalogue_version TEXT NOT NULL, properties_json TEXT NOT NULL
);
CREATE INDEX events_received ON events(received_at);
CREATE INDEX events_type_time ON events(event_type,occurred_at);
CREATE INDEX events_product_time ON events(product_id,occurred_at);
CREATE INDEX events_session_time ON events(session_id,occurred_at);
CREATE INDEX events_visitor ON events(visitor_id);
CREATE TABLE daily_metrics (day TEXT NOT NULL, event_type TEXT NOT NULL, product_id TEXT NOT NULL DEFAULT '', marketplace_id TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL, PRIMARY KEY(day,event_type,product_id,marketplace_id));
CREATE TABLE counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE job_runs (name TEXT PRIMARY KEY, completed_at TEXT NOT NULL, details TEXT NOT NULL);
CREATE TABLE deletion_requests (visitor_id TEXT PRIMARY KEY, requested_at TEXT NOT NULL, cursor TEXT, completed_at TEXT);
CREATE TABLE archive_manifest (day TEXT PRIMARY KEY, exported_at TEXT NOT NULL, event_count INTEGER NOT NULL);
