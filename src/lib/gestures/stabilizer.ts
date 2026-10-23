// Turns per-frame classifier output into deliberate, rate-limited word events.
//
// A gesture is accepted only when:
//   1. the same class is seen for `stabilityFrames` consecutive frames,
//   2. the cooldown since the previous accepted word has passed, and
//   3. it is either a new gesture, or the hand was released, or the pose has
//      been held for `repeatHoldMs` as an intentional repeat.
//
// Without this layer a single held hand would add a word on every frame.

import { DEFAULT_RECOGNITION_SETTINGS, type GestureId, type RecognitionSettings } from "./types";

const RELEASE_FRAMES = 6;

export interface StabilizerOutput {
  /** Gesture accepted this frame, if any. */
  emit: GestureId | null;
  /** Stability of the current pose, 0..1. */
  consistency: number;
  stableFrames: number;
  needFrames: number;
  /** Current stable gesture (may be null). */
  gesture: GestureId | null;
  /** Explanation when a stable pose was deliberately not accepted. */
  rejection: string | null;
}

export class GestureStabilizer {
  private needFrames: number;
  private cooldownMs: number;
  private repeatHoldMs: number;

  private current: GestureId | null | undefined;
  private frames = 0;
  private releaseFrames = 0;
  private armed = true;
  private differentFrames = 0;
  private lastAccepted: GestureId | null = null;
  private lastAcceptedAt = -Infinity;

  constructor(
    needFrames = DEFAULT_RECOGNITION_SETTINGS.stabilityFrames,
    cooldownMs = DEFAULT_RECOGNITION_SETTINGS.cooldownMs,
    repeatHoldMs = DEFAULT_RECOGNITION_SETTINGS.repeatHoldMs,
  ) {
    this.needFrames = needFrames;
    this.cooldownMs = cooldownMs;
    this.repeatHoldMs = repeatHoldMs;
  }

  configure(settings: Partial<RecognitionSettings>) {
    if (settings.stabilityFrames !== undefined)
      this.needFrames = Math.max(1, settings.stabilityFrames);
    if (settings.cooldownMs !== undefined) this.cooldownMs = Math.max(0, settings.cooldownMs);
    if (settings.repeatHoldMs !== undefined) this.repeatHoldMs = Math.max(0, settings.repeatHoldMs);
  }

  getRequiredFrames() {
    return this.needFrames;
  }

  push(gesture: GestureId | null, now: number): StabilizerOutput {
    if (gesture === this.current) {
      this.frames += 1;
    } else {
      this.current = gesture;
      this.frames = 1;
      this.releaseFrames = 0;
    }

    if (gesture === null) {
      this.releaseFrames += 1;
      if (this.releaseFrames >= RELEASE_FRAMES) this.armed = true;
      return {
        emit: null,
        consistency: 0,
        stableFrames: 0,
        needFrames: this.needFrames,
        gesture: null,
        rejection: null,
      };
    }

    // A different pose re-arms insertion only after a few frames, so a
    // one-frame landmark flicker cannot re-add the previous word.
    if (gesture !== this.lastAccepted) {
      this.differentFrames += 1;
      if (this.differentFrames >= 3) this.armed = true;
    } else {
      this.differentFrames = 0;
    }
    this.releaseFrames = 0;

    const consistency = Math.min(1, this.frames / this.needFrames);
    const base = {
      consistency,
      // Cap the reported frame count so the UI reads 8/8, not 112/8, while a
      // pose is held for a deliberate repeat.
      stableFrames: Math.min(this.frames, this.needFrames),
      needFrames: this.needFrames,
      gesture,
    };

    if (this.frames < this.needFrames) {
      return {
        ...base,
        emit: null,
        rejection: `Stabilizing — hold still (${this.frames}/${this.needFrames} frames)`,
      };
    }

    const sinceAccepted = now - this.lastAcceptedAt;
    if (sinceAccepted < this.cooldownMs) {
      return {
        ...base,
        emit: null,
        rejection: `Cooldown — ${((this.cooldownMs - sinceAccepted) / 1000).toFixed(1)}s until the next word`,
      };
    }

    if (!this.armed) {
      const sinceAcceptedMs = Math.max(0, now - this.lastAcceptedAt);
      if (sinceAcceptedMs < this.repeatHoldMs) {
        return {
          ...base,
          emit: null,
          rejection: `Already added — release the pose or hold ${((this.repeatHoldMs - sinceAcceptedMs) / 1000).toFixed(1)}s more to repeat`,
        };
      }
      // Holding the pose is an intentional repeat.
    }

    this.armed = false;
    this.differentFrames = 0;
    this.lastAccepted = gesture;
    this.lastAcceptedAt = now;
    return { ...base, emit: gesture, rejection: null };
  }

  reset() {
    this.current = undefined;
    this.frames = 0;
    this.releaseFrames = 0;
    this.armed = true;
    this.differentFrames = 0;
    this.lastAccepted = null;
    this.lastAcceptedAt = -Infinity;
  }
}
