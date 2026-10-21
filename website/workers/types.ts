export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ARCHIVE: R2Bucket;
  AI: Ai;
  ENVIRONMENT: string;
  SEMANTIC_ENABLED: string;
  DAILY_EMBEDDING_LIMIT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  OWNER_EMAIL: string;
  LOCAL_ADMIN_TOKEN?: string;
  RATE_SALT?: string;
  MONITOR_TOKEN?: string;
  BARGAIN_MODE?: string;
  BARGAIN_PUBLIC_ENABLED?: string;
}
