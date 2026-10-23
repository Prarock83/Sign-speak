// Deterministic synthetic hands for classifier unit tests. These approximate
// MediaPipe's 21-landmark layout so every supported class can be exercised
// without a webcam. They are not a substitute for live recognition testing.

import type { FingerName, GestureId, HandLandmarks, Point } from "@/lib/gestures";

type ThumbMode = "folded" | "out" | "up" | "down" | "side" | "pinch";

export interface PoseOptions {
  /** true = extended, false = curled. Defaults to all extended. */
  fingers?: Partial<Record<FingerName, boolean>>;
  spread?: "wide" | "together";
  thumb?: ThumbMode;
  /** Screen angle of the index finger: -90 = up, 90 = down, 0 = right. */
  indexAngle?: number;
}

const point = (x: number, y: number): Point => ({ x, y, z: 0 });

const MCP: Record<FingerName, Point> = {
  index: point(0.435, 0.64),
  middle: point(0.5, 0.62),
  ring: point(0.565, 0.64),
  pinky: point(0.62, 0.665),
};

const JOINT_INDEX: Record<FingerName, { mcp: number; pip: number; dip: number; tip: number }> = {
  index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  ring: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  pinky: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

const SPREAD: Record<"wide" | "together", Record<FingerName, number>> = {
  wide: { index: -26, middle: -8, ring: 8, pinky: 26 },
  together: { index: -1.5, middle: 0, ring: 1.5, pinky: 3 },
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const offset = (base: Point, angleDeg: number, length: number): Point =>
  point(base.x + Math.cos(rad(angleDeg)) * length, base.y + Math.sin(rad(angleDeg)) * length);

function buildFinger(points: Point[], name: FingerName, extended: boolean, angleDeg: number) {
  const joints = JOINT_INDEX[name];
  const mcp = MCP[name];
  points[joints.mcp] = mcp;
  if (extended) {
    const pip = offset(mcp, angleDeg, 0.085);
    const dip = offset(pip, angleDeg, 0.065);
    const tip = offset(dip, angleDeg, 0.045);
    points[joints.pip] = pip;
    points[joints.dip] = dip;
    points[joints.tip] = tip;
  } else {
    const pip = offset(mcp, angleDeg, 0.07);
    const dip = offset(pip, angleDeg + 150, 0.06);
    const tip = offset(dip, angleDeg + 210, 0.05);
    points[joints.pip] = pip;
    points[joints.dip] = dip;
    points[joints.tip] = tip;
  }
}

function buildThumb(points: Point[], mode: ThumbMode) {
  const positions: Record<Exclude<ThumbMode, "pinch">, [Point, Point, Point, Point]> = {
    folded: [point(0.44, 0.79), point(0.46, 0.75), point(0.5, 0.74), point(0.52, 0.77)],
    out: [point(0.44, 0.79), point(0.395, 0.755), point(0.335, 0.735), point(0.275, 0.715)],
    up: [point(0.44, 0.79), point(0.43, 0.735), point(0.42, 0.675), point(0.41, 0.615)],
    down: [point(0.44, 0.79), point(0.45, 0.845), point(0.46, 0.905), point(0.47, 0.965)],
    side: [point(0.44, 0.79), point(0.39, 0.79), point(0.34, 0.79), point(0.29, 0.79)],
  };
  if (mode === "pinch") {
    points[1] = point(0.44, 0.79);
    points[2] = point(0.4, 0.73);
    points[3] = point(0.36, 0.64);
    points[4] = point(0.32, 0.555);
    return;
  }
  const [cmc, mcp, ip, tip] = positions[mode];
  points[1] = cmc;
  points[2] = mcp;
  points[3] = ip;
  points[4] = tip;
}

export function makeHand(options: PoseOptions = {}): HandLandmarks {
  const fingers = {
    index: options.fingers?.index ?? true,
    middle: options.fingers?.middle ?? true,
    ring: options.fingers?.ring ?? true,
    pinky: options.fingers?.pinky ?? true,
  };
  const spread = options.spread ?? "together";
  const thumb = options.thumb ?? "folded";
  const points: Point[] = Array.from({ length: 21 }, () => point(0.5, 0.9));
  points[0] = point(0.5, 0.9);

  (Object.keys(fingers) as FingerName[]).forEach((name) => {
    const angle =
      name === "index" && options.indexAngle !== undefined
        ? options.indexAngle
        : -90 + SPREAD[spread][name];
    buildFinger(points, name, fingers[name], angle);
  });

  buildThumb(points, thumb);

  if (thumb === "pinch") {
    // A real OK/pinch curls the index to meet the thumb.
    points[5] = point(0.435, 0.64);
    points[6] = point(0.42, 0.57);
    points[7] = point(0.37, 0.535);
    points[8] = point(0.32, 0.555);
  }

  return points;
}

/** Representative pose for each class, used to assert the classifier mapping. */
export const CLASS_POSES: Record<GestureId, PoseOptions> = {
  open_palm: { spread: "wide", thumb: "out" },
  flat_hand: { spread: "together", thumb: "out" },
  four: { spread: "together", thumb: "folded" },
  three: { fingers: { pinky: false }, thumb: "folded" },
  victory: { fingers: { ring: false, pinky: false }, spread: "wide", thumb: "folded" },
  two: { fingers: { ring: false, pinky: false }, spread: "together", thumb: "folded" },
  point_up: {
    fingers: { middle: false, ring: false, pinky: false },
    indexAngle: -90,
    thumb: "folded",
  },
  point_down: {
    fingers: { middle: false, ring: false, pinky: false },
    indexAngle: 90,
    thumb: "folded",
  },
  point_side: {
    fingers: { middle: false, ring: false, pinky: false },
    indexAngle: 0,
    thumb: "folded",
  },
  fist: { fingers: { index: false, middle: false, ring: false, pinky: false }, thumb: "folded" },
  thumbs_up: { fingers: { index: false, middle: false, ring: false, pinky: false }, thumb: "up" },
  thumbs_down: {
    fingers: { index: false, middle: false, ring: false, pinky: false },
    thumb: "down",
  },
  thumb_side: {
    fingers: { index: false, middle: false, ring: false, pinky: false },
    thumb: "side",
  },
  ok: { fingers: { index: false, middle: true, ring: true, pinky: true }, thumb: "pinch" },
  pinch: { fingers: { index: false, middle: false, ring: false, pinky: false }, thumb: "pinch" },
  call_me: { fingers: { index: false, middle: false, ring: false, pinky: true }, thumb: "out" },
  rock_on: { fingers: { middle: false, ring: false }, thumb: "folded" },
  i_love_you: { fingers: { middle: false, ring: false }, thumb: "out" },
};
