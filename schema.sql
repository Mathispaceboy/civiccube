CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    jurisdiction_level TEXT NOT NULL,
    jurisdiction_code TEXT NOT NULL,
    brief_markdown TEXT NOT NULL,
    quiz_questions TEXT NOT NULL,
    consensus_threshold REAL DEFAULT 0.75,
    status TEXT DEFAULT 'deliberating',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    auth_provider_id TEXT UNIQUE NOT NULL,
    ward_or_zone TEXT NOT NULL,
    is_verified_resident BOOLEAN DEFAULT 0,
    voice_credits_remaining INTEGER DEFAULT 5,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    content_text TEXT NOT NULL,
    translated_text TEXT,
    agree_count INTEGER DEFAULT 0,
    disagree_count INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    bridging_score REAL DEFAULT 0.0,
    is_moderated BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issues(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS votes (
    statement_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_value INTEGER NOT NULL,
    user_cluster_id INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (statement_id, user_id),
    FOREIGN KEY (statement_id) REFERENCES statements(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS resolutions (
    id TEXT PRIMARY KEY,
    issue_id TEXT UNIQUE NOT NULL,
    summary_markdown TEXT NOT NULL,
    target_agency TEXT NOT NULL,
    submission_reference_no TEXT,
    submission_date INTEGER,
    sla_deadline_date INTEGER,
    official_response_markdown TEXT,
    status TEXT DEFAULT 'pending_review',
    FOREIGN KEY (issue_id) REFERENCES issues(id)
);
