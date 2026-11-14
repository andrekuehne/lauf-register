// The Race's A4 poster for the venue: name, date, "Hier anmelden", a large QR
// code of the public link and the link written out. A page of its own (no app
// header), so it prints on one sheet straight from the browser.

import type { Context } from "hono";
import { raw } from "hono/html";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import { formatRaceDateLong } from "../races/race-dates";
import { publicRaceLink } from "../races/race-link";
import type { Race } from "../races/races";
import { qrCodeSvg } from "../ui/qr-code";
import { racePath } from "./registrations-page";

// Sized in mm for the printed sheet; on screen it shrinks to fit the window.
const posterStyles = `
@page{size:A4 portrait;margin:15mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;text-align:center;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.poster{max-width:180mm;margin:0 auto;padding:10mm 16px}
.poster-name{margin:0;font-size:34pt;line-height:1.15}
.poster-date{margin:3mm 0 0;font-size:18pt}
.poster-call{margin:10mm 0 4mm;font-size:52pt;line-height:1.1}
.poster-qr{width:140mm;max-width:100%;margin:0 auto}
.poster-qr svg{display:block;width:100%;height:auto}
.poster-link{margin:4mm 0 0;font-size:15pt;word-break:break-all}
.screen-only{max-width:180mm;margin:0 auto;padding:12px 16px 0;text-align:left;font-size:18px}
.screen-only a{color:#0b5cad}
.screen-only button{float:right;min-height:44px;padding:8px 18px;font:inherit;font-weight:700;color:#fff;background:#0b5cad;border:0;border-radius:10px;cursor:pointer}
@media print{.screen-only{display:none}.poster{padding:0}}
`;

export function posterPage(c: Context<AppEnv>, race: Race) {
  const link = publicRaceLink(c.req.url, race.token);
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`Aushang ${race.name} – Lauf-Register`}</title>
          <style>{raw(posterStyles)}</style>
        </head>
        <body>
          <div class="screen-only">
            <button type="button" onclick="window.print()">Drucken</button>
            <a href={racePath(race)}>← {race.name}</a>
          </div>
          <main class="poster">
            <h1 class="poster-name">{race.name}</h1>
            <p class="poster-date">{formatRaceDateLong(race.date, "de")}</p>
            <p class="poster-call"><b>{strings("de").qr.call}</b></p>
            <div class="poster-qr">{raw(qrCodeSvg(link))}</div>
            <p class="poster-link">{link}</p>
          </main>
        </body>
      </html>
    </>,
  );
}
