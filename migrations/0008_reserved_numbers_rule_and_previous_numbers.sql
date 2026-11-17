-- A Reserved number is never a Registration's number (GLOSSARY.md), and the
-- database itself refuses any write that would break that (docs/adr/0003).
-- Also: Previous numbers, recorded below.

-- Registrations already on a Reserved number (possible since #20) keep it: the number is no longer Reserved.
DELETE FROM reserved_numbers
WHERE EXISTS (SELECT 1 FROM registrations r WHERE r.race_id = reserved_numbers.race_id AND r.number = reserved_numbers.number);

-- All three triggers raise the same message, which the app recognizes
-- whichever write was refused (isOnReservedNumber in src/registration/registrations.ts).
CREATE TRIGGER registration_not_on_reserved_number_insert
BEFORE INSERT ON registrations
WHEN EXISTS (SELECT 1 FROM reserved_numbers WHERE race_id = NEW.race_id AND number = NEW.number)
BEGIN
  SELECT RAISE(ABORT, 'Registration on a Reserved number');
END;

CREATE TRIGGER registration_not_on_reserved_number_update
BEFORE UPDATE OF number ON registrations
WHEN EXISTS (SELECT 1 FROM reserved_numbers WHERE race_id = NEW.race_id AND number = NEW.number)
BEGIN
  SELECT RAISE(ABORT, 'Registration on a Reserved number');
END;

CREATE TRIGGER reserved_number_not_taken
BEFORE INSERT ON reserved_numbers
WHEN EXISTS (SELECT 1 FROM registrations WHERE race_id = NEW.race_id AND number = NEW.number)
BEGIN
  SELECT RAISE(ABORT, 'Registration on a Reserved number');
END;

-- Previous numbers (GLOSSARY.md): whenever a Registration gets a new number,
-- its old one is recorded, oldest first; its current number is never among them.
CREATE TABLE previous_numbers (
  id INTEGER PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  number INTEGER NOT NULL
);
CREATE INDEX previous_numbers_by_registration ON previous_numbers (registration_id);

CREATE TRIGGER previous_number_recorded
AFTER UPDATE OF number ON registrations
WHEN NEW.number <> OLD.number
BEGIN
  DELETE FROM previous_numbers WHERE registration_id = NEW.id AND number = NEW.number;
  INSERT INTO previous_numbers (registration_id, number) VALUES (NEW.id, OLD.number);
END;
