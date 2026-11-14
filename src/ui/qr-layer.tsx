// "QR-Code zeigen" and the full-screen layer it opens: the Race's QR code, its
// link written out, "Link teilen" where the phone can share, and "Schließen".
// Used on the public registration page and on the Race's admin page.

import { raw } from "hono/html";
import { qrLayerBundle } from "../generated/qr-layer-bundle";
import type { Strings } from "../i18n";
import { publicRaceLink } from "../races/race-link";
import { qrCodeSvg } from "./qr-code";

type QrStrings = Strings["qr"];

/** Opens the layer; works once the page carries <QrLayer>. */
export function QrButton(props: { t: QrStrings }) {
  return (
    <button type="button" class="qr-open" data-qr-open>
      {props.t.show}
    </button>
  );
}

/** The layer itself, hidden until a <QrButton> opens it, with the script that runs it. */
export function QrLayer(props: { t: QrStrings; requestUrl: string; race: { token: string; name: string } }) {
  const { t, race } = props;
  const link = publicRaceLink(props.requestUrl, race.token);
  return (
    <>
      <aside id="qr-layer" class="qr-layer" role="dialog" aria-modal="true" aria-labelledby="qr-layer-call" hidden>
        <div class="qr-layer-box">
          <p class="qr-layer-call" id="qr-layer-call">{t.call}</p>
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
      <script>{raw(qrLayerBundle)}</script>
    </>
  );
}
