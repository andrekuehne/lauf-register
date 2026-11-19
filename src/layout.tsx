import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { LANG_NAMES, LANGS, strings, type Lang } from "./i18n";
import { languageSwitchHref } from "./language";
import { IMPRINT_URL, PRIVACY_PATH } from "./privacy/links";
import { styles } from "./ui/styles";

type LayoutProps = {
  lang: Lang;
  /** Full URL of the current page, for the language switch. */
  url: string;
  /** Page-specific part of the <title>; the app name is appended. */
  title?: string;
  /** Shown top left next to the language switch; defaults to the app name. */
  heading?: Child;
  /** The admin area is German only and hides the Deutsch / English switch. */
  languageSwitch?: boolean;
  /** Uses the width of a tablet or laptop rather than a phone's (the Anmeldetisch). */
  wide?: boolean;
  /** Links to the privacy notice and the Impressum at the bottom; the admin area leaves them out. */
  legalLinks?: boolean;
  children: Child;
};

/** "Deutsch · English": the current language as text, the other as a link. */
export function LanguageSwitch(props: { lang: Lang; url: string }) {
  return (
    <>
      {LANGS.map((lang, i) => (
        <>
          {i > 0 && " · "}
          {lang === props.lang ? (
            <span>{LANG_NAMES[lang]}</span>
          ) : (
            <a href={languageSwitchHref(props.url, lang)} hreflang={lang} lang={lang} data-lang-link>
              {LANG_NAMES[lang]}
            </a>
          )}
        </>
      ))}
    </>
  );
}

/** Page shell for every public page: header with the Deutsch / English switch, inline styles. */
export function Layout(props: LayoutProps) {
  const appName = strings(props.lang).appName;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={props.lang}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{props.title ? `${props.title} – ${appName}` : appName}</title>
          <style>{raw(styles)}</style>
        </head>
        <body class={props.wide ? "wide" : undefined}>
          <header class="top">
            <p class="top-title">{props.heading ?? appName}</p>
            {props.languageSwitch !== false && (
              <nav class="lang">
                <LanguageSwitch lang={props.lang} url={props.url} />
              </nav>
            )}
          </header>
          <main>{props.children}</main>
          {props.legalLinks !== false && (
            <footer class="legal-links">
              <a href={PRIVACY_PATH}>{strings(props.lang).legal.privacy}</a> · <a href={IMPRINT_URL}>{strings(props.lang).legal.imprint}</a>
            </footer>
          )}
        </body>
      </html>
    </>
  );
}
