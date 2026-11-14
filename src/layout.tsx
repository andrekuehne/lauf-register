import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { LANG_NAMES, LANGS, strings, type Lang } from "./i18n";
import { languageSwitchHref } from "./language";
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
        <body>
          <header class="top">
            <p class="top-title">{props.heading ?? appName}</p>
            {props.languageSwitch !== false && (
              <nav class="lang">
                <LanguageSwitch lang={props.lang} url={props.url} />
              </nav>
            )}
          </header>
          <main>{props.children}</main>
        </body>
      </html>
    </>
  );
}
