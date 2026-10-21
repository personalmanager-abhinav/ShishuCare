ALTER TABLE bargain_session
ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'hi'
CHECK (preferred_language IN ('hi', 'hinglish', 'en'));
