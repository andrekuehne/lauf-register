-- Whether participants can register for the Race through its public link (see GLOSSARY.md).
-- New Races start closed: an Admin opens Registration on race day.
ALTER TABLE races ADD COLUMN registration_open INTEGER NOT NULL DEFAULT 0 CHECK (registration_open IN (0, 1));
-- Races created before this switch existed were open, and stay so.
UPDATE races SET registration_open = 1;
