CREATE TABLE users (
 id uuid PRIMARY KEY,
 email varchar(254) NOT NULL UNIQUE,
 nickname varchar(24) NOT NULL,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);
CREATE TABLE player_state (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0),
 data jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE progress_writes (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 mutation_id uuid NOT NULL,
 request_hash char(64) NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,mutation_id)
);
