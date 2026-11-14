# lauf-register

Phone-first self-registration of participants on race day for timed runs, where distance is accumulated over a fixed duration. Results, scoring and timing are out of scope.

## Language

### Races and Categories

**Race**:
A single race day, created in advance by an Admin, with its own QR code that leads participants to registration.
_Avoid_: Event, run
_German (UI)_: Lauf

**Division**:
Who competes together: one of *Men*, *Women*, *Men's pair*, *Women's pair*, *Mixed pair*. It follows from whether a Registration is single or a Pair and from its Participants' Genders.
_Avoid_: Class, type (and *Gender*, which belongs to a Participant)

**Duration**:
The length of the timed run: *30 min* or *60 min*.
_Avoid_: Distance, race type
_German (UI)_: Halbstundenlauf, Stundenlauf

**Category**:
The combination of one Division and one Duration (e.g. "Mixed pair · 30 min"); every Race offers the same fixed set of ten Categories.
_Avoid_: Sub race, race type, heat

### People

**Registration**:
One submitted sign-up for one Category within one Race, covering either a single Participant or a Pair.
_Avoid_: Entry, sign-up, booking
_German (UI)_: Anmeldung

**Participant**:
One person named on a Registration, with a Gender, a Title, first name, last name, birth year and optional club.
_Avoid_: Runner, athlete, user

**Gender**:
A Participant's gender: *woman* or *man*. Chosen explicitly during registration (in a single-gender Division it is the Division's); never inferred from a name or Title.
_Avoid_: Sex, Anrede

**Title**:
An academic title in front of a Participant's name: *–* (none) or *Dr.*
_Avoid_: Salutation, prefix, Anrede

**Kid**:
A Participant who is 12 or younger in the year of the Race, judged from the birth year alone; nobody marks it.
_Avoid_: Child title, youth

**Single**:
A Registration with exactly one Participant.
_Avoid_: Solo, individual
_German (UI)_: Einzeln

**Pair**:
Two Participants registered together on one Registration in a pair Division; a *Mixed pair* is one woman and one man, in either order.
_Avoid_: Couple, team
_German (UI)_: Zu zweit (choice), Paar

**Registration number**:
The number shown on a Registration's confirmation screen and read out at the race desk; it is also the start number in the results software. Within a Race, singles count up from 1 and Pairs from 1001.
_Avoid_: Bib (the physical number a Participant wears)
_German (UI)_: Startnummer

**Race desk**:
The on-site table where Registrations are checked, bibs are handed out, and people without a phone are registered on a shared device.
_Avoid_: Check-in, counter

**Admin**:
An organizer who signs in with their email address to create Races, open or close Registration, correct Registrations, export them, and delete them.
_Avoid_: Organizer account, user
