import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { DEFAULT_LANG, isLang, type Lang } from "./i18n";

export type AppEnv = {
  Bindings: Env;
  /** adminEmail is set for admin routes only, after the identity check. */
  Variables: { lang: Lang; adminEmail: string };
};

const COOKIE = "lang";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Picks the UI language. `?lang=xx` on a GET stores the choice in a cookie and
 * redirects to the same URL without it; otherwise the cookie (or German) wins.
 */
export const language = createMiddleware<AppEnv>(async (c, next) => {
  const url = new URL(c.req.url);
  const requested = url.searchParams.get("lang");
  if (c.req.method === "GET" && isLang(requested)) {
    setCookie(c, COOKIE, requested, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    });
    url.searchParams.delete("lang");
    return c.redirect(url.pathname + url.search, 303);
  }
  const stored = getCookie(c, COOKIE);
  c.set("lang", isLang(stored) ? stored : DEFAULT_LANG);
  await next();
});

/** The current URL with `lang=xx` added: target of the language switch. */
export function languageSwitchHref(currentUrl: string, lang: Lang): string {
  const url = new URL(currentUrl);
  url.searchParams.set("lang", lang);
  return url.pathname + url.search;
}
