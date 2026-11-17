-- Listing a Race's Registrations reads their Participants as one stretch of
-- Registration ids, from the Race's lowest to its highest (listRegistrations in
-- src/registration/registrations.ts). With this index, finding those two reads
-- one index row each instead of every Registration of the Race: on the Workers Free
-- plan, D1 allows only so many rows read per day. Only adds the index.
CREATE INDEX registrations_by_race_and_id ON registrations (race_id, id);
