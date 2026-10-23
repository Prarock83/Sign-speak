import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bug,
  Camera,
  CameraOff,
  Hand,
  Loader2,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  classifyHand,
  DEFAULT_RECOGNITION_SETTINGS,
  GESTURE_DEFINITIONS,
  GESTURE_IDS,
  GestureStabilizer,
  RECOGNITION_LIMITS,
  type FrameDetection,
  type GestureId,
  type Point,
  type RecognitionSettings,
} from "@/lib/gestures";

type Status = "off" | "init" | "hand" | "nohand";

const STATUS: Record<Status, { label: string; icon: typeof Camera; cls: string }> = {
  off: { label: "Camera Off", icon: CameraOff, cls: "bg-muted text-muted-foreground" },
  init: { label: "Initializing", icon: Loader2, cls: "bg-accent text-accent-foreground" },
  hand: { label: "Detecting Hand", icon: Hand, cls: "bg-success/15 text-success" },
  nohand: { label: "No Hand Detected", icon: ScanLine, cls: "bg-warning/15 text-warning" },
};

const CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const MEDIAPIPE_VERSION = "1.1.1";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
// MediaPipe's detector is the expensive part of the loop. Capping it near 25 Hz
// keeps the UI responsive on projectors and low-powered laptops.
const DETECT_INTERVAL_MS = 40;
const TELEMETRY_INTERVAL_MS = 140;

interface CameraPanelProps {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  /** Called only for accepted, de-duplicated gestures. */
  onAccepted: (id: GestureId) => void;
  /** Throttled live telemetry for the current-gesture panel and history. */
  onDetection: (frame: FrameDetection) => void;
  onLive: () => void;
  onFailure: () => void;
}

