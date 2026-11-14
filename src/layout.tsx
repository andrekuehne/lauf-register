import { raw } from "hono/html";
import type { Child } from "hono/jsx";

const baseStyles = `
:root { color-scheme: light; --fg: #111; --muted: #555; --bg: #fff; --accent: #0b5cad; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 18px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 32rem; margin: 0 auto; padding: 2rem 1rem; }
h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 .75rem; }
p { margin: 0 0 1rem; color: var(--muted); }
`;

const appName = "Lauf-Register";

/** Page shell. `title` is the page-specific part; the app name is appended. */
export function Layout(props: { title?: string; children: Child }) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{props.title ? `${props.title} – ${appName}` : appName}</title>
          <style>{raw(baseStyles)}</style>
        </head>
        <body>
          <main>{props.children}</main>
        </body>
      </html>
    </>
  );
}
