import type { GestureId } from "./gestures";

export type InputMode = "Live Camera" | "Sample Demo" | "Idle";

export interface GestureHistoryEntry {
  id: number;
  gestureId: GestureId;
  text: string;
  source: "live" | "demo";
  at: number;
}
