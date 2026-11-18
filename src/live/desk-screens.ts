// The Anmeldetisch screens of one Race, connected over WebSockets: a Durable
// Object per Race (docs/adr/0006). Each write that changes what the screens show
// sends them a DeskUpdate through `send` (src/admin/desk-live.tsx). Hibernation
// API: between messages the object sleeps and an idle connection costs nothing;
// the screens' keep-alive pings are answered without waking it.

import { DurableObject } from "cloudflare:workers";
import { KEEP_ALIVE } from "../shared/desk-update";

export class DeskScreens extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(KEEP_ALIVE.ping, KEEP_ALIVE.pong));
  }

  /** Connects a screen: the WebSocket upgrade, already checked by the admin route (src/admin/desk-live.tsx). */
  async fetch(): Promise<Response> {
    const { 0: screen, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: screen });
  }

  /** Sends `message` to every connected screen; one that can't take it any more is skipped (it reconnects). */
  send(message: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // Closing or gone.
      }
    }
  }

  /** Screens send nothing but keep-alive pings, which the auto-response answers. */
  async webSocketMessage(): Promise<void> {}

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    // 1005/1006 (no code, abnormal) can't be sent back.
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      // Already closed.
    }
  }
}
