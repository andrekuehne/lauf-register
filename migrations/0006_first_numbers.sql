-- Where a Race's singles and Pairs start counting Registration numbers (First number, see GLOSSARY.md).
-- Existing Races keep the numbering they had: singles from 1, Pairs from 1001.
ALTER TABLE races ADD COLUMN first_single_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE races ADD COLUMN first_pair_number INTEGER NOT NULL DEFAULT 1001;

-- last_single_number and last_pair_number now both hold the number handed out last
-- in their series (0: none yet). So far the Pair counter held a count, the number
-- being 1000 + count.
UPDATE races SET last_pair_number = 1000 + last_pair_number WHERE last_pair_number > 0;
