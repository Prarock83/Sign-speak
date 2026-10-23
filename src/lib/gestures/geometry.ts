// Geometry helpers for MediaPipe's 21-point hand skeleton.
// All measurements are scale-relative, so they work at any distance from the camera.

import type { FingerName, HandLandmarks, Point } from "./types";

export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function normalize(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y) || 1e-6;
  return { x: v.x / length, y: v.y / length };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** Angle at `b` formed by points a-b-c, in degrees (0-180). */
export function angleAt(a: Vec2, b: Vec2, c: Vec2): number {
  const fromB = normalize(subtract(a, b));
  const toC = normalize(subtract(c, b));
  return (Math.acos(Math.max(-1, Math.min(1, dot(fromB, toC)))) * 180) / Math.PI;
}

/** Smallest angle between two direction vectors, in degrees (0-180). */
export function angleBetween(a: Vec2, b: Vec2): number {
  return (Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))) * 180) / Math.PI;
}

export interface FingerFeatures {
  name: FingerName;
  mcp: number;
  pip: number;
  dip: number;
  tip: number;
  /** Angle at the PIP joint: near 180 means straight, small means curled. */
  pipAngle: number;
  /** Angle at the DIP joint. */
  dipAngle: number;
  /** True when the finger is confidently straight (not a marginal pose). */
  extended: boolean;
  /** True when the finger is confidently folded into the palm. */
  curled: boolean;
  /** Unit vector from MCP knuckle toward the fingertip. */
  direction: Vec2;
}

export interface ThumbFeatures {
  /** Angle at the interphalangeal joint. */
  ipAngle: number;
  /** Angle at the metacarpophalangeal joint. */
  mcpAngle: number;
  extended: boolean;
  /** Unit vector from thumb MCP toward the thumb tip. */
  direction: Vec2;
  /** Distance from the palm centre, relative to palm length. */
  tipFromPalmCenter: number;
  /** True when the thumb is confidently held away from the fist/palm. */
  out: boolean;
}

export interface HandFeatures {
  palmLength: number;
  palmWidth: number;
  handScale: number;
  palmCenter: Vec2;
  fingers: Record<FingerName, FingerFeatures>;
  thumb: ThumbFeatures;
  /** Angle between index and middle finger directions (only meaningful if extended). */
  indexMiddleSpread: number;
  /** Angle between index and pinky directions (only meaningful if extended). */
  indexPinkySpread: number;
  /** Distance between index and middle fingertips relative to palm width. */
  indexMiddleTipGap: number;
  /** Ratio of thumb-tip-to-index-tip distance over palm length. */
  pinchRatio: number;
  extendedCount: number;
  allCurled: boolean;
  allExtended: boolean;
}

const FINGER_JOINTS: Record<FingerName, { mcp: number; pip: number; dip: number; tip: number }> = {
  index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  ring: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  pinky: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

export function isValidHand(raw: HandLandmarks | undefined | null): raw is HandLandmarks {
  if (!raw || raw.length < 21) return false;
  return raw.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function buildFinger(raw: HandLandmarks, name: FingerName): FingerFeatures {
  const joints = FINGER_JOINTS[name];
  const mcpPoint = raw[joints.mcp]!;
  const pipPoint = raw[joints.pip]!;
  const dipPoint = raw[joints.dip]!;
  const tipPoint = raw[joints.tip]!;

  const pipAngle = angleAt(mcpPoint, pipPoint, dipPoint);
  const dipAngle = angleAt(pipPoint, dipPoint, tipPoint);

  // Joint angles are used instead of tip-to-wrist distance so a straight
  // finger pointing downward is still correctly treated as extended.
  const extended = pipAngle > 145 && dipAngle > 130;
  const curled = pipAngle < 118;

  return {
    name,
    ...joints,
    pipAngle,
    dipAngle,
    extended,
    curled,
    direction: normalize(subtract(tipPoint, mcpPoint)),
  };
}

function buildThumb(raw: HandLandmarks, palmLength: number, palmCenter: Vec2): ThumbFeatures {
  const cmc = raw[1]!;
  const mcp = raw[2]!;
  const ip = raw[3]!;
  const tip = raw[4]!;
  const ipAngle = angleAt(mcp, ip, tip);
  const mcpAngle = angleAt(cmc, mcp, ip);
  const tipFromPalmCenter = distance(tip, palmCenter) / palmLength;
  // The thumb IP joint is noisier than finger joints in MediaPipe; keep the
  // threshold tolerant and rely on the distance from the palm to reject folds.
  const extended = ipAngle > 125 && mcpAngle > 110;
  // A folded thumb rests close to the palm; an extended thumb sits well outside it.
  const out = extended && tipFromPalmCenter > 0.55;
  return {
    ipAngle,
    mcpAngle,
    extended,
    direction: normalize(subtract(tip, mcp)),
    tipFromPalmCenter,
    out,
  };
}

export function extractFeatures(raw: HandLandmarks): HandFeatures {
  const wrist = raw[0]!;
  const middleMcp = raw[9]!;
  const palmLength = Math.max(distance(wrist, middleMcp), 1e-6);
  const palmWidth = Math.max(distance(raw[5]!, raw[17]!), 1e-6);
  const palmCenter = midpoint(wrist, middleMcp);

  const fingers: Record<FingerName, FingerFeatures> = {
    index: buildFinger(raw, "index"),
    middle: buildFinger(raw, "middle"),
    ring: buildFinger(raw, "ring"),
    pinky: buildFinger(raw, "pinky"),
  };
  const thumb = buildThumb(raw, palmLength, palmCenter);
  const fingerList = Object.values(fingers);

  return {
    palmLength,
    palmWidth,
    handScale: (palmLength + palmWidth) / 2,
    palmCenter,
    fingers,
    thumb,
    indexMiddleSpread: angleBetween(fingers.index.direction, fingers.middle.direction),
    indexPinkySpread: angleBetween(fingers.index.direction, fingers.pinky.direction),
    indexMiddleTipGap: distance(raw[8]!, raw[12]!) / palmWidth,
    pinchRatio: distance(raw[4]!, raw[8]!) / palmLength,
    extendedCount: fingerList.filter((f) => f.extended).length,
    allCurled: fingerList.every((f) => f.curled),
    allExtended: fingerList.every((f) => f.extended),
  };
}
