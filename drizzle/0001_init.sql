CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at text NOT NULL,
  last_login_at text
);
CREATE UNIQUE INDEX users_email_uq ON users (email);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at text NOT NULL,
  created_at text NOT NULL,
  ip text,
  ua text
);
CREATE UNIQUE INDEX auth_sessions_token_hash_uq ON auth_sessions (token_hash);

CREATE TABLE settings (
  user_id text PRIMARY KEY NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  json text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE provider_secrets (
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  tag text NOT NULL,
  updated_at text NOT NULL,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users (id),
  question text NOT NULL,
  title text,
  mode text NOT NULL,
  status text NOT NULL,
  settings_snapshot text NOT NULL,
  stats text NOT NULL DEFAULT '{}',
  created_at text NOT NULL,
  updated_at text NOT NULL,
  deleted_at text
);
CREATE INDEX sessions_user_idx ON sessions (user_id, deleted_at, created_at);

CREATE TABLE runs (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  started_at text NOT NULL,
  finished_at text
);
CREATE INDEX runs_session_idx ON runs (session_id);

CREATE TABLE calls (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  kind text NOT NULL,
  provider text NOT NULL,
  transport text NOT NULL,
  model text NOT NULL,
  status text NOT NULL,
  started_at text,
  finished_at text,
  duration_ms integer,
  searches integer NOT NULL DEFAULT 0,
  input_tokens integer,
  output_tokens integer,
  cost_usd real,
  text text,
  html text,
  citations text NOT NULL DEFAULT '[]',
  error_code text,
  error_message text,
  pasted integer NOT NULL DEFAULT 0
);
CREATE INDEX calls_run_idx ON calls (run_id);

CREATE TABLE claims (
  id text PRIMARY KEY NOT NULL,
  call_id text NOT NULL REFERENCES calls (id) ON DELETE CASCADE,
  idx integer NOT NULL,
  claim text NOT NULL,
  verdict text NOT NULL,
  note text,
  source_url text,
  source_title text
);
CREATE INDEX claims_call_idx ON claims (call_id, idx);

CREATE TABLE events (
  id text PRIMARY KEY NOT NULL,
  session_id text REFERENCES sessions (id) ON DELETE SET NULL,
  user_id text NOT NULL,
  ts text NOT NULL,
  type text NOT NULL,
  payload text NOT NULL
);
CREATE INDEX events_session_ts_idx ON events (session_id, ts);

CREATE VIRTUAL TABLE sessions_fts USING fts5(session_id UNINDEXED, question, answers);
