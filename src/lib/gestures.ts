// Small-vocabulary gesture classifier based on MediaPipe's 21 hand landmarks.
// Add a new gesture by appending to GESTURES and adding a rule in classify().

export type Point = { x: number; y: number; z?: number };

export type GestureId = "open_palm" | "fist" | "thumbs_up" | "thumbs_down" | "victory";

export const GESTURES: Record<GestureId, { name: string; text: string; emoji: string; hint: string }> = {
  open_palm: { name: "Open Palm", text: "Hello", emoji: "🖐️", hint: "All five fingers spread" },
  fist: { name: "Closed Fist", text: "Stop", emoji: "✊", hint: "All fingers curled in" },
  thumbs_up: { name: "Thumbs Up", text: "Yes", emoji: "👍", hint: "Thumb pointing up" },
  thumbs_down: { name: "Thumbs Down", text: "No", emoji: "👎", hint: "Thumb pointing down" },
  victory: { name: "Victory Sign", text: "Thank You", emoji: "✌️", hint: "Index + middle up" },
};

const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Returns a gesture id, or null when the hand shape is not reliably one of the vocabulary. */
export function classify(lm: Point[]): GestureId | null {
  if (!lm || lm.length < 21) return null;
  const wrist = lm[0];
  const palm = d(wrist, lm[9]) || 1e-6; // hand scale
  const ext = (tip: number, pip: number) => d(wrist, lm[tip]) > d(wrist, lm[pip]) * 1.15;
  const curled = (tip: number, pip: number) => d(wrist, lm[tip]) < d(wrist, lm[pip]) * 1.02;

  const index = ext(8, 6), middle = ext(12, 10), ring = ext(16, 14), pinky = ext(20, 18);
  const indexC = curled(8, 6), middleC = curled(12, 10), ringC = curled(16, 14), pinkyC = curled(20, 18);
  // Thumb is "out" when its tip is far from the index knuckle relative to palm size.
  const thumbOut = d(lm[4], lm[5]) / palm > 0.55 && d(lm[4], lm[9]) > d(lm[3], lm[9]);
  const allCurled = indexC && middleC && ringC && pinkyC;

  if (index && middle && ring && pinky && thumbOut) return "open_palm";
  if (index && middle && ringC && pinkyC) return "victory";
  if (allCurled && thumbOut) {
    const dy = (lm[4].y - lm[2].y) / palm; // image y grows downward
    if (dy < -0.45) return "thumbs_up";
    if (dy > 0.45) return "thumbs_down";
    return null;
  }
  if (allCurled && !thumbOut) return "fist";
  return null;
}

/**
 * Stabilizer: a gesture is only emitted after it is seen in `need` consecutive frames,
 * and the same gesture is not re-emitted until the hand changes or the cooldown passes.
 */
export class GestureStabilizer {
  private last: GestureId | null | undefined;
  private count = 0;
  private lastEmitted: GestureId | null = null;
  private lastEmitAt = 0;
  constructor(private need = 10, private cooldownMs = 1200, private repeatMs = 3500) {}

  push(g: GestureId | null, now: number): { emit: GestureId | null; consistency: number } {
    if (g === this.last) this.count++;
    else { this.last = g; this.count = 1; }
    if (g === null) { if (this.count > this.need) this.lastEmitted = null; return { emit: null, consistency: 0 }; }
    const consistency = Math.min(1, this.count / this.need);
    if (this.count >= this.need && now - this.lastEmitAt > this.cooldownMs) {
      const isRepeat = g === this.lastEmitted;
      if (!isRepeat || now - this.lastEmitAt > this.repeatMs) {
        this.lastEmitted = g; this.lastEmitAt = now; this.count = 0;
        return { emit: g, consistency: 1 };
      }
    }
    return { emit: null, consistency };
  }
  reset() { this.last = undefined; this.count = 0; this.lastEmitted = null; }
}
