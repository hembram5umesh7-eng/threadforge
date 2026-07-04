import ws from "ws";
import type { RealtimeClientOptions } from "@supabase/realtime-js";

/** Realtime transport for Node.js < 22 (no native WebSocket). Server-only. */
export const nodeRealtimeOptions: RealtimeClientOptions = {
  transport: ws as unknown as NonNullable<RealtimeClientOptions["transport"]>,
};
