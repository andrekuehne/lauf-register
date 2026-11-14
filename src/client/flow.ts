// The registration flow in the browser. Bundled by scripts/build-client.mjs for
// ~iOS 12 / Android 8 browsers and inlined into the page.
// Steps live in the URL hash (#division, #duration, …) so the phone's back
// button returns to the previous screen; each history entry remembers which
// step it was opened from, so the in-app back button never leaves the page. In-progress data sits in sessionStorage.

import {
  isDivision,
  isDuration,
  isTitle,
  slotGenders,
  type Division,
  type Duration,
  type Gender,
  type Title,
} from "../domain/categories";
import {
  ageInRaceYear,
  isImplausibleBirthYear,
  kidsTitleMismatch,
  birthYearError,
  parseBirthYear,
  titleContradictsSlot,
} from "../domain/participant-checks";
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
type FieldMessages = Partial<Record<TextField, string>>;

type State = {
  division?: Division;
  duration?: Duration;
  participants: [Participant, Participant];
  consent: boolean;
  /** Sent with every submit of this Registration; a repeat returns the same Registration. */
  attemptId: string;
  result?: { number: number };
};

const STEPS = ["division", "duration", "details", "check", "done"] as const;
type Step = (typeof STEPS)[number];
/** "done" isn't counted in "Step n of 4". */
const COUNTED_STEPS = STEPS.length - 1;
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
    if (saved.division !== undefined && !isDivision(saved.division)) return null;
    if (saved.duration !== undefined && !isDuration(saved.duration)) return null;
    saved.participants.forEach((p) => {
      if (!isTitle(p.title)) p.title = "none";
    });
    return saved;
  } catch (e) {
    return null;
  }
}

// ---------- derived values ----------

function genders(): Gender[] {
  return state.division ? slotGenders(state.division) : ["F"];
}

function activeParticipants(): Participant[] {
  return state.participants.slice(0, genders().length);
}

function isPair(): boolean {
  return genders().length === 2;
}

function slotLabel(slot: number): string {
  if (!isPair()) return "";
  if (state.division === "mixed_pair") return slot === 0 ? t.slotWoman : t.slotMan;
  return fill(t.slotParticipant, { n: slot + 1 });
}

function personErrors(p: Participant): FieldMessages {
  const errors: FieldMessages = {};
  if (!p.firstName.trim()) errors.firstName = t.required;
  if (!p.lastName.trim()) errors.lastName = t.required;
  const yearError = birthYearError(p.birthYear, config.raceYear);
  if (!p.birthYear.trim()) errors.birthYear = t.required;
  else if (yearError === "future") errors.birthYear = t.birthYearFuture;
  else if (yearError) errors.birthYear = t.birthYearInvalid;
  return errors;
}

function detailsComplete(): boolean {
  return activeParticipants().every((p) => Object.keys(personErrors(p)).length === 0);
}

/** Gentle, non-blocking hints for one person. */
function personHints(p: Participant, slot: number): { title?: string; birthYear?: string } {
  const hints: { title?: string; birthYear?: string } = {};
  const year = parseBirthYear(p.birthYear, config.raceYear);
  const titleHints: string[] = [];
  if (titleContradictsSlot(p.title, genders()[slot] || "F")) {
    titleHints.push(fill(t.titleCheck, { title: t.titles[p.title] }));
  }
  if (year !== null) {
    const age = ageInRaceYear(year, config.raceYear);
    const kids = kidsTitleMismatch(p.title, age);
    if (kids === "kids-but-adult") titleHints.push(t.kidsButAdult);
    if (kids === "child-without-kids") titleHints.push(t.childWithoutKids);
    if (isImplausibleBirthYear(year, config.raceYear)) hints.birthYear = fill(t.birthYearCheck, { age });
  }
  if (titleHints.length) hints.title = titleHints.join(" ");
  return hints;
}

