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
npm run db:migrate:local   # create the local D1 database and apply migrations
npm run dev                # http://localhost:8787
```

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

### Browser code

The registration flow runs in the browser from `src/client/flow.ts`. `scripts/build-client.mjs` bundles it for older phones (~iOS 12 / Android 8) into `src/generated/` (git-ignored), which the Worker inlines into the page. `npm run dev`, `npm run deploy`, `npm test` and `npm run typecheck` run that build automatically.

### Database migrations

Migrations are plain SQL files in `migrations/`, applied in order. Create a new one with:

```sh
npx wrangler d1 migrations create DB <short_description>
```

Tests apply all migrations automatically before each test file. They use their own throwaway D1 storage, isolated per test file, not the `.wrangler/` database that `npm run dev` uses.

### Cloudflare account

`database_id` in `wrangler.jsonc` points at the production D1 database in the project's Cloudflare account. Deploying from a different account needs its own database: `npx wrangler d1 create lauf-register`, then put the new id into `wrangler.jsonc`.
