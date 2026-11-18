// What the server pushes to a Race's Anmeldetisch screens (src/admin/desk-live.tsx)
// and the screen applies in place (src/client/desk-live.ts), with the keep-alive
// both sides use (src/live/desk-screens.ts).

/**
 * One change to what the Anmeldetisch shows, sent once the write succeeded.
 * Everything in it is as the Anmeldetisch's page renders it, so the screen
 * puts it in place as is.
 */
export type DeskUpdate = {
  /** New and changed Registrations, each its row (by Registration id, which stays when its number changes). */
  changed: { id: number; html: string }[];
  /** Ids of Registrations deleted. */
  deleted: number[];
  /** The side column's status: the toggle (whether Registration is open) and the numbers left per series. */
  status: string;
};

/** Sent by a screen to check its connection, answered without waking the Durable Object. */
export const KEEP_ALIVE = { ping: "ping", pong: "pong" } as const;

/** Attributes the Anmeldetisch's page marks its live parts with, for the screen to find them. */
export const DESK_LIVE = {
  /** On the list: the path of its WebSocket. */
  socketPath: "data-live",
  /** On each row: the Registration's id. */
  id: "data-id",
  /** On each row: its Duration and Division, which the counts are counted by. */
  duration: "data-duration",
  division: "data-division",
  /** The side column's status (the toggle and the numbers left), replaced as a whole. */
  status: "data-desk-status",
  /** Each count's cell: "duration" or "duration division". */
  count: "data-count",
  /** The total in the heading. */
  total: "data-desk-total",
  /** The connection's status line. */
  connection: "data-desk-connection",
} as const;

/** Fired on the document after the list changed, so the search applies to the rows it now has. */
export const LIST_CHANGED_EVENT = "registrations-changed";
