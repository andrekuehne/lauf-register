// The registration flow in the browser. Bundled by scripts/build-client.mjs for
// ~iOS 12 / Android 8 browsers and inlined into the page.
// Steps live in the URL hash (#duration, #single-or-pair, …) so the phone's back
// button returns to the previous screen; each history entry remembers which
// step it was opened from, so the in-app back button never leaves the page. In-progress data sits in sessionStorage.

import {
  DIVISIONS_FOR,
  isDivision,
  isDuration,
  isGender,
  isSingleOrPair,
  isTitle,
  singleOrPairOf,
  slotGenders,
  type Division,
  type Duration,
  type Gender,
  type SingleOrPair,
  type Title,
} from "../domain/categories";
import { ageInRaceYear, birthYearError, isImplausibleBirthYear, parseBirthYear } from "../domain/participant-checks";
import { FLOW_CONFIG_ID, type FlowConfig } from "../registration/flow-config";
import { fill } from "../shared/fill";
import { divisionIconSvg } from "../ui/icon-svgs";

type Participant = {
  title: Title;
  firstName: string;
  lastName: string;
  birthYear: string;
  club: string;
  /** The second slot's club follows the first slot's until edited by hand. */
  clubEdited: boolean;
};

const TEXT_FIELDS = ["firstName", "lastName", "birthYear"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type FieldMessages = Partial<Record<TextField | "gender", string>>;

type State = {
  duration?: Duration;
  singleOrPair?: SingleOrPair;
  /** Kept when single/pair changes, so details can move over; only counts while it fits singleOrPair. */
  division?: Division;
  /** Mixed pair: the first person's chosen Gender; the second person's is the opposite. */
  mixedFirstGender?: Gender;
  participants: [Participant, Participant];
  consent: boolean;
  /** Sent with every submit of this Registration; a repeat returns the same Registration. */
  attemptId: string;
  result?: { number: number };
};

/** "details" is the first (or only) person, "details-2" the second person of a Pair. */
const STEPS = ["duration", "single-or-pair", "division", "details", "details-2", "check", "done"] as const;
type Step = (typeof STEPS)[number];
/** "Step n of 5": both persons of a Pair share step 4, "done" isn't counted. */
const STEP_NUMBERS: Record<Step, number> = {
  duration: 1,
  "single-or-pair": 2,
  division: 3,
  details: 4,
  "details-2": 4,
  check: 5,
  done: 5,
};
const COUNTED_STEPS = 5;
const FIRST_STEP: Step = "duration";
const SUBMIT_TIMEOUT_MS = 15000;

const config: FlowConfig = JSON.parse(byId(FLOW_CONFIG_ID).textContent || "{}");
const t = config.t;
let state = load() || freshState();
let currentStep: Step | undefined;

// ---------- helpers ----------

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function all<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.prototype.slice.call(root.querySelectorAll(selector));
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function show(node: Element | null, visible: boolean) {
  if (node) (node as HTMLElement).hidden = !visible;
}

function newAttemptId(): string {
  const bytes = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.prototype.map.call(bytes, (b: number) => (b + 256).toString(16).slice(1)).join("");
}

function emptyParticipant(): Participant {
  return { title: "none", firstName: "", lastName: "", birthYear: "", club: "", clubEdited: false };
}

function freshState(): State {
  return { participants: [emptyParticipant(), emptyParticipant()], consent: false, attemptId: newAttemptId() };
}

// ---------- persistence (sessionStorage may be unavailable) ----------

function save() {
  try {
    sessionStorage.setItem(config.storageKey, JSON.stringify(state));
  } catch (e) {
    /* private mode or blocked storage: the flow still works, just without reload safety */
  }
}

function load(): State | null {
  try {
    const raw = sessionStorage.getItem(config.storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw) as State;
    if (!saved || !saved.participants || saved.participants.length !== 2 || !saved.attemptId) return null;
    if (saved.duration !== undefined && !isDuration(saved.duration)) return null;
    if (saved.singleOrPair !== undefined && !isSingleOrPair(saved.singleOrPair)) return null;
    if (saved.division !== undefined && !isDivision(saved.division)) return null;
    if (saved.mixedFirstGender !== undefined && !isGender(saved.mixedFirstGender)) return null;
    saved.participants.forEach((p) => {
      if (!isTitle(p.title)) p.title = "none";
    });
    return saved;
  } catch (e) {
    return null;
  }
}

// ---------- derived values ----------

/** The Division, once it has been chosen for the current single/pair choice. */
function chosenDivision(): Division | undefined {
  return state.division && state.singleOrPair === singleOrPairOf(state.division) ? state.division : undefined;
}

/** Gender per slot; in a Mixed pair unknown until the first person has chosen. */
function genders(): (Gender | undefined)[] {
  const chosen = chosenDivision();
  return chosen ? slotGenders(chosen, state.mixedFirstGender) : [undefined];
}

function activeParticipants(): Participant[] {
  return state.participants.slice(0, genders().length);
}

function isPair(): boolean {
  return genders().length === 2;
}

function isMixed(): boolean {
  return chosenDivision() === "mixed_pair";
}

/** "Erste Person" for a Pair; with the Gender (Check screen) "Erste Person · Frau", or just "Frau" for a single. */
function slotLabel(slot: number, withGender = false): string {
  const person = isPair() ? (slot === 0 ? t.pairFirst : t.pairSecond) : "";
  const gender = genders()[slot];
  if (!withGender || !gender) return person;
  return person ? `${person} · ${t.genders[gender]}` : t.genders[gender];
}

function personErrors(slot: number): FieldMessages {
  const p = state.participants[slot]!;
  const errors: FieldMessages = {};
  if (slot === 0 && isMixed() && !state.mixedFirstGender) errors.gender = t.genderRequired;
  if (!p.firstName.trim()) errors.firstName = t.required;
  if (!p.lastName.trim()) errors.lastName = t.required;
  const yearMessage = birthYearMessage(p.birthYear, "next");
  if (yearMessage) errors.birthYear = yearMessage;
  return errors;
}

/**
 * The birth-year error for the moment it is checked: while typing, only once it
 * can't turn into a valid year any more (four digits, or not digits at all);
 * on leaving the field, also an unfinished year; on "Next", also an empty field.
 */
function birthYearMessage(input: string, moment: "typing" | "leaving" | "next"): string | undefined {
  const value = input.trim();
  if (!value) return moment === "next" ? t.required : undefined;
  if (moment === "typing" && /^\d{1,3}$/.test(value)) return undefined;
  const error = birthYearError(value, config.raceYear);
  if (error === "future") return t.birthYearFuture;
  if (error === "too-early") return t.birthYearTooEarly;
  if (error) return t.birthYearInvalid;
  return undefined;
}

function participantComplete(slot: number): boolean {
  return Object.keys(personErrors(slot)).length === 0;
}

/** Gentle, non-blocking "please check" for an unlikely birth year. */
function birthYearHint(p: Participant): string | undefined {
  const year = parseBirthYear(p.birthYear, config.raceYear);
  if (year === null || !isImplausibleBirthYear(year, config.raceYear)) return undefined;
  return fill(t.birthYearCheck, { age: ageInRaceYear(year, config.raceYear) });
}

/** The furthest step the current data allows. */
function furthestStep(): Step {
  if (state.result) return "done";
  if (!state.duration) return "duration";
  if (!state.singleOrPair) return "single-or-pair";
  if (!chosenDivision()) return "division";
  if (!participantComplete(0)) return "details";
  if (isPair() && !participantComplete(1)) return "details-2";
  return "check";
}

function displayName(p: Participant): string {
  const title = p.title === "none" ? "" : `${t.titles[p.title]} `;
  return `${title}${p.firstName.trim()} ${p.lastName.trim()}`;
}

function shortName(p: Participant): string {
  const last = p.lastName.trim();
  return `${p.firstName.trim()}${last ? ` ${last.charAt(0)}.` : ""}`;
}

/** "Mixed-Paar · Halbstundenlauf" */
function categoryName(): string {
  const chosen = chosenDivision();
  if (!chosen || !state.duration) return "";
  return `${t.divisions[chosen].category} · ${t.durations[state.duration].name}`;
}

// ---------- navigation ----------

function stepFromHash(): Step | undefined {
  const name = location.hash.replace(/^#/, "");
  return (STEPS as readonly string[]).indexOf(name) >= 0 ? (name as Step) : undefined;
}

type HistoryEntry = { flowStep: Step; from?: Step };

function historyEntry(): HistoryEntry | null {
  const entry = history.state as HistoryEntry | null;
  return entry && entry.flowStep ? entry : null;
}

function replaceStep(step: Step) {
  const entry = historyEntry();
  history.replaceState({ flowStep: step, from: entry ? entry.from : undefined }, "", `#${step}`);
}

function go(step: Step, replace = false) {
  if (replace) replaceStep(step);
  else if (step !== currentStep) history.pushState({ flowStep: step, from: currentStep }, "", `#${step}`);
  onRoute();
}

/** In-app back: one step back, through the browser history when that's where we came from. */
function previousStep(step: Step): Step {
  if (step === "check") return isPair() ? "details-2" : "details";
  return STEPS[Math.max(0, STEPS.indexOf(step) - 1)]!;
}

function goBack() {
  const previous = previousStep(currentStep || FIRST_STEP);
  const entry = historyEntry();
  if (entry && entry.from === previous) history.back();
  else go(previous, true);
}

function onRoute() {
  const fromHash = stepFromHash();
  // A single Participant has no second person.
  const wanted = fromHash === "details-2" && !isPair() ? "details" : fromHash;
  const furthest = furthestStep();
  const allowed =
    state.result ? "done" : !wanted || wanted === "done" || STEPS.indexOf(wanted) > STEPS.indexOf(furthest) ? furthest : wanted;
  if (allowed !== fromHash || !historyEntry()) replaceStep(allowed);
  render(allowed);
}

// ---------- rendering ----------

function render(step: Step) {
  const isNewStep = step !== currentStep;
  const firstRender = currentStep === undefined;
  currentStep = step;

  const chosen = chosenDivision();
  byId("flow").className = chosen ? `div-${chosen}` : "";
  all("[data-step]").forEach((section) => show(section, section.getAttribute("data-step") === step));
  renderBar(step);
  updateLanguageLinks();

  if (step === "duration") renderChoices("[data-duration]", "data-duration", state.duration && String(state.duration));
  if (step === "single-or-pair") renderChoices("[data-single-or-pair]", "data-single-or-pair", state.singleOrPair);
  if (step === "division") renderDivisionChoices();
  if (step === "details") renderDetails(0);
  if (step === "details-2") renderDetails(1);
  if (step === "check") renderCheck();
  if (step === "done") renderDone();

  if (isNewStep && !firstRender) {
    window.scrollTo(0, 0);
    const heading = document.querySelector(`[data-step="${step}"] h2`) as HTMLElement | null;
    if (heading) heading.focus();
  }
}

function renderBar(step: Step) {
  const bar = byId("bar-sel");
  bar.innerHTML = "";
  const parts: [string, Step][] = [];
  if (state.duration) parts.push([t.durations[state.duration].name, "duration"]);
  if (state.singleOrPair) parts.push([t.singleOrPair[state.singleOrPair].name, "single-or-pair"]);
  const chosen = chosenDivision();
  if (chosen) parts.push([t.divisions[chosen].name, "division"]);
  const names = activeParticipants().map(shortName).filter((n) => n.trim());
  if (chosen && names.length) parts.push([names.join(" & "), "details"]);
  parts.forEach((part, i) => {
    const label = part[0];
    const target = part[1];
    if (i > 0) {
      const sep = el("span", "sep", "›");
      sep.setAttribute("aria-hidden", "true");
      bar.appendChild(sep);
    }
    const button = el("button", "", label) as HTMLButtonElement;
    button.type = "button";
    // After submitting, the selection stays visible but can't be changed any more.
    button.disabled = step === "done";
    button.onclick = () => go(target);
    bar.appendChild(button);
  });
  // One line that scrolls sideways (the bar never changes height); keep the newest choice in view.
  bar.scrollLeft = bar.scrollWidth;
  const n = STEP_NUMBERS[step];
  byId("stepno").textContent = fill(t.stepOf, { n, total: COUNTED_STEPS });
  (document.querySelector("#bar .progress i") as HTMLElement).style.width = `${(n / COUNTED_STEPS) * 100}%`;
}

/** Keep the current step when switching language (the server keeps the fragment across its redirect). */
function updateLanguageLinks() {
  all<HTMLAnchorElement>("[data-lang-link]").forEach((a) => {
    a.href = a.href.split("#")[0] + location.hash;
  });
}

function renderChoices(selector: string, attribute: string, selected: string | undefined) {
  all(selector).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === selected));
  });
}

