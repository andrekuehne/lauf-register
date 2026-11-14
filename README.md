# lauf-register

Phone-first race-day registration for timed runs. Participants scan a Race's QR code and register in a few taps; Admins export the Registrations to Excel and delete them after the Race. Domain terms are defined in [GLOSSARY.md](GLOSSARY.md); architecture decisions live in [docs/adr/](docs/adr/).

Built on Cloudflare Workers + D1 with Hono (server-rendered HTML). Live at <https://lauf-register.mail-4a4.workers.dev/>.

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
| `npm run typecheck` | Type-checks app and tests. |
| `npm run db:migrate:local` | Applies new migrations to the local D1 database. |
| `npm run db:migrate:remote` | Applies new migrations to the production D1 database. |
| `npm run deploy` | Deploys the Worker. Apply remote migrations first if there are new ones. |
| `npm run preview:upload` | Uploads the current code as a preview version (`prototype-…workers.dev`) without touching production. |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc`. |

## Admin sign-in (Cloudflare Access)

Admins sign in with their email address and a one-time code from Cloudflare Access (see [ADR 0002](docs/adr/0002-cloudflare-access-for-admin-login.md)). The app has no login of its own: Access stops everyone else before the Worker runs, and the Worker additionally accepts only identities from our own Access application (its audience tag in `ACCESS_AUD`). Without that setup the admin area refuses everyone.

**Does this work on `workers.dev`?** Yes, according to Cloudflare's docs: a self-hosted Access application can protect a single path on a `workers.dev` hostname, so `/admin` is protected while the public `/r/…` links stay open. Step 6 below confirms it on first setup. If it ever doesn't work, the fallback is a custom domain on Cloudflare (Workers & Pages → the Worker → Settings → Domains & Routes) with the Access application on that domain's `/admin`; do that before printing posters, since posters carry the link.

One-time setup in the Cloudflare dashboard:

1. **Turn on Zero Trust** (left menu → Zero Trust). Pick a team name and the Free plan (up to 50 users).
2. **Zero Trust → Access → Applications → Add an application → Self-hosted.**
   - Name: `lauf-register admin`
   - Public hostnames: `lauf-register.mail-4a4.workers.dev` with path `admin`, and a second one with path `admin/*`
   - Login method: **One-time PIN** (codes by email; no other identity provider needed)
3. **Policy:** Action *Allow*, Include → *Emails* → the Admins' email addresses.
4. Open the application again → **Additional settings** → copy the **Application Audience (AUD) Tag**.
5. Put it into `wrangler.jsonc` → `vars.ACCESS_AUD` and deploy (`npm run deploy`).
6. Check in a private browser window: `/admin` asks for an email and code; a Race link `/r/…` opens without sign-in.

**Adding or removing an Admin:** edit the policy's email list in Zero Trust. Nothing to change in the app.

## Browser code

The registration flow runs in the browser from `src/client/flow.ts`. `scripts/build-client.mjs` bundles it for older phones (~iOS 12 / Android 8) into `src/generated/` (git-ignored), which the Worker inlines into the page. `npm run dev`, `npm run deploy`, `npm test` and `npm run typecheck` run that build automatically.

## Database migrations

Migrations are plain SQL files in `migrations/`, applied in order. Create a new one with:

```sh
npx wrangler d1 migrations create DB <short_description>
```

Tests apply all migrations automatically before each test file. They use their own throwaway D1 storage, isolated per test file, not the `.wrangler/` database that `npm run dev` uses.

## Cloudflare account

`database_id` in `wrangler.jsonc` points at the production D1 database in the project's Cloudflare account. Deploying from a different account needs its own database: `npx wrangler d1 create lauf-register`, then put the new id into `wrangler.jsonc`.
