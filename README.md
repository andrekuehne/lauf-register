# lauf-register

Phone-first race-day registration for timed runs. Participants scan a Race's QR code and register in a few taps; Admins export the Registrations to Excel and delete them after the Race. Domain terms are defined in [GLOSSARY.md](GLOSSARY.md); architecture decisions live in [docs/adr/](docs/adr/).

Built on Cloudflare Workers + D1 with Hono (server-rendered HTML). Live at <https://lauf-register.mail-4a4.workers.dev/>.

## Race day

What Admins do around a Race, in the order they need it. The main registration may already have run on another platform; this app then takes the on-site Registrations, numbered after the ones that platform has handed out. Button and field names are as the admin pages show them.

### Before opening Registration

1. **Numbers.** Set where the on-site numbers begin so they continue after the other platform's, e.g. 181 and 1061: when creating the Race („Erste Startnummer Einzeln“ and „Erste Startnummer Paare“ under „Neuer Lauf“), or later on the Race's settings page (Race page → „Einstellungen (Name, Datum, Startnummern)“) under „Nächste Startnummern“.
2. **Reserved numbers.** On the Race's settings page, under „Gesperrte Startnummern“, reserve the numbers the other platform has handed out (e.g. `1-180`, then `1001-1060`) and the numbers of any lost bibs. The database then refuses them for the automatic count and for hand edits alike ([ADR 0003](docs/adr/0003-reserved-numbers-enforced-by-the-database.md)).
3. **Admin sign-in for the whole day.** In the Cloudflare dashboard, Zero Trust → Access controls → Applications → `lauf-register admin` → Edit: Access's **Session Duration** must cover the day (the default is 24 hours; setup in [Admin sign-in](#admin-sign-in-cloudflare-access)). Every Admin signs in fresh that morning: a session that runs out in the middle of saving loses that edit behind the sign-in page.
4. **Open Registration** with the toggle on the start page or the Race page, and read the question before confirming: it shows „Nächste Startnummern: Einzelne 181, Paare 1061.“ and „Gesperrt: 1–180, 1001–1060.“ If those are not the numbers you expect, cancel and fix the settings first.

### During the Race

- **Backup:** download the Excel export („Excel für RaceResult herunterladen“ on the Race page) every hour or so. It is the practical backup.
- **Finding someone at the Race desk:** open the Anmeldetisch (Race page → „Anmeldetisch“) on the desk's tablet or laptop. Its field „Startnummer oder Name“ has the cursor as it opens and finds a Registration by its number, by a Previous number („vorher“ on its row), or by part of a name; Esc clears it. Newest Registrations come first. Beside the list: the toggle to close Registration, the numbers left per series, and the counts per Duration and Division. The list doesn't update itself: reload it for new Registrations. „Bearbeiten“ and „Löschen“ lead back to the Anmeldetisch. The Race page has the same search.
- **A lost bib:** reserve its number on the settings page. If a Registration has it, the page asks first, then gives that Registration a new number from its series' count, as if it registered now, and lists the new numbers to hand out at the Race desk. Its card keeps the old one as a Previous number („vorher“).
- **Few numbers left:** below 20 free numbers in a series, the Race page and the Anmeldetisch say how many are left.

### When something goes wrong

- **A series has no numbers left.** New Registrations of that series are refused: a phone says so when the person submits and sends them to the Race desk, and the Race page and the Anmeldetisch show it with a link „Nächste Startnummer setzen“. There, under „Nächste Startnummern“, set where that series' count continues, then „Übernehmen“. Going back over numbers that are free now asks first and lists them: most belonged to a deleted Registration, whose bib may still be out. Reserve those whose bib is out, then confirm („Trotzdem übernehmen“).
- **A Race or Registrations deleted by mistake.** D1 Time Travel puts the whole database back to a moment before the mistake; everything stored after that moment is lost, in every Race. From the project folder, signed in with `npx wrangler login`:
  1. Save the current state first, outside the project folder: `npx wrangler d1 export lauf-register --remote --output=../before-restore.sql`, and download the Excel export of every Race still running. Registrations made after the restore point have to be entered again from these. Both hold Participants' personal data: delete them once they are no longer needed.
  2. Check the moment: `npx wrangler d1 time-travel info lauf-register --timestamp=2026-12-09T10:41:00+01:00` (German time in winter is `+01:00`).
  3. Restore: `npx wrangler d1 time-travel restore lauf-register --timestamp=2026-12-09T10:41:00+01:00`. It prints a bookmark that undoes the restore, should the moment have been wrong.

  The account is on the Workers Free plan, where Time Travel reaches only 7 days back (30 on Workers Paid): restore within the week, and keep the hourly Excel exports as the backup beyond it.
