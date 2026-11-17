import type { Division, Duration, Title } from "../domain/categories";
import type { FlowStrings } from "../i18n";

/** A Participant's name as the confirmation screen shows it. */
export type ParticipantName = { title: Title; firstName: string; lastName: string };

/**
 * The answer to a successful submit: the Registration as stored, which the
 * confirmation screen shows instead of what the phone has (a repeated submit
 * may have sent other details than the ones stored the first time).
 */
export type SubmitAnswer = {
  number: number;
  duration: Duration;
  division: Division;
  /** In stored order: one, or two for a Pair. */
  participants: ParticipantName[];
  /** A repeated submit sent other details than the ones stored: nothing was changed. */
  differs: boolean;
};

/** The `error` of a refused submit (409) that the flow tells apart. */
export const SUBMIT_ERRORS = {
  /** The Admin closed Registration (also after the form was opened). */
  closed: "registration closed",
  /** The Registration's series (singles or Pairs) has no number left. */
  full: "no number left",
} as const;

/** Handed from the server-rendered page to the browser flow as JSON. */
export type FlowConfig = {
  submitUrl: string;
  /** sessionStorage key for the in-progress Registration, one per Race. */
  storageKey: string;
  /** Ages are computed for the Race's year. */
  raceYear: number;
  t: FlowStrings;
};

export const FLOW_CONFIG_ID = "flow-config";
