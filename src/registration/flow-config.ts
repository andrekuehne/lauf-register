import type { FlowStrings } from "../i18n";

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
