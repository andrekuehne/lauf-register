# One value per series says where numbering continues

Each series of a Race had two settings that both seemed to decide where its numbers came from: the First number, editable on the Race settings page, and the Next number ([ADR 0004](0004-an-admin-may-send-the-count-back.md)). Admins could not tell what changing either did. Beyond where a new Race starts, the First number did only one thing: it was a floor that neither the count nor the Next number could go below. Now each series stores one value, where its count continues, which an Admin changes as the Next number, anywhere within the series' range. The First number is entered only when a Race is created, as where that value begins, and is not stored. Two other mechanisms already did the floor's job, and do it better. Reserved numbers keep the other platform's numbers out, for hand edits too ([ADR 0003](0003-reserved-numbers-enforced-by-the-database.md)). Going back over free numbers always asks first and lists them.

## Consequences

- Setting the Next number below where a Race's numbering began asks first, even before anyone has registered. The app can't tell numbers never handed out from those of deleted Registrations, and the question is right either way.
- Races stored before the change continue numbering exactly where they did (migration 0010).
