# Registrations rest on taking part, not on consent

A Registration's data is processed because the person takes part in the Race (Art. 6(1)(b) DSGVO), not because they consent. The registration flow used to require a ticked consent checkbox before submitting. That consent was not voluntary, since there was no way to take part without it, and consent can be withdrawn at any time, including mid-race. So the Check screen now has a short note instead, linking the privacy notice at `/datenschutz` (Art. 13), and the server no longer asks for `consent` (flows opened before the change still send it; it is ignored).

The results list is a separate purpose with its own basis. It is published on the club's website and kept as an archive, on the club's legitimate interest (Art. 6(1)(f)). Anyone can object, and their entry is then removed or their name replaced. The data in this app is still deleted 30 days after the Race (`src/races/cleanup.ts`); D1's backups keep it 7 more days, which the notice says.

## Considered options

- **Keep the consent checkbox**, reworded. Still not voluntary, and withdrawing it would have to remove a Participant from a running Race.
- **A required checkbox "I have read the privacy notice".** Same legal basis, one more tap on the phone; the law doesn't ask for a confirmation.
- **Delete after 23 days, so the backups are gone by day 30.** Chosen against: the cleanup keeps its 30 days, and the notice states the backups' 7 days instead.

## Consequences

- The privacy notice (`src/privacy/privacy-page.tsx`) describes what the app does: what it stores, how long, where it is hosted, the language cookie. A change to any of these changes the notice too.
- The notice promises that copies exported for timing are deleted once the results list is final. The app can't do that; the club has to.
