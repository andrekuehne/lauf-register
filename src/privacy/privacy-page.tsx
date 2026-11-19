// The privacy notice (Art. 13 DSGVO) for everyone who registers, linked from the
// Check screen and every public page's footer. A Registration rests on taking part
// in the Race, not on consent (docs/adr/0007). The text is legal prose rather
// than UI strings, so it lives here, one version per language, not in i18n.ts.
// It describes what the app does: keep it in step when that changes (what is
// stored, the cleanup's 30 days, Cloudflare as host, the language cookie).

import type { Context } from "hono";
import type { FC } from "hono/jsx";
import type { Lang } from "../i18n";
import type { AppEnv } from "../language";
import { Layout } from "../layout";
import { IMPRINT_URL } from "./links";

/** Postal address and how to reach someone. */
type Contact = { lines: string[]; phone: string; email: string };

/** Who is responsible (Verantwortlicher), as the club's Impressum names it. */
const CONTROLLER: Contact = {
  lines: ["Hochschulsportgemeinschaft Universität Greifswald e.V.", "Karl-Liebknecht-Ring 2", "17491 Greifswald"],
  phone: "+49 3834 510030",
  email: "geschäftsstelle@hsguni-greifswald.de",
};

/** The club's data protection officer (Datenschutzbeauftragter), as its Impressum names them; Art. 13(1)(b) asks for their contact. */
const DATA_PROTECTION_OFFICER: Contact = {
  lines: ["Frank Seifert", "ASD ArbeitsSicherheitsDienst GmbH", "Steinbeckerstraße 1", "17489 Greifswald"],
  phone: "+49 3834 7775818",
  email: "datenschutzbeauftragter@asd-seifert.de",
};

const TITLES: Record<Lang, string> = { de: "Datenschutzhinweise", en: "Privacy notice" };

export function privacyPage(c: Context<AppEnv>) {
  const lang = c.get("lang");
  const Text = TEXTS[lang];
  return c.html(
    <Layout lang={lang} url={c.req.url} title={TITLES[lang]}>
      <article class="legal">
        <Text />
      </article>
    </Layout>,
  );
}

function Address(props: { contact: Contact }) {
  const { lines, phone, email } = props.contact;
  return (
    <p>
      {lines.map((line) => (
        <>
          {line}
          <br />
        </>
      ))}
      <a href={`tel:${phone.replace(/ /g, "")}`}>{phone}</a>
      <br />
      <a href={`mailto:${email}`}>{email}</a>
    </p>
  );
}