- **The app is down.** Paper forms at the Race desk, typed into RaceResult directly.

## Development

### Prerequisites

- Node.js 24 and npm 11 or newer (npm 11.19+ gates install scripts; the approved ones are listed under `allowScripts` in `package.json`).
- A Cloudflare account, only needed for deploying and the remote database.

Everything else (Wrangler, Vitest, TypeScript) is a project dev dependency. Nothing is installed globally.

### First-time setup

```sh
npm install
cp .dev.vars.example .dev.vars   # local admin sign-in (see below)
npm run db:migrate:local         # create the local D1 database and apply migrations
npm run dev                      # http://localhost:8787
```

Locally, `/admin` is signed in automatically as `admin@example.com` (the `access.dev` block in `wrangler.jsonc`).

For deploying, sign in to Cloudflare once (opens a browser):

```sh
npx wrangler login
```

### Daily commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server with a local D1 database (stored in `.wrangler/`). |
| `npm test` | Runs the test suite against the real Worker and a freshly migrated local D1. |
| `npm run test:watch` | Same, in watch mode. |
| `npm run test:e2e` | End-to-end tests of the registration flow in phone-sized WebKit and Chromium (see below). |
| `npm run typecheck` | Type-checks app and tests. |
| `npm run db:migrate:local` | Applies new migrations to the local D1 database. |
| `npm run db:migrate:remote` | Applies new migrations to the production D1 database. |
| `npm run deploy` | Deploys the Worker by hand. Apply remote migrations first if there are new ones. Normally CI does both (see below). |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc`. |

## Admin sign-in (Cloudflare Access)

Admins sign in with their email address and a one-time code from Cloudflare Access (see [ADR 0002](docs/adr/0002-cloudflare-access-for-admin-login.md)). The app has no login of its own: Access stops everyone else before the Worker runs, and the Worker additionally accepts only identities from our own Access application (its audience tag in `ACCESS_AUD`). Without that setup the admin area refuses everyone.

**Does this work on `workers.dev`?** Yes, according to Cloudflare's docs: a self-hosted Access application can protect a single path on a `workers.dev` hostname, so `/admin` is protected while the public `/r/…` links stay open. Step 6 below confirms it on first setup. If it ever doesn't work, the fallback is a custom domain on Cloudflare (Workers & Pages → the Worker → Settings → Domains & Routes) with the Access application on that domain's `/admin`; do that before printing posters, since posters carry the link.

One-time setup in the Cloudflare dashboard:

1. **Turn on Zero Trust** (left menu → Zero Trust). Pick a team name and the Free plan (up to 50 users).
2. **Zero Trust → Access controls → Applications → Add an application → Self-hosted.**
   - Name: `lauf-register admin`
   - Public hostnames: `lauf-register.mail-4a4.workers.dev` with path `admin`, and a second one with path `admin/*`
   - Login method: **One-time PIN** (codes by email; no other identity provider needed)
3. **Policy:** Action *Allow*, Include → *Emails* → the Admins' email addresses.
4. Open the application again → **Additional settings** → copy the **Application Audience (AUD) Tag**.
5. Put it into `wrangler.jsonc` → `vars.ACCESS_AUD` and deploy (`npm run deploy`).
6. Check in a private browser window: `/admin` asks for an email and code; a Race link `/r/…` opens without sign-in.

**Adding or removing an Admin:** edit the policy's email list in Zero Trust. Nothing to change in the app.

## End-to-end tests

`e2e/` drives the registration flow the way a Participant does, with Playwright in WebKit (stand-in for iPhone Safari) and Chromium, each at 390 px and 320 px phone width with touch. The Anmeldetisch's tests (`e2e/desk.e2e.ts`) also run on the Race desk's devices: a tablet in portrait (768 px) and landscape (1024 px) and a laptop (1280 px), in both browsers; the phone tests don't. Every test creates its own Race through the admin pages, then registers through the public link and checks the result in the Admin's list. Tests about what happens after registering (e.g. the search on the Race page) register faster by posting straight to the endpoint the flow posts to (`registerDirectly` in `e2e/helpers.ts`).

`npm run test:e2e` starts its own `wrangler dev` on port 8791 with a fresh local database in `.wrangler/e2e-state` (all migrations applied), separate from the `npm run dev` one. The admin sign-in is the local Access stand-in from `wrangler.jsonc` (`access.dev`), the same as for `npm run dev`; nothing in the app is faked.

First time only, download the two browsers: `npx playwright install webkit chromium` (on Linux add `--with-deps` for the system libraries they need). A failed test leaves a trace in `test-results/` (`npx playwright show-trace <path>/trace.zip`); in CI the traces are attached to the run.

## Browser code

The browser scripts live in `src/client/`: the registration flow (`flow.ts`), the QR layer (`qr-layer.ts`), the admin pages' confirmation dialogs (`confirm.ts`) and the search on a Race's admin page and its Anmeldetisch (`race-search.ts`). `scripts/build-client.mjs` bundles them for older phones (~iOS 12 / Android 8) into `src/generated/` (git-ignored), which the Worker inlines into the page. `npm run dev`, `npm run deploy`, `npm test` and `npm run typecheck` run that build automatically.

## Data deletion

Admins delete a Race (with all its Registrations) from the Race's admin page after typing its name. Anything left over is deleted by a daily cron trigger (`triggers` in `wrangler.jsonc`, 02:00 UTC): every Race whose date is 30 or more days past, counted in German time, as the consent text promises. Each run logs how many Races it deleted (Workers Logs). To fire it by hand locally: `npx wrangler dev --test-scheduled`, then open `http://localhost:8787/__scheduled`.

## Database migrations

Migrations are plain SQL files in `migrations/`, applied in order. Create a new one with:

```sh
npx wrangler d1 migrations create DB <short_description>
```

Tests apply all migrations automatically before each test file. They use their own throwaway D1 storage, isolated per test file, not the `.wrangler/` database that `npm run dev` uses.

## Cloudflare account

`database_id` in `wrangler.jsonc` points at the production D1 database in the project's Cloudflare account. Deploying from a different account needs its own database: `npx wrangler d1 create lauf-register`, then put the new id into `wrangler.jsonc`.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

| When | What runs |
| --- | --- |
| Every push (any branch) and every pull request | `npm ci`, `npm run typecheck`, `npm test`; in parallel `npm run test:e2e` |
| A push to `main`, after all of those pass | `npm run db:migrate:remote`, then `npm run deploy` |

A red check means nothing was deployed. Pull requests and other branches are only checked. Runs on `main` queue up and finish in push order, so an older push never deploys over a newer one and a deploy is never cancelled midway. Deploying by hand (`npm run deploy`) still works, but the next push to `main` deploys anyway. The Node version for CI is in `.nvmrc`.

### Secrets (one-time setup)

The deploy job runs in the GitHub environment `production`, which only `main` may use; its two secrets live there, so a workflow pushed on another branch can't read them (GitHub → the repo → Settings → Environments → `production`):

- `CLOUDFLARE_ACCOUNT_ID`: the account ID, shown by `npx wrangler whoami` or in the Cloudflare dashboard (Workers & Pages, right column).
- `CLOUDFLARE_API_TOKEN`: an API token for this account only:
  1. Cloudflare dashboard → My Profile → API Tokens → **Create Token** → template **Edit Cloudflare Workers**.
  2. Add a permission: **Account → D1 → Edit** (for the migrations).
  3. Remove the zone row (**Zone → Workers Routes**): the app has no zone of its own.
  4. Account Resources: *Include* → this account.
  5. Create it and copy the token. Cloudflare shows it only once.

From the terminal: `gh secret set CLOUDFLARE_API_TOKEN --env production` asks for the value, so it doesn't end up in the shell history; the same for `CLOUDFLARE_ACCOUNT_ID`.

To renew the token: create a new one, replace the secret, then delete the old token.
