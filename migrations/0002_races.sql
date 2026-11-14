-- A Race: one race day with its own public registration link (see GLOSSARY.md).
CREATE TABLE races (
  id INTEGER PRIMARY KEY,
  -- Short random token in the public link /r/<token>; unguessable, never sequential.
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- ISO date YYYY-MM-DD.
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Email of the Admin who created it.
  created_by TEXT NOT NULL
);
