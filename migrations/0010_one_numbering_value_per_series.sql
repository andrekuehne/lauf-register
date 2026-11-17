-- A series' numbering is set in one place per Race: where its count continues
-- (Next number, see GLOSSARY.md and
-- docs/adr/0005-one-value-per-series-says-where-numbering-continues.md). The
-- First number is only where a new Race's count begins, so it is no longer stored.
--
-- The count looked from the higher of the First number and the number after the
-- one handed out last; from now on it looks from the number after the stored
-- last_*_number. Raising that to the number before the First number keeps every
-- Race counting exactly where it did.
UPDATE races SET
  last_single_number = MAX(last_single_number, first_single_number - 1),
  last_pair_number = MAX(last_pair_number, first_pair_number - 1);

ALTER TABLE races DROP COLUMN first_single_number;
ALTER TABLE races DROP COLUMN first_pair_number;
