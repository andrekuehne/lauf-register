// The Anmeldetisch's live updates, server side (docs/adr/0006): connecting a
// screen to its Race's DeskScreens, and telling them what a write changed.

import type { Context } from "hono";
import type { AppEnv } from "../language";
import { findRaceByToken, type Race } from "../races/races";
import { numbersLeft } from "../registration/next-numbers";
import { findRegistrationById } from "../registration/registrations";
import type { DeskUpdate } from "../shared/desk-update";
import { DeskRow, DeskStatus } from "./desk-page";
import { withToggleState } from "./registration-toggle";

/** The Race's DeskScreens: one per Race, named by its token. */
const screensOf = (env: Env, race: Race) => env.DESK_SCREENS.get(env.DESK_SCREENS.idFromName(race.token));

/**
 * Connects an Anmeldetisch screen to its Race (the WebSocket upgrade). The admin
 * area's identity check has run; only a page of the admin site itself may open
 * it, as a browser sends the sign-in cookie along from any site.
 */
export function connectDesk(c: Context<AppEnv>, race: Race): Response | Promise<Response> {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") return c.text("WebSocket expected", 426);
  if (c.req.header("origin") !== new URL(c.req.url).origin) return c.text("Forbidden", 403);
  return screensOf(c.env, race).fetch(c.req.raw);
}

/**
 * What a write changed: the ids of Registrations stored or changed, and of
 * those deleted. None of either when only the side column's status changed.
 */
export type DeskChange = { changed?: number[]; deleted?: number[] };

/**
 * Tells the Race's connected Anmeldetisch screens what a write changed, once it
 * has succeeded: its Registrations as they are stored now, and the side
 * column's status. Runs after the answer is sent, and never fails the write: a
 * screen that misses it catches up when it reconnects.
 */
export function notifyDesk(c: Context<AppEnv>, raceToken: string, change: DeskChange = {}): void {
  const sent = sendUpdate(c.env, raceToken, change).catch((error: unknown) => console.error("Anmeldetisch not notified:", error));
  c.executionCtx.waitUntil(sent);
}

async function sendUpdate(env: Env, raceToken: string, change: DeskChange): Promise<void> {
  // As it is now: Registration may have been opened or closed meanwhile.
  const race = await findRaceByToken(env.DB, raceToken);
  if (!race) return;
  const [raceWithToggle, left, changed] = await Promise.all([
    withToggleState(env.DB, race),
    numbersLeft(env.DB, race.id),
    Promise.all((change.changed ?? []).map((id) => findRegistrationById(env.DB, race.id, id))),
  ]);
  // Deleted meanwhile.
  if (!raceWithToggle || !left) return;
  const rows = await Promise.all(
    changed.filter((registration) => registration !== null).map(async (registration) => ({
      id: registration.id,
      html: String(await (<DeskRow race={race} registration={registration} />).toString()),
    })),
  );
  const update: DeskUpdate = {
    changed: rows,
    // One changed and then deleted meanwhile is gone, too.
    deleted: [...(change.deleted ?? []), ...(change.changed ?? []).filter((id) => !changed.some((r) => r?.id === id))],
    status: String(await (<DeskStatus race={raceWithToggle} left={left} />).toString()),
  };
  await screensOf(env, race).send(JSON.stringify(update));
}
