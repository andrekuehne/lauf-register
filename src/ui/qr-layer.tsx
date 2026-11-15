// The QR button and the full-screen layer it opens: the Race's QR code, its
// link written out, "Link teilen" where the phone can share, and "Schließen".
// Used on the public registration page, the Race's admin page and the admin
// start page (one layer per Race there).

import { raw } from "hono/html";
import { qrLayerBundle } from "../generated/qr-layer-bundle";
import type { Strings } from "../i18n";
import { publicRaceLink } from "../races/race-link";
import { qrCodeSvg } from "./qr-code";

type QrStrings = Strings["qr"];
type QrRace = { token: string; name: string };

const layerId = (race: { token: string }) => `qr-layer-${race.token}`;

/** Opens the Race's layer; works once the page carries <QrLayers> with that Race. */
export function QrButton(props: { label: string; race: { token: string }; class?: string }) {
  return (
    <button type="button" class={props.class ?? "qr-open"} data-qr-open={layerId(props.race)}>
      {props.label}
    </button>
  );
}

/** One layer per Race, hidden until a <QrButton> opens it, and the script that runs them (once). */
export function QrLayers(props: { t: QrStrings; requestUrl: string; races: QrRace[] }) {
  const { t } = props;
  return (
    <>
      {props.races.map((race) => {
        const link = publicRaceLink(props.requestUrl, race.token);
        const callId = `${layerId(race)}-call`;
        return (
          <aside id={layerId(race)} class="qr-layer" role="dialog" aria-modal="true" aria-labelledby={callId} hidden>
            <div class="qr-layer-box">
              <p class="qr-layer-call" id={callId}>{t.call}</p>
              <p class="qr-layer-name">{race.name}</p>
              {raw(qrCodeSvg(link))}
              <p class="qr-layer-link">{link}</p>
              <button type="button" class="btn" data-qr-share data-url={link} data-title={race.name} hidden>
                {t.share}
              </button>
              <button type="button" class="btn btn-secondary" data-qr-close>
                {t.close}
              </button>
            </div>
          </aside>
        );
      })}
      <script>{raw(qrLayerBundle)}</script>
    </>
  );
}