/** The furthest step the current data allows. */
function furthestStep(): Step {
  if (state.result) return "done";
  if (!state.division) return "division";
  if (!state.duration) return "duration";
  if (!detailsComplete()) return "details";
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

function categoryName(): string {
  if (!state.division || !state.duration) return "";
  return `${t.divisions[state.division].name} · ${t.durations[state.duration].name}`;
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
function goBack() {
  const previous = STEPS[Math.max(0, STEPS.indexOf(currentStep || "division") - 1)]!;
  const entry = historyEntry();
  if (entry && entry.from === previous) history.back();
  else go(previous, true);
}

function onRoute() {
  const wanted = stepFromHash();
  const furthest = furthestStep();
  const allowed =
    state.result ? "done" : !wanted || wanted === "done" || STEPS.indexOf(wanted) > STEPS.indexOf(furthest) ? furthest : wanted;
  if (allowed !== wanted || !historyEntry()) replaceStep(allowed);
  render(allowed);
}

// ---------- rendering ----------

function render(step: Step) {
  const isNewStep = step !== currentStep;
  const firstRender = currentStep === undefined;
  currentStep = step;

  byId("flow").className = state.division ? `div-${state.division}` : "";
  all("[data-step]").forEach((section) => show(section, section.getAttribute("data-step") === step));
  renderBar(step);
  renderStepNumber(step);
  updateLanguageLinks();

  if (step === "division") renderChoices("[data-division]", "data-division", state.division);
  if (step === "duration") renderChoices("[data-duration]", "data-duration", state.duration && String(state.duration));
  if (step === "details") renderDetails();
  if (step === "check") renderCheck();
  if (step === "done") renderDone();

  if (isNewStep && !firstRender) {
    window.scrollTo(0, 0);
    const heading = document.querySelector(`[data-step="${step}"] h2`) as HTMLElement | null;
    if (heading) heading.focus();
  }
}

function renderBar(step: Step) {
  const bar = byId("bar");
  bar.innerHTML = "";
  const parts: [string, Step][] = [];
  if (state.division) parts.push([t.divisions[state.division].name, "division"]);
  if (state.duration) parts.push([t.durations[state.duration].name, "duration"]);
  const names = activeParticipants().map(shortName).filter((n) => n.trim());
  if (names.length) parts.push([names.join(" & "), "details"]);
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
    button.onclick = () => go(target);
    bar.appendChild(button);
  });
  show(bar, parts.length > 0 && step !== "done");
}

