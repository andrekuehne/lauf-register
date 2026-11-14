import type { Context } from "hono";
import { raw } from "hono/html";
import { DIVISIONS, DURATIONS, TITLES } from "../domain/categories";
import { flowBundle } from "../generated/flow-bundle";
import { strings, type FlowStrings, type Lang } from "../i18n";
import type { AppEnv } from "../language";
import { Layout } from "../layout";
import { divisionIconSvg, ICONS } from "../ui/icon-svgs";
import { Icon } from "../ui/icons";
import { FLOW_CONFIG_ID, type FlowConfig } from "./flow-config";

/** What the public registration page needs to know about a Race. */
export type PublicRace = {
  token: string;
  name: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
};

function formatRaceDate(isoDate: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** JSON that is safe inside a <script> element. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function PersonFields(props: { slot: number; t: FlowStrings }) {
  const { slot, t } = props;
  const id = (field: string) => `${field}-${slot}`;
  // Browser autofill only for the first slot: it's usually the phone's owner.
  const auto = (value: string) => (slot === 0 ? value : "off");
  return (
    <div class="person" data-person={slot} role="group" aria-labelledby={id("slot")}>
      <h3 id={id("slot")} data-slot-label></h3>
      <div class="field">
        <span class="label" id={id("title-label")}>{t.title}</span>
        <div class="pills" role="radiogroup" aria-labelledby={id("title-label")}>
          {TITLES.map((title) => (
            <label class="pill">
              <input type="radio" name={id("title")} value={title} data-field="title" />
              <span>{t.titles[title]}</span>
            </label>
          ))}
        </div>
        <p class="hint" data-hint="title" hidden></p>
      </div>
      <div class="field">
        <label class="label" for={id("firstName")}>{t.firstName}</label>
        <input type="text" id={id("firstName")} data-field="firstName" autocomplete={auto("given-name")} autocapitalize="words" />
        <p class="error" data-error="firstName" hidden></p>
      </div>
      <div class="field">
        <label class="label" for={id("lastName")}>{t.lastName}</label>
        <input type="text" id={id("lastName")} data-field="lastName" autocomplete={auto("family-name")} autocapitalize="words" />
        <p class="error" data-error="lastName" hidden></p>
      </div>
      <div class="field">
        <label class="label" for={id("year")}>{t.birthYear}</label>
        <input type="text" id={id("year")} class="year" data-field="birthYear" inputmode="numeric" pattern="[0-9]*" maxlength={4} autocomplete="off" placeholder="1985" />
        <p class="error" data-error="birthYear" hidden></p>
        <p class="hint" data-hint="birthYear" hidden></p>
      </div>
      <div class="field">
        <label class="label" for={id("club")}>
          {t.club} <small>({t.optional})</small>
        </label>
        <input type="text" id={id("club")} data-field="club" autocomplete="off" autocapitalize="words" />
      </div>
    </div>
  );
}

/** The public registration flow for one Race: Division → Duration → details → Check → Done. */
export function registrationPage(c: Context<AppEnv>, race: PublicRace) {
  const lang = c.get("lang");
  const t = strings(lang).flow;
  const config: FlowConfig = {
    submitUrl: `/r/${race.token}/registrations`,
    storageKey: `lauf-register:${race.token}`,
    raceYear: Number(race.date.slice(0, 4)),
    t,
  };
  const heading = (
    <>
      {race.name}
      <span class="top-sub">{formatRaceDate(race.date, lang)}</span>
    </>
  );

  return c.html(
    <Layout lang={lang} url={c.req.url} title={race.name} heading={heading}>
      <noscript>
        <p class="note">{t.noscript}</p>
      </noscript>
      <div id="flow" hidden>
        <nav class="bar" id="bar" aria-label={t.selectionLabel} hidden></nav>
        <div id="stepno">
          <p class="stepno"></p>
          <div class="progress">
            <i></i>
          </div>
        </div>

        <section data-step="division" hidden>
          <h2 tabindex={-1}>{t.divisionHeading}</h2>
          {DIVISIONS.map((division) => (
            <button type="button" class={`choice div-${division}`} data-division={division} aria-pressed="false">
              <Icon svg={divisionIconSvg(division)} />
              <span>
                <b>{t.divisions[division].name}</b>
                <small>{t.divisions[division].detail}</small>
              </span>
            </button>
          ))}
        </section>

        <section data-step="duration" hidden>
          <h2 tabindex={-1}>{t.durationHeading}</h2>
          {DURATIONS.map((duration) => (
            <button type="button" class="choice" data-duration={duration} aria-pressed="false">
              <Icon svg={ICONS.duration} />
              <span>
                <b>{t.durations[duration].name}</b>
                <small>{t.durations[duration].detail}</small>
              </span>
            </button>
          ))}
          <button type="button" class="back" data-back>{t.back}</button>
        </section>

        <section data-step="details" hidden>
          <h2 tabindex={-1} data-details-heading>{t.detailsHeadingSingle}</h2>
          <form id="details-form" novalidate>
            <PersonFields slot={0} t={t} />
            <PersonFields slot={1} t={t} />
            <button type="submit" class="btn">{t.next}</button>
          </form>
          <button type="button" class="back" data-back>{t.back}</button>
        </section>

        <section data-step="check" hidden>
          <h2 tabindex={-1}>{t.checkHeading}</h2>
          <div class="summary" id="summary"></div>
          <form id="submit-form" novalidate>
            <label class="consent">
              <input type="checkbox" id="consent" />
              <span>{t.consent}</span>
            </label>
            <p class="error" id="consent-error" hidden>{t.consentRequired}</p>
            <p class="alert" id="offline" role="alert" hidden>{t.offline}</p>
            <p class="alert" id="rejected" role="alert" hidden>{t.rejected}</p>
            <button type="submit" class="btn" id="submit">{t.submit}</button>
          </form>
          <button type="button" class="back" data-back>{t.back}</button>
        </section>

        <section data-step="done" hidden>
          <div class="done" id="done">
            <span class="ico" id="done-icon"></span>
            <h2 tabindex={-1}>{t.doneHeading}</h2>
            <div class="done-cat" id="done-cat"></div>
            <p class="done-names" id="done-names"></p>
            <p class="done-label">{t.numberLabel}</p>
            <div class="done-number" id="done-number"></div>
          </div>
          <p style="margin-top:16px">{t.deskHint}</p>
          <button type="button" class="btn btn-secondary" id="another">{t.another}</button>
        </section>
      </div>
      <script type="application/json" id={FLOW_CONFIG_ID}>{raw(scriptJson(config))}</script>
      <script>{raw(flowBundle)}</script>
    </Layout>,
  );
}

/** Shown for a public link that doesn't (or no longer) belong to a Race. */
export function raceNotFoundPage(c: Context<AppEnv>) {
  const lang = c.get("lang");
  const t = strings(lang).raceNotFound;
  return c.html(
    <Layout lang={lang} url={c.req.url} title={t.title}>
      <h1>{t.title}</h1>
      <p class="muted">{t.text}</p>
    </Layout>,
    404,
  );
}
