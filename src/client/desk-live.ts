// The Anmeldetisch updates itself (docs/adr/0006). It connects to its Race's
// WebSocket and puts each change in place as it arrives: new and changed rows,
// deleted ones gone, the side column's status, the counts. Silently: a new
// Registration shows only if it matches the search, the rows on screen don't
// jump, and new or changed rows are highlighted for a few seconds.
// Whenever it (re)connects it loads the whole list again, as it may have missed
// changes in between. A status line says whether it is live.
// Bundled by scripts/build-client.mjs for ~iOS 12 / Android 8 browsers and
// inlined into the Anmeldetisch (src/admin/desk-page.tsx).

import { DESK_LIVE, KEEP_ALIVE, LIST_CHANGED_EVENT, type DeskUpdate } from "../shared/desk-update";
import { registrationCount } from "../shared/registration-count";

const STATUS = {
  connecting: "Verbinde …",
  live: "Live",
  lost: "Getrennt – verbinde neu …",
  signedOut: "Getrennt – Anmeldung abgelaufen. Bitte die Seite neu laden.",
} as const;
type Status = keyof typeof STATUS;

/** How long to wait before each reconnect in a row, in seconds; the last repeats. */
const RETRY_SECONDS = [1, 2, 5, 10, 15];
/** How often the connection is checked, and how long its answer may take, in milliseconds. */
const KEEP_ALIVE_EVERY = 25_000;
const KEEP_ALIVE_WAIT = 10_000;
/** How long a new or changed row stays highlighted, in milliseconds. */
const HIGHLIGHT_FOR = 6_000;

const ROW = `li[${DESK_LIVE.id}]`;

/** The elements matching the selector within `root`, as an array (NodeList.forEach is missing on some older phones). */
const all = (selector: string, root: ParentNode = document) => Array.prototype.slice.call(root.querySelectorAll(selector)) as HTMLElement[];
const one = (selector: string, root: ParentNode = document) => root.querySelector(selector) as HTMLElement | null;
const idOf = (row: Element) => Number(row.getAttribute(DESK_LIVE.id));

const list = one(`ul[${DESK_LIVE.socketPath}]`);
const connectionLine = one(`[${DESK_LIVE.connection}]`);

