// Shared types for SignSpeak's static hand-gesture pipeline.

export type Point = { x: number; y: number; z?: number };

/** A MediaPipe hand: exactly 21 normalized landmarks in image space. */
export type HandLandmarks = Point[];

export type FingerName = "index" | "middle" | "ring" | "pinky";

export type GestureId =
  | "open_palm"
  | "flat_hand"
  | "fist"
  | "thumbs_up"
  | "thumbs_down"
  | "thumb_side"
  | "victory"
  | "two"
  | "three"
  | "four"
  | "point_up"
  | "point_down"
  | "point_side"
  | "ok"
  | "pinch"
  | "call_me"
  | "rock_on"
  | "i_love_you";

export type GestureCategory = "Hand shape" | "Finger count" | "Pointing" | "Thumb" | "Expressive";

export interface GestureDefinition {
  id: GestureId;
  name: string;
  emoji: string;
  /** Default word or phrase used in the demo dictionary. Editable at runtime. */
  defaultText: string;
  /** Very short one-line cue shown on demo cards. */
  hint: string;
  /** Longer positioning guide shown in the gesture library. */
  howTo: string;
  category: GestureCategory;
}

export interface GestureClassification {
  /** The matched static class, or null when the pose is not in the vocabulary. */
  gesture: GestureId | null;
  /** Human-readable explanation, always populated (used by the debug panel). */
  reason: string;
  reasonCode:
    | "matched"
    | "no_hand"
    | "bad_landmarks"
    | "ambiguous_open_flat"
    | "ambiguous_two_victory"
    | "ambiguous_thumb_direction"
    | "ambiguous_pinch"
    | "pose_not_in_vocabulary";
}

export interface RecognitionSettings {
  /** Consecutive frames a class must be predicted before it can be accepted. */
  stabilityFrames: number;
  /** Minimum time between any two accepted insertions. */
  cooldownMs: number;
  /** Holding the same pose this long deliberately adds the same word again. */
  repeatHoldMs: number;
}

export const DEFAULT_RECOGNITION_SETTINGS: RecognitionSettings = {
  stabilityFrames: 8,
  cooldownMs: 1200,
  repeatHoldMs: 6000,
};

export const RECOGNITION_LIMITS = {
  stabilityFrames: { min: 4, max: 20, step: 1 },
  cooldownMs: { min: 400, max: 4000, step: 100 },
  repeatHoldMs: { min: 3000, max: 10000, step: 250 },
} as const;

export interface GestureClassifier {
  readonly id: string;
  /** Static classifiers see one frame; temporal models receive a sequence later. */
  readonly mode: "static" | "temporal";
  classify(hand: HandLandmarks): GestureClassification;
}

export interface FrameDetection {
  handCount: number;
  /** Raw per-frame classifier output. */
  gesture: GestureId | null;
  /** Classifier reason for the raw output (matched or rejected). */
  reason: string;
  /** Stability of the current pose, 0..1. */
  stability: number;
  stableFrames: number;
  needFrames: number;
  /** Gesture accepted this frame, if any. */
  accepted: GestureId | null;
  /** Why a stable gesture was not accepted, if applicable. */
  rejection: string | null;
  /** Model delegate actually used. */
  delegate: "GPU" | "CPU" | "unknown";
  fps: number;
}
