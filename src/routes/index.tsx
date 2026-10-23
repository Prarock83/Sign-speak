import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  Accessibility, ShieldCheck, Sparkles, ArrowRight, Volume2, Square, Copy, Trash2, Undo2, Plus,
  MessageSquareText, Camera, Cpu, Hand, Type, Speaker, Globe2, Database, Languages, ArrowLeftRight, Info, MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraPanel } from "@/components/CameraPanel";
import { GESTURES, type GestureId } from "@/lib/gestures";
import { useSpeech } from "@/hooks/use-speech";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SignSpeak — Real-Time Gesture to Speech" },
      { name: "description", content: "SignSpeak turns hand gestures into text and speech in real time, right in your browser." },
      { property: "og:title", content: "SignSpeak — Every Gesture Has a Voice" },
      { property: "og:description", content: "AI-powered accessibility prototype: live hand tracking, gesture-to-text and speech." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Entry = { id: number; text: string; source: "live" | "demo" | "manual" };
type Mode = "Live Camera" | "Sample Demo" | "Idle";

function Index() {
  const speech = useSpeech();
  const [camOn, setCamOn] = useState(false);
  const [mode, setMode] = useState<Mode>("Idle");
  const [current, setCurrent] = useState<{ id: GestureId | null; source: "live" | "demo" } | null>(null);
  const [consistency, setConsistency] = useState(0);
  const [transcript, setTranscript] = useState<Entry[]>([]);
  const [count, setCount] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [manual, setManual] = useState("");
  const [pulse, setPulse] = useState(0);
  const [modelFailed, setModelFailed] = useState(false);
  const nextId = useRef(1);
  const autoRef = useRef(autoSpeak); autoRef.current = autoSpeak;
  const speakRef = useRef(speech.speak); speakRef.current = speech.speak;

  const add = useCallback((text: string, source: Entry["source"]) => {
    setTranscript((t) => [...t, { id: nextId.current++, text, source }]);
    if (source !== "manual") { setCount((c) => c + 1); setPulse((p) => p + 1); }
    if (autoRef.current) speakRef.current(text);
  }, []);

  const lastLive = useRef<string>("");
  const onGesture = useCallback((id: GestureId | null, cons: number, emitted: boolean) => {
    const key = `${id}-${Math.round(cons * 10)}`;
    if (key !== lastLive.current) { lastLive.current = key; setCurrent({ id, source: "live" }); setConsistency(cons); }
    if (emitted && id) add(GESTURES[id].text, "live");
  }, [add]);

  const simulate = (id: GestureId) => {
    setMode("Sample Demo"); setCurrent({ id, source: "demo" }); setConsistency(0);
    add(GESTURES[id].text, "demo");
  };

  const fullText = transcript.map((e) => e.text).join(" ");
  const translated = transcript.at(-1)?.text ?? "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(fullText); toast.success("Transcript copied"); }
    catch { toast.error("Couldn't copy — your browser blocked clipboard access"); }
  };

  const startLive = () => { setCamOn(true); document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <div className="min-h-screen">
      <a href="#studio" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Skip to translation studio</a>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3" aria-label="Main">
          <a href="#" className="flex items-center gap-2.5 font-display text-xl font-bold">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground"><Hand className="size-5" aria-hidden /></span>
            Sign<span className="text-gradient-brand">Speak</span>
          </a>
          <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#studio" className="hover:text-foreground">Studio</a>
            <a href="#demo" className="hover:text-foreground">Try Demo</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#future" className="hover:text-foreground">Future</a>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground" role="img" aria-label="Accessibility-first product"><Accessibility className="size-5" aria-hidden /></span>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gradient-hero">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 pb-10 pt-12 text-center lg:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-semibold text-accent-foreground shadow-card">
            <Sparkles className="size-4 text-primary" aria-hidden /> AI-Powered Accessibility Prototype
          </span>
          <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            Every Gesture Has a <span className="text-gradient-brand">Voice.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">Turn hand gestures into text and speech, in real time.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="hero" size="xl" onClick={startLive}>Start Live Translation <ArrowRight /></Button>
            <Button variant="outline" size="xl" className="rounded-full" asChild><a href="#demo">Try Demo</a></Button>
          </div>
          <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-success" aria-hidden /> Hand tracking runs in your browser.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Session statistics" className="mx-auto max-w-7xl px-5">
        <dl className="grid grid-cols-3 divide-x rounded-2xl border bg-card shadow-card">
          {[["Gestures recognized", count], ["Transcript entries", transcript.length], ["Recognition mode", mode]].map(([k, v]) => (
            <div key={k} className="px-4 py-4 text-center sm:px-6">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground sm:text-sm">{k}</dt>
              <dd className="mt-1 font-display text-xl font-bold sm:text-3xl" aria-live="polite">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Studio */}
      <section id="studio" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Live Translation Studio</h2>
            <p className="mt-1 text-muted-foreground">Show a supported gesture to the camera and watch it become words.</p>
          </div>
          <p className="flex max-w-md items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Recognizes a limited set of predefined gestures. Not full sign language and not a replacement for a qualified interpreter.
          </p>
        </div>

        {modelFailed && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm font-medium">The hand-tracking model didn't load. You can still present with the Sample Demo.</p>
            <Button variant="soft" asChild><a href="#demo">Open Sample Demo</a></Button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <CameraPanel active={camOn} onActiveChange={setCamOn} onGesture={onGesture}
            onLive={() => { setMode("Live Camera"); setModelFailed(false); }} onFailure={() => setModelFailed(true)} />

          {/* Translation panel */}
          <div className="flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold"><MessageSquareText className="size-5 text-primary" aria-hidden /> Live Translation</h3>
              {current?.source === "demo" && <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">Simulated Input</span>}
            </div>

            <div key={pulse} className="animate-pop rounded-2xl bg-gradient-brand p-5 text-primary-foreground" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Current gesture</p>
              {current ? (
                current.id ? (
                  <p className="mt-1 flex items-center gap-3 font-display text-4xl font-bold sm:text-5xl"><span aria-hidden>{GESTURES[current.id].emoji}</span>{GESTURES[current.id].name}</p>
                ) : (
                  <p className="mt-1 font-display text-3xl font-bold opacity-90">{camOn ? "Unrecognized Gesture" : "—"}</p>
                )
              ) : (
                <p className="mt-1 font-display text-2xl font-semibold opacity-90">Waiting for a gesture…</p>
              )}
              {current?.source === "live" && current.id && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-medium opacity-90"><span>Frame consistency</span><span>{Math.round(consistency * 100)}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-primary-foreground/25" role="progressbar" aria-valuenow={Math.round(consistency * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Frame consistency">
                    <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${consistency * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-muted/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Translated text</p>
              <p className="mt-1 min-h-10 font-display text-3xl font-semibold">{translated || <span className="text-muted-foreground">Nothing yet</span>}</p>
            </div>

            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Transcript</p>
              <div className="flex max-h-36 min-h-16 flex-wrap content-start gap-2 overflow-y-auto rounded-2xl border p-3" aria-label="Transcript">
                {transcript.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Recognized gestures will appear here. Start the camera or try the demo.</p>
                ) : transcript.map((e) => (
                  <input key={e.id} aria-label={`Edit entry: ${e.text}`} value={e.text} size={Math.max(e.text.length, 2)}
                    onChange={(ev) => setTranscript((t) => t.map((x) => x.id === e.id ? { ...x, text: ev.target.value } : x))}
                    className={`rounded-lg px-2.5 py-1 text-base font-semibold ${e.source === "demo" ? "bg-warning/15" : e.source === "manual" ? "bg-secondary" : "bg-accent text-accent-foreground"}`} />
                ))}
              </div>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { add(manual.trim(), "manual"); setManual(""); } }}>
                <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type to add text manually…" aria-label="Add text manually" />
                <Button type="submit" variant="soft" aria-label="Add text"><Plus /> Add</Button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {speech.speaking ? (
                <Button onClick={speech.stop}><Square /> Stop</Button>
              ) : (
                <Button onClick={() => speech.speak(fullText || translated)} disabled={!speech.supported || !fullText}><Volume2 /> Speak Text</Button>
              )}
              <Button variant="outline" onClick={copy} disabled={!fullText}><Copy /> Copy Text</Button>
              <Button variant="outline" onClick={() => setTranscript((t) => t.slice(0, -1))} disabled={!transcript.length}><Undo2 /> Undo Last</Button>
              <Button variant="outline" onClick={() => { setTranscript([]); setCurrent(null); }} disabled={!transcript.length}><Trash2 /> Clear</Button>
            </div>

            <div className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-3 sm:items-center">
              {speech.supported ? (
                <>
                  <div className="flex items-center gap-2"><Switch id="auto" checked={autoSpeak} onCheckedChange={setAutoSpeak} /><Label htmlFor="auto">Auto-speak</Label></div>
                  <Select value={speech.voiceURI} onValueChange={speech.setVoiceURI}>
                    <SelectTrigger aria-label="Voice"><SelectValue placeholder="Voice" /></SelectTrigger>
                    <SelectContent>{speech.voices.map((v) => <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="rate" className="whitespace-nowrap text-xs">Rate {speech.rate.toFixed(1)}×</Label>
                    <Slider id="rate" min={0.5} max={2} step={0.1} value={[speech.rate]} onValueChange={([r]) => speech.setRate(r ?? 1)} aria-label="Speech rate" />
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground sm:col-span-3">Speech isn't supported in this browser. Try Chrome, Edge or Safari.</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="scroll-mt-20 bg-muted/60 py-14">
        <div className="mx-auto max-w-7xl px-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold text-warning"><MousePointerClick className="size-4" aria-hidden /> Sample Demo — Simulated Input</span>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Try Demo</h2>
          <p className="mt-1 text-muted-foreground">No camera? Click a gesture to see how SignSpeak responds. Results appear in the studio above.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(GESTURES) as GestureId[]).map((id) => {
              const g = GESTURES[id];
              return (
                <button key={id} onClick={() => simulate(id)} aria-label={`Simulate ${g.name}, outputs ${g.text}`}
                  className="group flex flex-col items-center rounded-3xl border bg-card p-5 text-center shadow-card transition-all hover:-translate-y-1 hover:shadow-glow">
                  <span className="grid size-20 place-items-center rounded-2xl bg-accent text-5xl transition-transform group-hover:scale-110" aria-hidden>{g.emoji}</span>
                  <span className="mt-4 font-display text-lg font-semibold">{g.name}</span>
                  <span className="text-sm text-muted-foreground">{g.hint}</span>
                  <span className="mt-3 rounded-full bg-gradient-brand px-4 py-1.5 text-sm font-bold text-primary-foreground">“{g.text}”</span>
                  <span className="mt-3 text-xs font-semibold text-primary">Simulate gesture →</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-14">
        <h2 className="text-3xl font-bold sm:text-4xl">How It Works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [Camera, "Capture", "Camera captures hand movement."],
            [Cpu, "Track", "MediaPipe detects 21 hand landmarks."],
            [Hand, "Classify", "Gesture classification analyzes landmark positions."],
            [Type, "Translate", "Recognized output appears as text."],
            [Speaker, "Speak", "Text can be spoken aloud."],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof Camera;
            return (
              <li key={i} className="rounded-3xl border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground"><I className="size-5" aria-hidden /></span><span className="font-display text-3xl font-bold text-muted-foreground/40">0{i + 1}</span></div>
                <p className="mt-4 font-display text-lg font-semibold">{t as string}</p>
                <p className="text-sm text-muted-foreground">{d as string}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Future */}
      <section id="future" className="scroll-mt-20 bg-navy py-14 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-3xl font-bold sm:text-4xl">Future Scope</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Database, "Validated datasets", "Train on verified sign-language datasets built with Deaf communities."],
              [Languages, "Sentence-level recognition", "Understand continuous signing and grammar, not single gestures."],
              [Globe2, "Regional sign languages", "Support Indian Sign Language (ISL) and other regional languages."],
              [ArrowLeftRight, "Two-way interface", "Speech-to-sign avatars for full two-way conversations."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Camera;
              return (
                <div key={t as string} className="rounded-3xl border border-primary-foreground/15 bg-primary-foreground/5 p-5">
                  <I className="size-6 text-teal" aria-hidden />
                  <p className="mt-3 font-display text-lg font-semibold">{t as string}</p>
                  <p className="text-sm opacity-75">{d as string}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-10 text-center text-sm opacity-60">SignSpeak · Ideas 4.0 prototype · No video is stored or uploaded.</p>
        </div>
      </section>
    </div>
  );
}