function renderStepNumber(step: Step) {
  const box = byId("stepno");
  const n = STEPS.indexOf(step) + 1;
  show(box, step !== "done");
  (box.querySelector(".stepno") as HTMLElement).textContent = fill(t.stepOf, { n, total: COUNTED_STEPS });
  (box.querySelector(".progress i") as HTMLElement).style.width = `${(n / COUNTED_STEPS) * 100}%`;
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

function personBox(slot: number): HTMLElement {
  return document.querySelector(`[data-person="${slot}"]`) as HTMLElement;
}

function field(slot: number, name: string): HTMLInputElement {
  return personBox(slot).querySelector(`[data-field="${name}"]`) as HTMLInputElement;
}

function renderDetails() {
  (document.querySelector("[data-details-heading]") as HTMLElement).textContent = isPair() ? t.detailsHeadingPair : t.detailsHeadingSingle;
  [0, 1].forEach((slot) => {
    const box = personBox(slot);
    const p = state.participants[slot]!;
    show(box, slot < genders().length);
    const label = box.querySelector("[data-slot-label]") as HTMLElement;
    label.textContent = slotLabel(slot);
    show(label, isPair());
    all<HTMLInputElement>('[data-field="title"]', box).forEach((radio) => {
      radio.checked = radio.value === p.title;
    });
    field(slot, "firstName").value = p.firstName;
    field(slot, "lastName").value = p.lastName;
    field(slot, "birthYear").value = p.birthYear;
    field(slot, "club").value = p.club;
    renderHints(slot);
  });
}

function renderHints(slot: number) {
  const hints = personHints(state.participants[slot]!, slot);
  const box = personBox(slot);
  (["title", "birthYear"] as const).forEach((name) => {
    const hint = box.querySelector(`[data-hint="${name}"]`) as HTMLElement;
    hint.textContent = hints[name] || "";
    show(hint, !!hints[name]);
  });
}

function setError(slot: number, name: string, message: string | undefined) {
  const box = personBox(slot);
  const error = box.querySelector(`[data-error="${name}"]`) as HTMLElement;
  error.textContent = message || "";
  show(error, !!message);
  const input = field(slot, name);
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function renderCheck() {
  const summary = byId("summary");
  summary.innerHTML = "";
  summary.appendChild(el("p", "cat", categoryName()));
  activeParticipants().forEach((p, slot) => {
    const row = el("div", "sum-person");
    if (isPair()) row.appendChild(el("span", "", slotLabel(slot)));
    row.appendChild(el("b", "", displayName(p)));
    const year = parseBirthYear(p.birthYear, config.raceYear);
    if (year !== null) {
      row.appendChild(el("span", "", `${year} · ${fill(t.age, { age: ageInRaceYear(year, config.raceYear) })}`));
    }
    row.appendChild(el("span", "", p.club.trim() || t.noClub));
    const hints = personHints(p, slot);
    [hints.title, hints.birthYear].forEach((hint) => {
      if (hint) row.appendChild(el("p", "hint", hint));
    });
    summary.appendChild(row);
  });
  (byId("consent") as HTMLInputElement).checked = state.consent;
  show(byId("consent-error"), false);
  show(byId("rejected"), false);
}

function renderDone() {
  if (!state.result || !state.division) return;
  byId("done-icon").innerHTML = divisionIconSvg(state.division);
  byId("done-cat").textContent = categoryName();
  byId("done-names").textContent = activeParticipants().map(displayName).join(" & ");
  byId("done-number").textContent = `#${String(state.result.number).padStart(3, "0")}`;
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
  const payload = {
    attemptId: state.attemptId,
    division: state.division,
    duration: state.duration,
    consent: true,
    participants: activeParticipants().map((p) => ({
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
 * gender (a man's details never land in a woman's slot); the rest is dropped.
 */
function changeDivision(next: Division) {
  if (state.division && state.division !== next) {
    const oldGenders = slotGenders(state.division);
    const old = state.participants.slice(0, oldGenders.length);
    const used = old.map(() => false);
    const moved = slotGenders(next).map((gender, slot) => {
      const index = old.findIndex((_, i) => !used[i] && oldGenders[i] === gender);
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

all("[data-division]").forEach((button) => {
  button.onclick = () => {
    const value = button.getAttribute("data-division");
    if (!isDivision(value)) return;
    changeDivision(value);
    afterChoice();
  };
});

all("[data-duration]").forEach((button) => {
  button.onclick = () => {
    const value = Number(button.getAttribute("data-duration"));
    if (!isDuration(value)) return;
    state.duration = value;
    afterChoice();
  };
});

all("[data-back]").forEach((button) => {
  button.onclick = goBack;
});

[0, 1].forEach((slot) => {
  const box = personBox(slot);
  const p = () => state.participants[slot]!;
  all<HTMLInputElement>('[data-field="title"]', box).forEach((radio) => {
    radio.onchange = () => {
      if (radio.checked && isTitle(radio.value)) p().title = radio.value;
      save();
      renderHints(slot);
    };
  });
  TEXT_FIELDS.forEach((name) => {
    const input = field(slot, name);
    input.oninput = () => {
      p()[name] = input.value;
      setError(slot, name, undefined);
      save();
      if (name === "birthYear") renderHints(slot);
    };
  });
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

byId("details-form").onsubmit = (event) => {
  event.preventDefault();
  let firstInvalid: HTMLInputElement | undefined;
  activeParticipants().forEach((p, slot) => {
    const errors = personErrors(p);
    TEXT_FIELDS.forEach((name) => {
      setError(slot, name, errors[name]);
      if (errors[name] && !firstInvalid) firstInvalid = field(slot, name);
    });
  });
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }
  go("check");
};

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
  go("division", true);
};

// popstate covers back/forward (also between identical hashes); hashchange covers hand-edited URLs.
window.addEventListener("popstate", onRoute);
window.addEventListener("hashchange", onRoute);
show(byId("flow"), true);
onRoute();
