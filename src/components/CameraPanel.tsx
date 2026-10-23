import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Hand, Loader2, AlertTriangle, ScanLine } from "lucide-react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { classify, GestureStabilizer, GESTURES, type GestureId } from "@/lib/gestures";

type Status = "off" | "init" | "hand" | "nohand";
const STATUS: Record<Status, { label: string; icon: typeof Camera; cls: string }> = {
  off: { label: "Camera Off", icon: CameraOff, cls: "bg-muted text-muted-foreground" },
  init: { label: "Initializing", icon: Loader2, cls: "bg-accent text-accent-foreground" },
  hand: { label: "Detecting Hand", icon: Hand, cls: "bg-success/15 text-success" },
  nohand: { label: "No Hand Detected", icon: ScanLine, cls: "bg-warning/15 text-warning" },
};

const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const VERSION = "1.1.1";

export function CameraPanel({
  active, onActiveChange, onGesture, onLive, onFailure,
}: {
  active: boolean;
  onActiveChange: (a: boolean) => void;
  onGesture: (id: GestureId | null, consistency: number, emitted: boolean) => void;
  onLive: () => void;
  onFailure: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const stabilizer = useRef(new GestureStabilizer());
  const overlayRef = useRef(true);
  const cbRef = useRef(onGesture);
  cbRef.current = onGesture;

  const [status, setStatus] = useState<Status>("off");
  const [overlay, setOverlay] = useState(true);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  overlayRef.current = overlay;

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    stabilizer.current.reset();
    setStatus("off");
  }, []);

  const loop = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current, lmk = landmarkerRef.current;
    if (!v || !c || !lmk || !streamRef.current) return;
    if (v.readyState >= 2) {
      if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
      const res = lmk.detectForVideo(v, performance.now());
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      const hand = res.landmarks?.[0];
      if (hand) {
        setStatus("hand");
        if (overlayRef.current) {
          const css = getComputedStyle(document.documentElement);
          ctx.lineWidth = 4; ctx.strokeStyle = css.getPropertyValue("--teal");
          for (const [a, b] of CONNECTIONS) {
            ctx.beginPath(); ctx.moveTo(hand[a].x * c.width, hand[a].y * c.height);
            ctx.lineTo(hand[b].x * c.width, hand[b].y * c.height); ctx.stroke();
          }
          ctx.fillStyle = css.getPropertyValue("--primary");
          for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, 6, 0, Math.PI * 2); ctx.fill(); }
        }
        const g = classify(hand);
        const { emit, consistency } = stabilizer.current.push(g, performance.now());
        cbRef.current(emit ?? g, consistency, !!emit);
      } else {
        setStatus("nohand");
        stabilizer.current.push(null, performance.now());
        cbRef.current(null, 0, false);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("init");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ title: "Camera not available", body: "This browser can't access a camera. Try Chrome or Edge over HTTPS, or use the Sample Demo below." });
      setStatus("off"); onActiveChange(false); return;
    }
    try {
      if (!landmarkerRef.current) {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fs = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
        const opts = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate },
          runningMode: "VIDEO" as const, numHands: 1,
        });
        landmarkerRef.current = await HandLandmarker.createFromOptions(fs, opts("GPU")).catch(() => HandLandmarker.createFromOptions(fs, opts("CPU")));
      }
    } catch (e) {
      console.error(e);
      setError({ title: "Hand-tracking model couldn't load", body: "Check your internet connection and try again. Meanwhile, the Sample Demo below works offline." });
      setStatus("off"); onActiveChange(false); onFailure(); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      onLive();
      setStatus("nohand");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(name === "NotAllowedError"
        ? { title: "Camera permission denied", body: "Click the camera icon in your browser's address bar, allow access, then press Start again." }
        : name === "NotFoundError"
          ? { title: "No camera found", body: "Connect a webcam and try again, or use the Sample Demo below." }
          : { title: "Couldn't start the camera", body: "Another app may be using it. Close it and try again." });
      stop(); onActiveChange(false);
    }
  }, [loop, onActiveChange, onFailure, onLive, stop]);

  useEffect(() => { if (active) void start(); else stop(); }, [active, start, stop]);
  useEffect(() => () => { stop(); landmarkerRef.current?.close(); }, [stop]);

  const S = STATUS[status];
  const live = status === "hand" || status === "nohand";

  return (
    <div className="flex h-full flex-col rounded-3xl border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Camera className="size-5 text-primary" aria-hidden /> Live Camera</h3>
        <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${S.cls}`}>
          <S.icon className={`size-4 ${status === "init" ? "animate-spin" : ""}`} aria-hidden /> {S.label}
        </span>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-2xl bg-navy">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${live ? "" : "invisible"}`} aria-label="Your live webcam feed" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" aria-hidden />
        {live && (
          <div className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-dashed border-primary-foreground/40">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy/80 px-3 py-0.5 text-xs font-medium text-primary-foreground">Keep one hand inside the frame</span>
          </div>
        )}
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-primary-foreground">
            {error ? (
              <>
                <AlertTriangle className="size-10 text-warning" aria-hidden />
                <div role="alert"><p className="text-lg font-semibold">{error.title}</p><p className="mt-1 max-w-sm text-sm opacity-80">{error.body}</p></div>
                <Button variant="hero" onClick={() => { onActiveChange(false); setTimeout(() => onActiveChange(true), 0); }}>Try again</Button>
              </>
            ) : status === "init" ? (
              <><Loader2 className="size-10 animate-spin" aria-hidden /><p className="font-medium">Loading hand tracking & camera…</p></>
            ) : (
              <>
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-brand"><Hand className="size-8" aria-hidden /></div>
                <p className="max-w-xs text-sm opacity-80">Your video never leaves this device. Allow camera access when prompted.</p>
                <Button variant="hero" size="lg" onClick={() => onActiveChange(true)}><Camera /> Start Camera</Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="overlay" checked={overlay} onCheckedChange={setOverlay} />
          <Label htmlFor="overlay">Show hand landmarks</Label>
        </div>
        {active ? (
          <Button variant="outline" onClick={() => onActiveChange(false)}><CameraOff /> Stop Camera</Button>
        ) : (
          <Button variant="soft" onClick={() => onActiveChange(true)}><Camera /> Start Camera</Button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Supported: {Object.values(GESTURES).map((g) => `${g.emoji} ${g.name}`).join(" · ")}
      </p>
    </div>
  );
}
