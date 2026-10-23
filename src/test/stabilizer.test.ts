import { describe, expect, it } from "vitest";
import { GestureStabilizer } from "@/lib/gestures";

function frames(
  stabilizer: GestureStabilizer,
  gesture: Parameters<GestureStabilizer["push"]>[0],
  start: number,
  count: number,
  delta = 40,
) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(stabilizer.push(gesture, start + i * delta));
  return out;
}

describe("GestureStabilizer", () => {
  it("does not emit the same gesture on every frame", () => {
    const stabilizer = new GestureStabilizer(5, 1000, 3000);
    let emits = 0;
    for (let i = 0; i < 60; i += 1) {
      if (stabilizer.push("fist", i * 16).emit) emits += 1;
    }
    expect(emits).toBe(1);
  });

  it("emits only after the stability threshold", () => {
    const stabilizer = new GestureStabilizer(5, 0, 0);
    const out = [1, 2, 3, 4, 5].map((i) => stabilizer.push("victory", i * 2000).emit);
    expect(out.slice(0, 4).every((x) => x === null)).toBe(true);
    expect(out[4]).toBe("victory");
  });

  it("honors a reconfigured stability threshold", () => {
    const stabilizer = new GestureStabilizer(4, 0, 5000);
    stabilizer.configure({ stabilityFrames: 10 });
    const out = frames(stabilizer, "open_palm", 0, 10);
    expect(out.slice(0, 9).every((result) => result.emit === null)).toBe(true);
    expect(out[9]?.emit).toBe("open_palm");
  });

  it("blocks the same held gesture but explains why", () => {
    const stabilizer = new GestureStabilizer(3, 100, 5000);
    const out = frames(stabilizer, "thumbs_up", 0, 26);
    const emits = out.filter((result) => result.emit);
    expect(emits).toHaveLength(1);
    expect(out.at(-1)?.rejection).toContain("Already added");
  });

  it("allows a deliberate repeat after holding the pose", () => {
    const stabilizer = new GestureStabilizer(3, 100, 500);
    const out = frames(stabilizer, "thumbs_up", 0, 20);
    expect(out.filter((result) => result.emit)).toHaveLength(2);
  });

  it("re-arms after the hand is released", () => {
    const stabilizer = new GestureStabilizer(3, 100, 5000);
    expect(frames(stabilizer, "fist", 0, 3).at(-1)?.emit).toBe("fist");
    frames(stabilizer, null, 120, 6);
    const again = frames(stabilizer, "fist", 360, 3);
    expect(again.at(-1)?.emit).toBe("fist");
  });

  it("accepts a different gesture after the cooldown", () => {
    const stabilizer = new GestureStabilizer(3, 200, 5000);
    expect(frames(stabilizer, "fist", 0, 3).at(-1)?.emit).toBe("fist");
    const next = frames(stabilizer, "victory", 160, 6);
    expect(next.some((result) => result.emit === "victory")).toBe(true);
  });

  it("resets cleanly when the camera stops", () => {
    const stabilizer = new GestureStabilizer(3, 100, 5000);
    frames(stabilizer, "ok", 0, 3);
    stabilizer.reset();
    expect(frames(stabilizer, "ok", 300, 3).at(-1)?.emit).toBe("ok");
  });
});