/** Only the Divisions for the chosen single/pair are offered. */
function renderDivisionChoices() {
  const offered = state.singleOrPair ? DIVISIONS_FOR[state.singleOrPair] : [];
  all("[data-division]").forEach((button) => {
    show(button, offered.indexOf(button.getAttribute("data-division") as Division) >= 0);
  });
  renderChoices("[data-division]", "data-division", chosenDivision());
}

function personBox(slot: number): HTMLElement {
  return document.querySelector(`[data-person="${slot}"]`) as HTMLElement;
}

function field(slot: number, name: string): HTMLInputElement {
  return personBox(slot).querySelector(`[data-field="${name}"]`) as HTMLInputElement;
}

function renderDetails(slot: number) {
  const section = document.querySelector(`[data-step="${slot === 0 ? "details" : "details-2"}"]`) as HTMLElement;
  (section.querySelector("[data-details-heading]") as HTMLElement).textContent = isPair()
    ? slotLabel(slot)
    : t.detailsHeadingSingle;
  const box = personBox(slot);
  const p = state.participants[slot]!;
  renderGenderField(slot);
  all<HTMLInputElement>('[data-field="title"]', box).forEach((radio) => {
    radio.checked = radio.value === p.title;
  });
  field(slot, "firstName").value = p.firstName;
  field(slot, "lastName").value = p.lastName;
  field(slot, "birthYear").value = p.birthYear;
  field(slot, "club").value = p.club;
  renderBirthYearHint(slot);
}

