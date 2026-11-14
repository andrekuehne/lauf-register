import type { Context } from "hono";
import type { AppEnv } from "../language";

/**
 * Who is making this admin request: the Admin's email, or null if nobody is
 * signed in. The single seam for admin identity (ADR 0002); tests substitute
 * their own implementation, and nothing else in the app is ever faked.
 */
export type AdminIdentity = (c: Context<AppEnv>) => Promise<string | null>;

/**
 * Production identity: Cloudflare Access verifies the sign-in token before the
 * Worker runs and hands the result over as `ctx.access`. We only accept it for
 * our own Access application (its audience tag in ACCESS_AUD). Without a match
 * nobody is an Admin, so a missing or wrong setup fails closed.
 */
export const cloudflareAccessIdentity: AdminIdentity = async (c) => {
  // Hono types executionCtx with its own minimal interface; the Workers runtime one has `access`.
  const access = (c.executionCtx as unknown as ExecutionContext).access;
  const expectedAud = c.env.ACCESS_AUD;
  if (!access || !expectedAud || access.aud !== expectedAud) return null;
  const identity = await access.getIdentity();
  return identity?.email?.toLowerCase() ?? null;
};