function German() {
  return (
    <>
      <h1>Datenschutzhinweise zur Anmeldung</h1>

      <h2>Verantwortlich</h2>
      <Address contact={CONTROLLER} />
      <p>
        Weitere Angaben im <a href={IMPRINT_URL}>Impressum des Vereins</a>.
      </p>

      <h2>Datenschutzbeauftragter</h2>
      <Address contact={DATA_PROTECTION_OFFICER} />

      <h2>Welche Daten</h2>
      <p>
        Für jede angemeldete Person: Geschlecht, Titel (falls angegeben), Vor- und Nachname, Geburtsjahr und Verein (freiwillig).
        Dazu die Wertung (einzeln oder als Paar, Dauer), die Startnummer und der Zeitpunkt der Anmeldung.
      </p>

      <h2>Wofür und auf welcher Grundlage</h2>
      <p>
        <b>Durchführung des Laufs:</b> Startnummer, Einteilung in die Wertung, Zeitmessung und Ergebnisliste. Grundlage ist deine
        Teilnahme am Lauf (Art. 6 Abs. 1 lit. b DSGVO). Ohne diese Angaben ist keine Teilnahme mit Zeitmessung möglich; der Verein ist
        freiwillig.
      </p>
      <p>
        <b>Veröffentlichung der Ergebnisse:</b> Die Ergebnisliste mit Titel, Vor- und Nachname, Geburtsjahr, Verein, Wertung und
        Ergebnis veröffentlichen wir auf der Website des Vereins und bewahren sie dort als Archiv auf. Grundlage ist unser berechtigtes Interesse an der Berichterstattung
        über den Lauf und an der Vereinschronik (Art. 6 Abs. 1 lit. f DSGVO). Du kannst dem jederzeit widersprechen; dann entfernen
        wir deinen Eintrag oder ersetzen deinen Namen.
      </p>
      <p>
        Kinder und Jugendliche unter 16 Jahren meldet ein Elternteil an, oder ein Elternteil ist mit der Anmeldung einverstanden.
      </p>

      <h2>Wer die Daten erhält</h2>
      <p>
        Die Helferinnen und Helfer des Vereins am Anmeldetisch und bei der Zeitmessung. Für die Zeitmessung übertragen wir die
        Angaben in die Zeitmess-Software auf einem Rechner des Vereins. Die Ergebnisliste ist öffentlich.
      </p>
      <p>
        Diese Anmeldung läuft bei Cloudflare, Inc. (USA), die als Auftragsverarbeiter für uns tätig ist. Die Anmeldedaten werden in
        der EU gespeichert. Für eine Übermittlung in die USA ist Cloudflare nach dem EU-US Data Privacy Framework zertifiziert
        (Angemessenheitsbeschluss, Art. 45 DSGVO).
      </p>

      <h2>Wie lange</h2>
      <p>
        Die Anmeldedaten in diesem System werden spätestens 30 Tage nach dem Lauf automatisch gelöscht; Sicherungskopien des
        Hosting-Anbieters werden innerhalb von 7 weiteren Tagen überschrieben. Kopien für die Zeitmessung löschen wir, sobald die
        Ergebnisliste feststeht. Die Ergebnisliste bleibt als Archiv, bis du widersprichst.
      </p>
      <p>
        Beim Aufruf dieser Seiten speichert der Hosting-Anbieter technische Protokolle (u. a. IP-Adresse, aufgerufene Seite, Zeitpunkt)
        für höchstens 7 Tage, um Fehler zu finden und den Dienst zu schützen (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>Cookies und Speicher im Browser</h2>
      <p>
        Ein Cookie merkt sich die gewählte Sprache. Deine Eingaben bleiben in deinem Browser, bis du den Tab schließt, damit beim
        Neuladen nichts verloren geht. Es gibt kein Tracking und keine Statistik-Dienste.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
        (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Schreib dazu an den Verein oder an den
        Datenschutzbeauftragten (Adressen oben); am Lauftag hilft dir auch der Anmeldetisch.
      </p>
      <p>
        Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel beim Landesbeauftragten für Datenschutz und
        Informationsfreiheit Mecklenburg-Vorpommern.
      </p>
    </>
  );
}

function English() {
  return (
    <>
      <h1>Privacy notice for registration</h1>

      <h2>Who is responsible</h2>
      <Address contact={CONTROLLER} />
      <p>
        More details in the <a href={IMPRINT_URL}>club's imprint</a> (German).
      </p>

      <h2>Data protection officer</h2>
      <Address contact={DATA_PROTECTION_OFFICER} />

      <h2>What data</h2>
      <p>
        For each person registered: gender, title (if given), first and last name, year of birth and club (optional). Also the category
        (single or pair, duration), the start number and when the registration was made.
      </p>

      <h2>What for, and on what basis</h2>
      <p>
        <b>Running the race:</b> start number, category, timing and the results list. The basis is your taking part in the race
        (Art. 6(1)(b) GDPR). Without these details you can't take part with timing; the club is optional.
      </p>
      <p>
        <b>Publishing the results:</b> we publish the results list with title, first and last name, year of birth, club,
        category and result on the club's website and keep
        it there as an archive. The basis is our legitimate interest in reporting on the race and in the club's history (Art. 6(1)(f)
        GDPR). You can object at any time; we then remove your entry or replace your name.
      </p>
      <p>Children and young people under 16 are registered by a parent, or a parent agrees to the registration.</p>

      <h2>Who receives the data</h2>
      <p>
        The club's helpers at the race desk and at timing. For timing, we transfer the details into the timing software on one of
        the club's computers. The results list is public.
      </p>
      <p>
        This registration runs on Cloudflare, Inc. (USA), which processes the data on our behalf. Registration data is stored in the
        EU. For any transfer to the USA, Cloudflare is certified under the EU-US Data Privacy Framework (adequacy decision, Art. 45
        GDPR).
      </p>

      <h2>How long</h2>
      <p>
        Registration data in this system is deleted automatically no later than 30 days after the race; the host's backups are
        overwritten within 7 more days. Copies for timing are deleted once the results list is final. The results list stays in the
        archive unless you object.
      </p>
      <p>
        When you open these pages, the host keeps technical logs (including IP address, page and time) for at most 7 days, to find
        errors and protect the service (Art. 6(1)(f) GDPR).
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        A cookie remembers your language. What you enter stays in your browser until you close the tab, so nothing is lost on reload.
        There is no tracking and no analytics.
      </p>

      <h2>Your rights</h2>
      <p>
        You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18),
        data portability (Art. 20) and to object (Art. 21). Write to the club or to the data protection officer (addresses above); on race day, the race desk can help too.
      </p>
      <p>
        You can complain to a data protection supervisory authority, for example the Landesbeauftragter für Datenschutz und
        Informationsfreiheit Mecklenburg-Vorpommern.
      </p>
    </>
  );
}

const TEXTS: Record<Lang, FC> = { de: German, en: English };
