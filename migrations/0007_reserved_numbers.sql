-- Reserved numbers (see GLOSSARY.md): Registration numbers an Admin has kept out of a
-- Race's automatic count. One row per number; the settings page shows each run of
-- consecutive numbers as one entry, so overlapping and adjacent reservations merge.
CREATE TABLE reserved_numbers (
  race_id INTEGER NOT NULL REFERENCES races (id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  PRIMARY KEY (race_id, number)
) WITHOUT ROWID;
