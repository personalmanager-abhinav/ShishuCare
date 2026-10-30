-- Support bounded retention and owner reporting for the bargaining demo.
CREATE INDEX IF NOT EXISTS idx_bargain_session_created
  ON bargain_session(created_at);

CREATE INDEX IF NOT EXISTS idx_bargain_session_offer_created
  ON bargain_session(marketplace_offer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_bargain_turn_session_speaker_created
  ON bargain_turn(session_id, speaker, created_at);
