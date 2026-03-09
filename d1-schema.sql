CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    ts INTEGER NOT NULL,
    referrer TEXT,
    lang TEXT
);

CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_pv_ts ON page_views(ts);
CREATE INDEX IF NOT EXISTS idx_pv_page ON page_views(page);

CREATE TABLE IF NOT EXISTS card_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    event_type TEXT NOT NULL,
    duration_ms INTEGER,
    ts INTEGER NOT NULL,
    lang TEXT
);

CREATE INDEX IF NOT EXISTS idx_ce_session ON card_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ce_topic ON card_events(topic);
CREATE INDEX IF NOT EXISTS idx_ce_ts ON card_events(ts);
