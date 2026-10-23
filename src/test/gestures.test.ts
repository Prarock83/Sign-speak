import { describe, it, expect } from "vitest";
import { GestureStabilizer } from "@/lib/gestures";

describe("GestureStabilizer", () => {
  it("does not emit the same gesture on every frame", () => {
    const s = new GestureStabilizer(5, 1000, 3000);
    let emits = 0;
    for (let i = 0; i < 60; i++) if (s.push("fist", i * 16).emit) emits++;
    expect(emits).toBe(1);
  });
  it("emits only after the stability threshold", () => {
    const s = new GestureStabilizer(5, 0, 0);
    const out = [1, 2, 3, 4, 5].map((i) => s.push("victory", i * 2000).emit);
    expect(out.slice(0, 4).every((x) => x === null)).toBe(true);
    expect(out[4]).toBe("victory");
  });
});
