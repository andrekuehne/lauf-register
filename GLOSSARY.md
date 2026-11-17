# lauf-register

Phone-first self-registration of participants on race day for timed runs, where distance is accumulated over a fixed duration. Results, scoring and timing are out of scope.

## Language

### Races and Categories

**Race**:
A single race day, created in advance by an Admin, with its own QR code that leads participants to registration.
_Avoid_: Event, run
_German (UI)_: Lauf

**Registration open / closed**:
Whether participants can register for a Race through its link right now. An Admin opens and closes it by hand; a new Race starts closed. While it is closed, participants register at the Race desk.
_Avoid_: Active, enabled, published
_German (UI)_: Anmeldung offen / geschlossen

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
One submitted sign-up for one Category within one Race, covering either a single Participant or a Pair. Once submitted it stays single or a Pair; an Admin can correct everything else.
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
The number shown on a Registration's confirmation screen and read out at the race desk; it is also the start number in the results software. Unique within a Race. Singles are numbered within 1–999 and Pairs within 1000–1999; each counts up from its own First number, skipping Reserved numbers, numbers already taken and Previous numbers; a number once handed out is never handed out again automatically, unless an Admin sets the series' Next number back over it. An Admin may change it by hand to any number of its range that is neither taken in the Race nor Reserved, including one freed by deleting a Registration, or a Previous number.
_Avoid_: Bib (the physical number a Participant wears)
_German (UI)_: Startnummer

**First number**:
Where a Race's singles or its Pairs start counting Registration numbers, within their range; set per Race by an Admin (by default 1 for singles, 1001 for Pairs).
_Avoid_: Start number, offset

**Next number**:
Where a series' count continues: the number it hands out next, unless that number is taken, Reserved or a Previous number. An Admin can set it to skip ahead, or to go back, e.g. when a series has no number left; going back over free numbers asks first, as they may have belonged to a deleted Registration whose bib is out. Never below the series' First number.
_German (UI)_: nächste Startnummer

**Reserved number**:
A Registration number an Admin has kept out of a Race altogether, typically because its bib got lost: it is never a Registration's number, neither by the automatic count nor by hand. Reserving a number a Registration already has gives that Registration a new one. Once no longer Reserved, the number is free for an Admin to give by hand, and for the count only if the count has not passed it yet (or an Admin sets the Next number back over it).
_Avoid_: Excluded, blocked, skipped number
_German (UI)_: gesperrte Startnummer

**Previous number**:
A Registration number a Registration had before it got a new one (because its number was Reserved, or by an Admin's hand). Shown with the Registration so the race desk can find a Participant whose confirmation screen still shows the old number; the automatic count never hands it out to another Registration. It goes when its Registration is deleted.
_German (UI)_: vorher

**Possible duplicate**:
A Participant whose first name, last name and birth year match another Participant of the same Race (ignoring case and spacing), on another Registration or as the other half of the same Pair. Flagged for the Admin, never blocked: someone may genuinely run twice, e.g. once single and once in a Pair.
_Avoid_: Double, conflict
_German (UI)_: Mögliches Duplikat

**Race desk**:
The on-site table where Registrations are checked, bibs are handed out, and people without a phone are registered on a shared device.
_Avoid_: Check-in, counter

**Admin**:
An organizer who signs in with their email address to create Races, open or close Registration, correct Registrations, export them, delete them, and delete whole Races.
_Avoid_: Organizer account, user