if (list && connectionLine && "WebSocket" in window) {
  const socketPath = list.getAttribute(DESK_LIVE.socketPath) || "";
  const socketUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${socketPath}`;

  let socket: WebSocket | null = null;
  /** Updates that arrive while the whole list loads, applied after it. */
  let queued: DeskUpdate[] | null = null;
  let retries = 0;
  let retryTimer: number | undefined;
  let answerTimer: number | undefined;
  let signedOut = false;
  /** Whether the list was loaded since the page opened: the first load, just after the page's own, highlights nothing. */
  let loadedOnce = false;

  const show = (status: Status) => {
    connectionLine.hidden = false;
    connectionLine.textContent = STATUS[status];
    connectionLine.setAttribute("data-state", status);
  };

  /** Rows by id. */
  const rowsById = () => {
    const rows: Record<number, HTMLElement> = {};
    for (const row of all(ROW, list)) rows[idOf(row)] = row;
    return rows;
  };

  /** An element from its HTML, parsed within a list (rows) or a div (the status). */
  const element = (html: string, within: "ul" | "div") => {
    const holder = document.createElement(within);
    holder.innerHTML = html;
    return holder.firstElementChild as HTMLElement;
  };

  const highlight = (row: HTMLElement) => {
    row.classList.add("desk-fresh");
    window.setTimeout(() => row.classList.remove("desk-fresh"), HIGHLIGHT_FOR);
  };

  /** Puts `row` in its place, newest first (the higher the id, the newer), or in place of the row it replaces. */
  const place = (row: HTMLElement) => {
    const id = idOf(row);
    const rows = all(ROW, list);
    const same = rows.filter((r) => idOf(r) === id)[0];
    if (same) {
      list.replaceChild(row, same);
      return;
    }
    const older = rows.filter((r) => idOf(r) < id)[0];
    list.insertBefore(row, older || null);
  };

  /** Counts, total, the empty-list note and the search, for the rows the list has now. */
  const listChanged = () => {
    const rows = all(ROW, list);
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const duration = row.getAttribute(DESK_LIVE.duration);
      for (const key of [`${duration}`, `${duration} ${row.getAttribute(DESK_LIVE.division)}`]) counts[key] = (counts[key] || 0) + 1;
    }
    for (const cell of all(`[${DESK_LIVE.count}]`)) cell.textContent = String(counts[cell.getAttribute(DESK_LIVE.count) || ""] || 0);
    const total = one(`[${DESK_LIVE.total}]`);
    if (total) total.textContent = registrationCount(rows.length);
    const empty = one(".desk-empty");
    if (empty) empty.hidden = rows.length > 0;
    // The search hides what doesn't match (src/client/race-search.ts), right away.
    document.dispatchEvent(new Event(LIST_CHANGED_EVENT));
  };

  /**
   * Changes the list with `change` without moving the rows on screen: the first
   * row in view stays where it was, the page scrolling by what was added or
   * removed above it. When that row is gone or hidden by the search afterwards,
   * the next one in view that is still shown stays put instead.
   */
  const keepInPlace = (change: () => void) => {
    const inView = all(ROW, list)
      .filter((row) => !row.hidden)
      .map((row) => ({ id: idOf(row), top: row.getBoundingClientRect().top, bottom: row.getBoundingClientRect().bottom }))
      .filter((row) => row.bottom > 0 && row.top < window.innerHeight);
    change();
    const rows = rowsById();
    const anchor = inView.filter((row) => rows[row.id] && !rows[row.id]!.hidden)[0];
    if (anchor) window.scrollBy(0, rows[anchor.id]!.getBoundingClientRect().top - anchor.top);
  };

  const replaceStatus = (html: string) => {
    const current = one(`[${DESK_LIVE.status}]`);
    if (current && current.parentNode) current.parentNode.replaceChild(element(html, "div"), current);
  };

  const apply = (update: DeskUpdate) => {
    keepInPlace(() => {
      const rows = rowsById();
      for (const id of update.deleted) {
        const row = rows[id];
        if (row) list.removeChild(row);
      }
      for (const changed of update.changed) {
        const row = element(changed.html, "ul");
        place(row);
        highlight(row);
      }
      replaceStatus(update.status);
      listChanged();
    });
  };

  /** Loads the whole Anmeldetisch again and puts its list and status in place; rows that differ are highlighted. */
  const reloadAll = () =>
    fetch(location.href, { credentials: "same-origin", cache: "no-store" })
      .then((res) => {
        if (!res.ok || res.redirected) throw new Error(`Anmeldetisch not loaded: ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const page = new DOMParser().parseFromString(html, "text/html");
        const freshList = one(`ul[${DESK_LIVE.socketPath}]`, page);
        const freshStatus = one(`[${DESK_LIVE.status}]`, page);
        if (!freshList || !freshStatus) throw new Error("Anmeldetisch not loaded");
        keepInPlace(() => {
          const before = rowsById();
          while (list.firstChild) list.removeChild(list.firstChild);
          for (const row of all(ROW, freshList)) {
            const imported = document.importNode(row, true) as HTMLElement;
            list.appendChild(imported);
            const old = before[idOf(row)];
            // What it shows, leaving aside what the search and highlighting set on the row itself.
            if (loadedOnce && (!old || old.innerHTML !== row.innerHTML)) highlight(imported);
          }
          replaceStatus(freshStatus.outerHTML);
          listChanged();
        });
        loadedOnce = true;
      });

  /**
   * The sign-in still lets this browser in: false once Access sends it to the
   * sign-in (or the Worker refuses it), undefined when that can't be told
   * (offline). Asks the WebSocket's own path without upgrading, which answers
   * 426 once past the sign-in and reads next to nothing.
   */
  const stillSignedIn = (): Promise<boolean | undefined> =>
    fetch(socketPath, { credentials: "same-origin", cache: "no-store", redirect: "manual" }).then(
      (res) => (res.status === 426 ? true : res.type === "opaqueredirect" || res.status === 401 || res.status === 403 ? false : undefined),
      () => undefined,
    );

  const scheduleReconnect = () => {
    window.clearTimeout(retryTimer);
    const seconds = RETRY_SECONDS[Math.min(retries, RETRY_SECONDS.length - 1)]!;
    retries++;
    retryTimer = window.setTimeout(connect, seconds * 1000);
  };

  /** Gives up on `ws` and reconnects; a connection that never opened may have been refused by the sign-in, so that is checked first. */
  const drop = (ws: WebSocket, opened: boolean) => {
    if (socket !== ws) return;
    socket = null;
    queued = null;
    window.clearTimeout(answerTimer);
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try {
      ws.close();
    } catch {
      // Already closed.
    }
    show("lost");
    if (opened) return scheduleReconnect();
    stillSignedIn().then((signedIn) => {
      if (signedIn !== false) return scheduleReconnect();
      signedOut = true;
      show("signedOut");
    });
  };

  function connect() {
    window.clearTimeout(retryTimer);
    if (socket || signedOut) return;
    const ws = new WebSocket(socketUrl);
    socket = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      queued = [];
      reloadAll().then(
        () => {
          if (socket !== ws || !queued) return;
          const waiting = queued;
          queued = null;
          for (const update of waiting) apply(update);
          retries = 0;
          show("live");
        },
        () => drop(ws, false),
      );
    };
    ws.onmessage = (event) => {
      if (socket !== ws) return;
      if (event.data === KEEP_ALIVE.pong) {
        window.clearTimeout(answerTimer);
        return;
      }
      const update = JSON.parse(String(event.data)) as DeskUpdate;
      if (queued) queued.push(update);
      else apply(update);
    };
    ws.onclose = ws.onerror = () => drop(ws, opened);
  }

  /** Checks the connection now: a socket left over from before the tablet slept may be dead without having said so. */
  const checkConnection = () => {
    if (!socket) {
      if (!signedOut) connect();
      return;
    }
    if (socket.readyState !== WebSocket.OPEN) return;
    const ws = socket;
    window.clearTimeout(answerTimer);
    try {
      ws.send(KEEP_ALIVE.ping);
    } catch {
      return drop(ws, true);
    }
    answerTimer = window.setTimeout(() => drop(ws, true), KEEP_ALIVE_WAIT);
  };

  window.setInterval(checkConnection, KEEP_ALIVE_EVERY);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkConnection();
  });
  window.addEventListener("online", checkConnection);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) checkConnection();
  });

  show("connecting");
  connect();
}