export function CameraPanel({
  active,
  onActiveChange,
  onAccepted,
  onDetection,
  onLive,
  onFailure,
}: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const detectorPromiseRef = useRef<Promise<HandLandmarker> | null>(null);
  const delegateRef = useRef<"GPU" | "CPU" | "unknown">("unknown");
  const stabilizerRef = useRef(new GestureStabilizer());
  const overlayRef = useRef(true);
  const settingsRef = useRef<RecognitionSettings>({ ...DEFAULT_RECOGNITION_SETTINGS });

  const startingRef = useRef(false);
  const activeRef = useRef(active);
  const sessionRef = useRef(0);
  const runningRef = useRef(false);
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const colorsRef = useRef({ teal: "#2dd4bf", primary: "#8b5cf6" });

  const lastDetectAtRef = useRef(0);
  const fpsStartRef = useRef(0);
  const fpsFramesRef = useRef(0);
  const fpsRef = useRef(0);
  const lastPublishAtRef = useRef(0);
  const publishedGestureRef = useRef<GestureId | null>(null);
  const publishedHandsRef = useRef(-1);

  const acceptedRef = useRef(onAccepted);
  acceptedRef.current = onAccepted;
  const detectionCbRef = useRef(onDetection);
  detectionCbRef.current = onDetection;
  const eventsRef = useRef({ onActiveChange, onLive, onFailure });
  eventsRef.current = { onActiveChange, onLive, onFailure };

  const [status, setStatus] = useState<Status>("off");
  const [overlay, setOverlay] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [settings, setSettings] = useState<RecognitionSettings>({
    ...DEFAULT_RECOGNITION_SETTINGS,
  });
  const [telemetry, setTelemetry] = useState<FrameDetection | null>(null);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  overlayRef.current = overlay;
  settingsRef.current = settings;
  activeRef.current = active;

  const setStatusSafe = useCallback((next: Status) => {
    setStatus((current) => (current === next ? current : next));
  }, []);

  const refreshColors = useCallback(() => {
    if (typeof window === "undefined") return;
    const css = getComputedStyle(document.documentElement);
    const teal = css.getPropertyValue("--teal").trim();
    const primary = css.getPropertyValue("--primary").trim();
    colorsRef.current = { teal: teal || "#2dd4bf", primary: primary || "#8b5cf6" };
  }, []);

  useEffect(() => {
    refreshColors();
    stabilizerRef.current.configure(settings);
  }, [settings, refreshColors]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;

    sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    stabilizerRef.current.reset();
    setTelemetry(null);
    setStatusSafe("off");
    startingRef.current = false;
  }, [setStatusSafe]);

  const detect = useCallback(() => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(detect);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) return;

    const now = performance.now();
    if (now - lastDetectAtRef.current < DETECT_INTERVAL_MS) return;
    lastDetectAtRef.current = now;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
    }

    let handCount = 0;
    let hand: Point[] | undefined;
    let classification = classifyHand(null);

    try {
      const result = landmarker.detectForVideo(video, now);
      handCount = result.landmarks?.length ?? 0;
      hand = result.landmarks?.[0] as Point[] | undefined;
      classification = classifyHand(hand);
    } catch (err) {
      console.error("Hand detection failed", err);
      // One bad frame should not kill the loop; MediaPipe recovers on the next.
    }

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (hand && overlayRef.current) {
        const { teal, primary } = colorsRef.current;
        ctx.lineWidth = Math.max(3, canvas.width / 360);
        ctx.strokeStyle = teal;
        for (const [a, b] of CONNECTIONS) {
          const from = hand[a];
          const to = hand[b];
          if (!from || !to) continue;
          ctx.beginPath();
          ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
          ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
          ctx.stroke();
        }
        ctx.fillStyle = primary;
        for (const point of hand) {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const stabilizer = stabilizerRef.current;
    stabilizer.configure(settingsRef.current);
    const stable = stabilizer.push(classification.gesture, now);

    fpsFramesRef.current += 1;
    if (now - fpsStartRef.current >= 500) {
      fpsRef.current = Math.round((fpsFramesRef.current * 1000) / (now - fpsStartRef.current));
      fpsFramesRef.current = 0;
      fpsStartRef.current = now;
    }

    setStatusSafe(hand ? "hand" : "nohand");

    const accepted = stable.emit;
    if (accepted) acceptedRef.current(accepted);

    const frame: FrameDetection = {
      handCount,
      gesture: classification.gesture,
      reason: classification.reason,
      stability: stable.consistency,
      stableFrames: stable.stableFrames,
      needFrames: stable.needFrames,
      accepted,
      rejection: accepted ? null : (stable.rejection ?? classification.reason),
      delegate: delegateRef.current,
      fps: fpsRef.current,
    };

    const gestureChanged = publishedGestureRef.current !== classification.gesture;
    const handsChanged = publishedHandsRef.current !== handCount;
    if (
      accepted ||
      gestureChanged ||
      handsChanged ||
      now - lastPublishAtRef.current >= TELEMETRY_INTERVAL_MS
    ) {
      lastPublishAtRef.current = now;
      publishedGestureRef.current = classification.gesture;
      publishedHandsRef.current = handCount;
      detectionCbRef.current(frame);
      setTelemetry(frame);
    }
  }, [setStatusSafe]);

  const ensureLandmarker = useCallback(async (): Promise<HandLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    if (!detectorPromiseRef.current) {
      detectorPromiseRef.current = (async () => {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
        );
        const options = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO" as const,
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        try {
          const gpu = await HandLandmarker.createFromOptions(fileset, options("GPU"));
          delegateRef.current = "GPU";
          return gpu;
        } catch {
          const cpu = await HandLandmarker.createFromOptions(fileset, options("CPU"));
          delegateRef.current = "CPU";
          return cpu;
        }
      })();
    }
    try {
      const landmarker = await detectorPromiseRef.current;
      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (err) {
      detectorPromiseRef.current = null;
      throw err;
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || streamRef.current || !activeRef.current) return;
    startingRef.current = true;
    const session = ++sessionRef.current;
    const isCurrent = () =>
      mountedRef.current && sessionRef.current === session && activeRef.current;

    setError(null);
    setStatusSafe("init");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        title: "Camera not available",
        body: "This browser can't access a camera. Try Chrome or Edge over HTTPS, or use the Sample Demo below.",
      });
      setStatusSafe("off");
      eventsRef.current.onActiveChange(false);
      if (sessionRef.current === session) startingRef.current = false;
      return;
    }

    let stage: "model" | "camera" = "model";
    try {
      await ensureLandmarker();
      if (!isCurrent()) return;

      stage = "camera";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });

      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        video.srcObject = null;
        return;
      }

      const [track] = stream.getVideoTracks();
      if (track) {
        const handleEnded = () => {
          // A stop we initiated also fires "ended"; ignore that as a disconnect.
          if (!activeRef.current || !runningRef.current || !streamRef.current) return;
          activeRef.current = false;
          setError({
            title: "Camera disconnected",
            body: "The webcam stopped sending video. Reconnect it and press Start Camera again.",
          });
          stop();
          eventsRef.current.onActiveChange(false);
        };
        track.addEventListener("ended", handleEnded);
        sessionCleanupRef.current = () => track.removeEventListener("ended", handleEnded);
      }

      lastDetectAtRef.current = 0;
      fpsStartRef.current = performance.now();
      fpsFramesRef.current = 0;
      fpsRef.current = 0;
      publishedGestureRef.current = null;
      publishedHandsRef.current = -1;
      lastPublishAtRef.current = 0;
      refreshColors();
      eventsRef.current.onLive();
      setStatusSafe("nohand");
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      if (!mountedRef.current || sessionRef.current !== session) return;
      console.error(err);
      if (stage === "model") {
        setError({
          title: "Hand-tracking model couldn't load",
          body: "Check your internet connection and try again. Meanwhile, the Sample Demo below works offline.",
        });
        eventsRef.current.onFailure();
      } else {
        const name = (err as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? {
                title: "Camera permission denied",
                body: "Click the camera icon in your browser's address bar, allow access, then press Start again.",
              }
            : name === "NotFoundError"
              ? {
                  title: "No camera found",
                  body: "Connect a webcam and try again, or use the Sample Demo below.",
                }
              : {
                  title: "Couldn't start the camera",
                  body: "Another app may be using it. Close it and try again, or use the Sample Demo below.",
                },
        );
      }
      stop();
      eventsRef.current.onActiveChange(false);
    } finally {
      if (sessionRef.current === session) startingRef.current = false;
    }
  }, [detect, ensureLandmarker, refreshColors, setStatusSafe, stop]);

  useEffect(() => {
    if (active) void start();
    else stop();
  }, [active, start, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
      const detector = landmarkerRef.current;
      landmarkerRef.current = null;
      detector?.close();
      const pending = detectorPromiseRef.current;
      detectorPromiseRef.current = null;
      pending?.then((landmarker) => landmarker.close()).catch(() => {});
    };
  }, [stop]);

  const S = STATUS[status];
  const live = status === "hand" || status === "nohand";
  const predicted = telemetry?.gesture ? GESTURE_DEFINITIONS[telemetry.gesture].name : "None";
  const acceptedNow = telemetry?.accepted ? GESTURE_DEFINITIONS[telemetry.accepted].name : "No";

  return (
    <div className="flex h-full flex-col rounded-3xl border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Camera className="size-5 text-primary" aria-hidden /> Live Camera
        </h3>
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${S.cls}`}
        >
          <S.icon className={`size-4 ${status === "init" ? "animate-spin" : ""}`} aria-hidden />{" "}
          {S.label}
        </span>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-2xl bg-navy">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${live ? "" : "invisible"}`}
          aria-label="Your live webcam feed"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover"
          aria-hidden
        />
        {live && (
          <>
            <div className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-dashed border-primary-foreground/40">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy/80 px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Keep one hand inside the frame
              </span>
            </div>
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              <span
                className="size-2 animate-pulse rounded-full bg-primary-foreground"
                aria-hidden
              />{" "}
              Live
            </span>
          </>
        )}
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-primary-foreground">
            {error ? (
              <>
                <AlertTriangle className="size-10 text-warning" aria-hidden />
                <div role="alert">
                  <p className="text-lg font-semibold">{error.title}</p>
                  <p className="mt-1 max-w-sm text-sm opacity-80">{error.body}</p>
                </div>
                <Button
                  variant="hero"
                  onClick={() => {
                    onActiveChange(false);
                    setTimeout(() => onActiveChange(true), 0);
                  }}
                >
                  Try again
                </Button>
              </>
            ) : status === "init" ? (
              <>
                <Loader2 className="size-10 animate-spin" aria-hidden />
                <p className="font-medium">Loading hand tracking & camera…</p>
              </>
            ) : (
              <>
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-brand">
                  <Hand className="size-8" aria-hidden />
                </div>
                <p className="max-w-xs text-sm opacity-80">
                  Your video never leaves this device. Allow camera access when prompted.
                </p>
                <Button variant="hero" size="lg" onClick={() => onActiveChange(true)}>
                  <Camera /> Start Camera
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch id="overlay" checked={overlay} onCheckedChange={setOverlay} />
            <Label htmlFor="overlay">Show landmarks</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="debug" checked={showDebug} onCheckedChange={setShowDebug} />
            <Label htmlFor="debug" className="flex items-center gap-1.5">
              <Bug className="size-3.5" aria-hidden /> Debug
            </Label>
          </div>
        </div>
        {active ? (
          <Button variant="outline" onClick={() => onActiveChange(false)}>
            <CameraOff /> Stop Camera
          </Button>
        ) : (
          <Button variant="soft" onClick={() => onActiveChange(true)}>
            <Camera /> Start Camera
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {GESTURE_IDS.length} static gestures supported · one hand, palm or back to the camera · open
        the Gesture Library to learn each pose.
      </p>

      {showDebug && (
        <section aria-label="Recognition debug" className="mt-4 rounded-2xl border bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Bug className="size-4 text-primary" aria-hidden /> Recognition debug
            </h4>
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {status === "off" ? "idle" : `${telemetry?.fps ?? 0} fps`}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Hands detected
              </dt>
              <dd className="font-semibold">{telemetry ? `${telemetry.handCount} / 1` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Predicted class
              </dt>
              <dd className="font-semibold">{status === "off" ? "—" : predicted}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Stability</dt>
              <dd className="font-semibold">
                {telemetry && telemetry.gesture
                  ? `${Math.round(telemetry.stability * 100)}% (${telemetry.stableFrames}/${telemetry.needFrames})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Accepted</dt>
              <dd className={`font-semibold ${telemetry?.accepted ? "text-success" : ""}`}>
                {status === "off" ? "—" : acceptedNow}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Why not accepted
              </dt>
              <dd className="text-muted-foreground">
                {telemetry?.rejection ?? (telemetry?.accepted ? "Accepted this frame" : "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Model backend
              </dt>
              <dd className="font-semibold">{telemetry?.delegate ?? delegateRef.current}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Mode</dt>
              <dd className="font-semibold">Static · single hand</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-3 border-t pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="size-3.5" aria-hidden /> Recognition settings
            </p>
            <label className="block text-xs font-medium">
              <span className="flex justify-between">
                <span>Stability frames</span>
                <span className="text-muted-foreground">{settings.stabilityFrames}</span>
              </span>
              <Slider
                className="mt-1.5"
                min={RECOGNITION_LIMITS.stabilityFrames.min}
                max={RECOGNITION_LIMITS.stabilityFrames.max}
                step={RECOGNITION_LIMITS.stabilityFrames.step}
                value={[settings.stabilityFrames]}
                onValueChange={([value]) =>
                  setSettings((current) => ({
                    ...current,
                    stabilityFrames: value ?? current.stabilityFrames,
                  }))
                }
                aria-label="Stability frames required"
              />
            </label>
            <label className="block text-xs font-medium">
              <span className="flex justify-between">
                <span>Cooldown between words</span>
                <span className="text-muted-foreground">
                  {(settings.cooldownMs / 1000).toFixed(1)}s
                </span>
              </span>
              <Slider
                className="mt-1.5"
                min={RECOGNITION_LIMITS.cooldownMs.min}
                max={RECOGNITION_LIMITS.cooldownMs.max}
                step={RECOGNITION_LIMITS.cooldownMs.step}
                value={[settings.cooldownMs]}
                onValueChange={([value]) =>
                  setSettings((current) => ({
                    ...current,
                    cooldownMs: value ?? current.cooldownMs,
                  }))
                }
                aria-label="Cooldown between words in milliseconds"
              />
            </label>
            <label className="block text-xs font-medium">
              <span className="flex justify-between">
                <span>Hold to repeat</span>
                <span className="text-muted-foreground">
                  {(settings.repeatHoldMs / 1000).toFixed(1)}s
                </span>
              </span>
              <Slider
                className="mt-1.5"
                min={RECOGNITION_LIMITS.repeatHoldMs.min}
                max={RECOGNITION_LIMITS.repeatHoldMs.max}
                step={RECOGNITION_LIMITS.repeatHoldMs.step}
                value={[settings.repeatHoldMs]}
                onValueChange={([value]) =>
                  setSettings((current) => ({
                    ...current,
                    repeatHoldMs: value ?? current.repeatHoldMs,
                  }))
                }
                aria-label="Hold duration to repeat the same word"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Debug is off by default for presentations. Raise stability if a pose adds words too
              easily; lower it if you must hold very still.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
