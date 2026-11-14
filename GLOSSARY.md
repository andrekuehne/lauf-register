# lauf-register

Phone-first self-registration of participants on race day for timed runs, where distance is accumulated over a fixed duration. Results, scoring and timing are out of scope.

## Language

### Races and Categories

**Race**:
A single race day, created in advance by an Admin, with its own QR code that leads participants to registration.
_Avoid_: Event, run
_German (UI)_: Lauf

**Division**:
Who competes together: one of *Men*, *Women*, *Men's pair*, *Women's pair*, *Mixed pair*.
_Avoid_: Gender, class, type

**Duration**:
The length of the timed run: *60 min* or *30 min*.
_Avoid_: Distance, race type

**Category**:
The combination of one Division and one Duration (e.g. "Mixed pair · 30 min"); every Race offers the same fixed set of ten Categories.
_Avoid_: Sub race, race type, heat

### People

**Registration**:
One submitted sign-up for one Category within one Race, covering either a single Participant or a Pair.
_Avoid_: Entry, sign-up, booking
_German (UI)_: Anmeldung

**Participant**:
One person named on a Registration, with a Title, first name, last name, birth year and optional club.
_Avoid_: Runner, athlete, user

**Title**:
How a Participant is addressed: one of *–* (none), *Dr.*, *Frau*, *Herr*, *Kids*. *Kids* marks a child; what it means for the export is still open.
_Avoid_: Salutation, prefix

**Pair**:
Two Participants registered together on one Registration in a pair Division; in a *Mixed pair* the slots are fixed as one woman and one man.
_Avoid_: Couple, team

**Registration number**:
The short, sequential number shown on a Registration's confirmation screen and read out at the race desk.
_Avoid_: Bib, start number (a bib is handed out at the desk and is not part of a Registration)

**Race desk**:
The on-site table where Registrations are checked, bibs are handed out, and people without a phone are registered on a shared device.
_Avoid_: Check-in, counter

**Admin**:
An organizer who signs in with their email address to create Races, open or close Registration, correct Registrations, export them, and delete them.
_Avoid_: Organizer account, user