/**
 * Mixed pair only: the first person picks; the second person sees the same
 * buttons with the opposite Gender set and the first person's greyed out.
 */
function renderGenderField(slot: number) {
  const box = personBox(slot);
  show(box.querySelector("[data-gender-field]"), isMixed());
  const gender = slot === 0 ? state.mixedFirstGender : genders()[1];
  all<HTMLInputElement>('[data-field="gender"]', box).forEach((radio) => {
    radio.checked = radio.value === gender;
    radio.disabled = slot === 1 && radio.value !== gender;
  });
  show(box.querySelector("[data-gender-note]"), false);
}

function renderBirthYearHint(slot: number) {
  const message = birthYearHint(state.participants[slot]!);
  const hint = personBox(slot).querySelector('[data-hint="birthYear"]') as HTMLElement;
  hint.textContent = message || "";
  show(hint, !!message);
}

function setError(slot: number, name: string, message: string | undefined) {
  const box = personBox(slot);
  const error = box.querySelector(`[data-error="${name}"]`) as HTMLElement | null;
  if (!error) return;
  error.textContent = message || "";
  show(error, !!message);
  // The second person of a Mixed pair has no Gender input, only the fixed text.
  const input = field(slot, name) as HTMLInputElement | null;
  if (!input) return;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function renderCheck() {
  const summary = byId("summary");
  summary.innerHTML = "";
  summary.appendChild(el("p", "cat", categoryName()));
  activeParticipants().forEach((p, slot) => {
    const row = el("div", "sum-person");
    row.appendChild(el("span", "", slotLabel(slot, true)));
    row.appendChild(el("b", "", displayName(p)));
    const year = parseBirthYear(p.birthYear, config.raceYear);
    if (year !== null) {
      row.appendChild(el("span", "", `${year} · ${fill(t.age, { age: ageInRaceYear(year, config.raceYear) })}`));
    }
    row.appendChild(el("span", "", p.club.trim() || t.noClub));
    const hint = birthYearHint(p);
    if (hint) row.appendChild(el("p", "hint", hint));
    summary.appendChild(row);
  });
  (byId("consent") as HTMLInputElement).checked = state.consent;
  show(byId("consent-error"), false);
  show(byId("rejected"), false);
}

function renderDone() {
  const chosen = chosenDivision();
  if (!state.result || !chosen) return;
  byId("done-icon").innerHTML = divisionIconSvg(chosen);
  byId("done-cat").textContent = categoryName();
  byId("done-names").textContent = activeParticipants().map(displayName).join(" & ");
  byId("done-number").textContent = String(state.result.number);
}

// ---------- submit ----------

function setSending(sending: boolean) {
  const button = byId<HTMLButtonElement>("submit");
  button.disabled = sending;
  button.textContent = sending ? t.submitting : byId("offline").hidden ? t.submit : t.retry;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function submit() {
  if (!state.consent) {
    show(byId("consent-error"), true);
    return;
  }
  show(byId("rejected"), false);
  setSending(true);
  const slotGender = genders();
  const payload = {
    attemptId: state.attemptId,
    duration: state.duration,
    consent: true,
    participants: activeParticipants().map((p, slot) => ({
      gender: slotGender[slot],
      title: p.title,
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
      birthYear: parseBirthYear(p.birthYear, config.raceYear),
      club: p.club.trim() || null,
    })),
  };
  try {
    const response = await Promise.race([
      fetch(config.submitUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      }),
      timeout(SUBMIT_TIMEOUT_MS),
    ]);
    if (response.ok) {
      const body = (await response.json()) as { number: number };
      state.result = { number: body.number };
      save();
      show(byId("offline"), false);
      go("done", true);
    } else if (response.status >= 500) {
      show(byId("offline"), true);
    } else {
      show(byId("rejected"), true);
    }
  } catch (e) {
    show(byId("offline"), true);
  }
  setSending(false);
}

// ---------- events ----------

/**
 * When the Division changes, entered details move to the slot of matching
 * Gender (a man's details never land in a woman's slot); the rest is dropped.
 * Where a Gender isn't known (a Mixed pair before or after the first person
 * picks it), details stay in their slot. Entering a Mixed pair always asks for
 * the first person's Gender again: nothing is preselected there.
 */
function changeDivision(next: Division) {
  const previous = state.division;
  if (previous && previous !== next) {
    const oldGenders = slotGenders(previous, state.mixedFirstGender);
    const old = state.participants.slice(0, oldGenders.length);
    if (next === "mixed_pair") state.mixedFirstGender = undefined;
    const used = old.map(() => false);
    const moved = slotGenders(next, state.mixedFirstGender).map((gender, slot) => {
      const index = old.findIndex((_, i) => {
        if (used[i]) return false;
        const oldGender = oldGenders[i];
        return gender && oldGender ? oldGender === gender : i === slot;
      });
      if (index < 0) return emptyParticipant();
      used[index] = true;
      const p = old[index]!;
      // A club carried into the second slot is the person's own, not a copy of the first slot's.
      if (slot === 1) p.clubEdited = p.club.trim() !== "";
      return p;
    });
    state.participants = [moved[0] || emptyParticipant(), moved[1] || emptyParticipant()];
  }
  state.division = next;
}

function afterChoice() {
  save();
  go(furthestStep());
}

all("[data-duration]").forEach((button) => {
  button.onclick = () => {
    const value = Number(button.getAttribute("data-duration"));
    if (!isDuration(value)) return;
    state.duration = value;
    afterChoice();
  };
});

all("[data-single-or-pair]").forEach((button) => {
  button.onclick = () => {
    const value = button.getAttribute("data-single-or-pair");
    if (!isSingleOrPair(value)) return;
    state.singleOrPair = value;
    afterChoice();
  };
});

all("[data-division]").forEach((button) => {
  button.onclick = () => {
    const value = button.getAttribute("data-division");
    if (!isDivision(value)) return;
    changeDivision(value);
    afterChoice();
  };
});

all("[data-back]").forEach((button) => {
  button.onclick = goBack;
});

// Tapping the greyed-out Gender of the second person explains why it can't be chosen.
all<HTMLInputElement>('[data-field="gender"]', personBox(1)).forEach((radio) => {
  (radio.parentNode as HTMLElement).onclick = () => {
    if (radio.disabled) show(personBox(1).querySelector("[data-gender-note]"), true);
  };
});

all<HTMLInputElement>('[data-field="gender"]', personBox(0)).forEach((radio) => {
  radio.onchange = () => {
    if (radio.checked && isGender(radio.value)) state.mixedFirstGender = radio.value;
    setError(0, "gender", undefined);
    save();
  };
});

[0, 1].forEach((slot) => {
  const box = personBox(slot);
  const p = () => state.participants[slot]!;
  all<HTMLInputElement>('[data-field="title"]', box).forEach((radio) => {
    radio.onchange = () => {
      if (radio.checked && isTitle(radio.value)) p().title = radio.value;
      save();
    };
  });
  TEXT_FIELDS.forEach((name) => {
    const input = field(slot, name);
    input.oninput = () => {
      p()[name] = input.value;
      // Birth-year mistakes show at once, like the age hint; other fields are checked on "Next".
      setError(slot, name, name === "birthYear" ? birthYearMessage(input.value, "typing") : undefined);
      save();
      if (name === "birthYear") renderBirthYearHint(slot);
    };
  });
  const year = field(slot, "birthYear");
  year.onblur = () => setError(slot, "birthYear", birthYearMessage(year.value, "leaving"));
  const club = field(slot, "club");
  club.oninput = () => {
    p().club = club.value;
    if (slot === 1) p().clubEdited = true;
    if (slot === 0 && !state.participants[1].clubEdited) {
      state.participants[1].club = club.value;
      field(1, "club").value = club.value;
    }
    save();
  };
});

all<HTMLFormElement>(".details-form").forEach((form) => {
  const slot = Number(form.getAttribute("data-slot"));
  form.onsubmit = (event) => {
    event.preventDefault();
    const errors = personErrors(slot);
    let firstInvalid: HTMLInputElement | undefined;
    (["gender", ...TEXT_FIELDS] as const).forEach((name) => {
      setError(slot, name, errors[name]);
      if (errors[name] && !firstInvalid) firstInvalid = field(slot, name);
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    go(furthestStep());
  };
});

byId<HTMLInputElement>("consent").onchange = (event) => {
  state.consent = (event.target as HTMLInputElement).checked;
  if (state.consent) show(byId("consent-error"), false);
  save();
};

byId("submit-form").onsubmit = (event) => {
  event.preventDefault();
  if (!byId<HTMLButtonElement>("submit").disabled) void submit();
};

byId("another").onclick = () => {
  state = freshState();
  save();
  show(byId("offline"), false);
  setSending(false);
  go(FIRST_STEP, true);
};

// popstate covers back/forward (also between identical hashes); hashchange covers hand-edited URLs.
window.addEventListener("popstate", onRoute);
window.addEventListener("hashchange", onRoute);
show(byId("flow"), true);
onRoute();
