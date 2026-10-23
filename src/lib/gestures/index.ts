// Public gesture API. Import from "@/lib/gestures" everywhere in the app.

export type {
  FingerName,
  FrameDetection,
  GestureCategory,
  GestureClassification,
  GestureClassifier,
  GestureDefinition,
  GestureId,
  HandLandmarks,
  Point,
  RecognitionSettings,
} from "./types";
export { DEFAULT_RECOGNITION_SETTINGS, RECOGNITION_LIMITS } from "./types";

export { classifyHand, classifyHand as classify } from "./classifier";
export { extractFeatures, type HandFeatures } from "./geometry";

import { classifyHand } from "./classifier";
import type { GestureClassifier } from "./types";

/**
 * Extension point for a future trained or temporal model: implement this
 * interface and pass it to the detection loop. The included implementation is
 * strictly a single-frame, single-hand landmark classifier.
 */
export const STATIC_GESTURE_CLASSIFIER: GestureClassifier = {
  id: "static-hand-landmarks-v1",
  mode: "static",
  classify: classifyHand,
};
export {
  GESTURE_DEFINITIONS,
  GESTURE_IDS,
  GESTURE_LIBRARY,
  DEFAULT_DICTIONARY,
  SAMPLE_DEMO_SEQUENCE,
} from "./vocabulary";
export { GestureStabilizer, type StabilizerOutput } from "./stabilizer";

import { DEFAULT_DICTIONARY, GESTURE_DEFINITIONS } from "./vocabulary";
import type { GestureDefinition, GestureId } from "./types";

/**
 * A gesture definition plus the current (editable) demo word for it.
 * Kept as derived data so the dictionary can change independently.
 */
export type GestureWithText = GestureDefinition & { text: string };

export function buildGestureMap(
  dictionary: Record<GestureId, string>,
): Record<GestureId, GestureWithText> {
  return Object.fromEntries(
    (Object.keys(GESTURE_DEFINITIONS) as GestureId[]).map((id) => [
      id,
      { ...GESTURE_DEFINITIONS[id], text: dictionary[id] || DEFAULT_DICTIONARY[id] },
    ]),
  ) as Record<GestureId, GestureWithText>;
}

/**
 * Sanitize a stored/partial dictionary so a missing or blank entry can never
 * leave a gesture without a word.
 */
export function normalizeDictionary(input: unknown): Record<GestureId, string> {
  const source =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return Object.fromEntries(
    (Object.keys(DEFAULT_DICTIONARY) as GestureId[]).map((id) => {
      const raw = source[id];
      const value = typeof raw === "string" ? raw.trim() : "";
      return [id, value || DEFAULT_DICTIONARY[id]];
    }),
  ) as Record<GestureId, string>;
}
