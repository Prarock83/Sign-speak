// Static gesture classifier built from MediaPipe hand landmarks.
//
// Design rules:
//  - Only classify poses that can be separated using the 21 landmarks.
//  - Ambiguous boundary poses are rejected instead of being forced into a class.
//  - Each gesture is one explicit branch; adding a new class means adding one
//    GestureDefinition in vocabulary.ts and a branch here (plus a dictionary entry).

import { extractFeatures, isValidHand, type HandFeatures } from "./geometry";
import type { GestureClassification, HandLandmarks } from "./types";

const MATCH = (
  gesture: GestureClassification["gesture"],
  reason = "Matched supported gesture",
): GestureClassification => ({
  gesture,
  reason,
  reasonCode: "matched",
});

const REJECT = (
  reasonCode: GestureClassification["reasonCode"],
  reason: string,
): GestureClassification => ({ gesture: null, reason, reasonCode });

/**
 * Classify a single hand. MediaPipe reports normalized image coordinates:
 * x grows right, y grows down, so a thumbs-up has a negative thumb y direction.
 */
export function classifyHand(raw: HandLandmarks | undefined | null): GestureClassification {
  if (!raw || raw.length === 0) return REJECT("no_hand", "No hand detected");
  if (!isValidHand(raw)) return REJECT("bad_landmarks", "Hand landmarks were incomplete");

  const f: HandFeatures = extractFeatures(raw);
  const { index, middle, ring, pinky } = f.fingers;

  // A pinch has to be checked before the finger-count branches: the index
  // finger is bent in an OK sign, so it would otherwise look like three fingers.
  const pinching = f.pinchRatio < 0.26 && index.pipAngle > 92;
  if (pinching) {
    const othersExtended = middle.extended && ring.extended && pinky.extended;
    const othersCurled = !middle.extended && !ring.extended && !pinky.extended;
    if (othersExtended) return MATCH("ok", "Thumb and index tips touch with three fingers up");
    if (othersCurled) return MATCH("pinch", "Thumb and index tips touch with other fingers curled");
    return REJECT(
      "ambiguous_pinch",
      "Thumb and index tips touch, but the other fingers are neither clearly up nor curled",
    );
  }

  // Five fingers up: spread or together separates open palm from flat hand.
  if (f.allExtended) {
    if (f.thumb.out) {
      if (f.indexPinkySpread >= 14)
        return MATCH("open_palm", "Five fingers up, spread wide with thumb out");
      if (f.indexPinkySpread < 9)
        return MATCH("flat_hand", "Five fingers up and together with thumb out");
      return REJECT(
        "ambiguous_open_flat",
        "Fingers are only partly spread — spread them for Open Palm or bring them together for Flat Hand",
      );
    }
    return MATCH("four", "Four fingers up with the thumb tucked in");
  }

  // Three fingers: index, middle and ring up.
  if (index.extended && middle.extended && ring.extended && !pinky.extended) {
    return MATCH("three", "Index, middle and ring up, pinky folded");
  }

  // Two fingers: spread makes a Victory sign; together makes a Two count.
  if (index.extended && middle.extended && !ring.extended && !pinky.extended) {
    // A clear fingertip gap is a more reliable "V" cue than joint angles alone:
    // real Victory photos often hold the two fingers almost parallel but apart.
    if (f.indexMiddleSpread >= 12 || f.indexMiddleTipGap >= 0.5) {
      return MATCH("victory", "Index and middle up and spread");
    }
    if (f.indexMiddleSpread < 8 && f.indexMiddleTipGap < 0.42) {
      return MATCH("two", "Index and middle up and held together");
    }
    return REJECT(
      "ambiguous_two_victory",
      "Index and middle are only partly spread — spread them for Victory or keep them together for Two",
    );
  }

  // Horn shapes: thumb out separates "I love you" from rock-on.
  if (index.extended && pinky.extended && !middle.extended && !ring.extended) {
    return f.thumb.out
      ? MATCH("i_love_you", "Thumb, index and pinky out, middle and ring folded")
      : MATCH("rock_on", "Index and pinky out, thumb and other fingers folded");
  }

  // Pinky plus thumb is the call-me shape.
  if (pinky.extended && !index.extended && !middle.extended && !ring.extended && f.thumb.out) {
    return MATCH("call_me", "Thumb and pinky out, three middle fingers folded");
  }

  // One finger: direction decides which pointing class is emitted.
  if (index.extended && !middle.extended && !ring.extended && !pinky.extended) {
    const dx = raw[8]!.x - raw[5]!.x;
    const dy = raw[8]!.y - raw[5]!.y;
    const length = Math.hypot(dx, dy) || 1e-6;
    const normalizedY = dy / length;
    if (normalizedY <= -0.55) return MATCH("point_up", "Only the index finger is up");
    if (normalizedY >= 0.55) return MATCH("point_down", "Only the index finger points down");
    return MATCH("point_side", "Only the index finger points sideways");
  }

  // A closed hand: the thumb direction separates fists from thumb gestures.
  if (!index.extended && !middle.extended && !ring.extended && !pinky.extended) {
    if (!f.thumb.out) return MATCH("fist", "All four fingers folded with the thumb tucked");
    const { x, y } = f.thumb.direction;
    if (y <= -0.55) return MATCH("thumbs_up", "Fist with the thumb pointing up");
    if (y >= 0.55) return MATCH("thumbs_down", "Fist with the thumb pointing down");
    if (Math.abs(x) >= 0.65) return MATCH("thumb_side", "Fist with the thumb pointing sideways");
    return REJECT("ambiguous_thumb_direction", "Thumb is out but not clearly up, down or sideways");
  }

  return REJECT(
    "pose_not_in_vocabulary",
    "Pose is not one of the supported static gestures — hold one clear gesture",
  );
}
