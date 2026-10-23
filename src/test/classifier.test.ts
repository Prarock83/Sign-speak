import { describe, expect, it } from "vitest";
import { classifyHand, GESTURE_IDS, type GestureId } from "@/lib/gestures";
import { CLASS_POSES, makeHand } from "./gesture-fixtures";

describe("gesture classifier", () => {
  it.each(GESTURE_IDS)("recognizes %s from its representative pose", (id) => {
    const result = classifyHand(makeHand(CLASS_POSES[id]));
    expect(result.gesture).toBe(id);
    expect(result.reasonCode).toBe("matched");
  });

  it("returns no gesture when no hand is present", () => {
    const result = classifyHand(null);
    expect(result.gesture).toBeNull();
    expect(result.reasonCode).toBe("no_hand");
  });

  it("rejects incomplete landmark sets", () => {
    const result = classifyHand(makeHand().slice(0, 10));
    expect(result.gesture).toBeNull();
    expect(result.reasonCode).toBe("bad_landmarks");
  });

  it("rejects an unsupported pose with a useful reason", () => {
    // Index and ring out with the other fingers curled is not in the vocabulary.
    const result = classifyHand(
      makeHand({ fingers: { middle: false, pinky: false }, thumb: "folded" }),
    );
    expect(result.gesture).toBeNull();
    expect(result.reasonCode).toBe("pose_not_in_vocabulary");
    expect(result.reason).toBeTruthy();
  });

  it("separates Victory from Two using the finger gap", () => {
    const victory = classifyHand(makeHand(CLASS_POSES.victory));
    const two = classifyHand(makeHand(CLASS_POSES.two));
    expect(victory.gesture).toBe("victory");
    expect(two.gesture).toBe("two");
  });

  it("does not reuse one label for multiple distinct classes", () => {
    const poses = GESTURE_IDS.map((id) => classifyHand(makeHand(CLASS_POSES[id])).gesture);
    expect(new Set(poses).size).toBe(GESTURE_IDS.length);
    expect(poses.every((id): id is GestureId => id !== null)).toBe(true);
  });

  it("is invariant to a mirrored landmark set", () => {
    const mirrored = makeHand(CLASS_POSES.thumbs_up).map((p) => ({ ...p, x: 1 - p.x }));
    expect(classifyHand(mirrored).gesture).toBe("thumbs_up");
  });
});
