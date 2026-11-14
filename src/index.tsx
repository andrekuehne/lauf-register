import { cloudflareAccessIdentity } from "./admin/identity";
import { createApp } from "./app";
import { deleteExpiredRaces } from "./races/cleanup";

const app = createApp({ identity: cloudflareAccessIdentity });

export default {
  fetch: app.fetch,
  // The daily cron trigger (wrangler.jsonc): personal data doesn't outlive the Race.
  async scheduled(controller, env) {
    const deleted = await deleteExpiredRaces(env.DB, new Date(controller.scheduledTime));
    console.log(`daily cleanup: deleted ${deleted} Race(s)`);
  },
} satisfies ExportedHandler<Env>;
