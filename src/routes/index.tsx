import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accessibility,
  ArrowLeftRight,
  ArrowRight,
  Camera,
  Cpu,
  Database,
  Globe2,
  Hand,
  Info,
  Languages,
  MousePointerClick,
  Play,
  ShieldCheck,
  Sparkles,
  Speaker,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CameraPanel } from "@/components/CameraPanel";
import { GestureLibrary } from "@/components/GestureLibrary";
import { SentenceComposer } from "@/components/SentenceComposer";
import { useGestureDictionary } from "@/hooks/use-gesture-dictionary";
import { useSentence } from "@/hooks/use-sentence";
import { useSpeech } from "@/hooks/use-speech";
import {
  GESTURE_LIBRARY,
  SAMPLE_DEMO_SEQUENCE,
  type FrameDetection,
  type GestureId,
} from "@/lib/gestures";
import { downloadTranscript } from "@/lib/sentence";
import type { GestureHistoryEntry, InputMode } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SignSpeak — Real-Time Gesture to Speech" },
      {
        name: "description",
        content:
          "SignSpeak turns static hand gestures into editable words, sentences and speech in real time, right in your browser.",
      },
      { property: "og:title", content: "SignSpeak — Every Gesture Has a Voice" },
      {
        property: "og:description",
        content:
          "Accessibility prototype: live hand tracking, an 18-pose gesture vocabulary, sentence building and speech.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const speech = useSpeech();
  const { dictionary, setWord, resetDictionary, textFor, gestureMap } = useGestureDictionary();
  const sentence = useSentence();
  const {
    addGesture: addSentenceGesture,
    addWord: addSentenceWord,
    clear: clearSentence,
  } = sentence;
  const stopSpeech = speech.stop;

  const [camOn, setCamOn] = useState(false);
  const [mode, setMode] = useState<InputMode>("Idle");
  const [liveFrame, setLiveFrame] = useState<FrameDetection | null>(null);
  const [demoGesture, setDemoGesture] = useState<GestureId | null>(null);
  const [history, setHistory] = useState<GestureHistoryEntry[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [demoCount, setDemoCount] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);

  const nextHistoryId = useRef(1);
  const demoTimers = useRef<number[]>([]);
  const cancelDemoTimersRef = useRef<() => void>(() => {});
  const autoRef = useRef(autoSpeak);
  autoRef.current = autoSpeak;
  const speakRef = useRef(speech.speak);
  speakRef.current = speech.speak;

  const pushHistory = useCallback((gestureId: GestureId, text: string, source: "live" | "demo") => {
    const entry: GestureHistoryEntry = {
      id: nextHistoryId.current++,
      gestureId,
      text,
      source,
      at: Date.now(),
    };
    setHistory((current) => [entry, ...current].slice(0, 8));
  }, []);

  const addGestureWord = useCallback(
    (gestureId: GestureId, source: "live" | "demo") => {
      const text = textFor(gestureId);
      addSentenceGesture(gestureId, text, source);
      pushHistory(gestureId, text, source);
      if (source === "live") setLiveCount((count) => count + 1);
      else setDemoCount((count) => count + 1);
      if (autoRef.current) speakRef.current(text);
    },
    [addSentenceGesture, pushHistory, textFor],
  );

  const onAccepted = useCallback(
    (gestureId: GestureId) => {
      // A live sign takes over: stop any in-flight simulated sequence so the
      // two input sources are never silently mixed.
      cancelDemoTimersRef.current();
      setDemoGesture(null);
      setMode("Live Camera");
      addGestureWord(gestureId, "live");
    },
    [addGestureWord],
  );

  const onDetection = useCallback((frame: FrameDetection) => setLiveFrame(frame), []);

  const onLive = useCallback(() => {
    setMode("Live Camera");
    setModelFailed(false);
    setDemoGesture(null);
  }, []);

  const handleActiveChange = useCallback((next: boolean) => {
    setCamOn(next);
    if (next) {
      setModelFailed(false);
      setMode("Live Camera");
    } else {
      setLiveFrame(null);
      setMode((current) => (current === "Live Camera" ? "Idle" : current));
    }
  }, []);

  const simulate = useCallback(
    (gestureId: GestureId) => {
      setMode("Sample Demo");
      setDemoGesture(gestureId);
      addGestureWord(gestureId, "demo");
    },
    [addGestureWord],
  );
  const simulateRef = useRef(simulate);
  simulateRef.current = simulate;

  const cancelDemoTimers = useCallback(() => {
    demoTimers.current.forEach((timer) => window.clearTimeout(timer));
    demoTimers.current = [];
    setDemoRunning(false);
  }, []);
  cancelDemoTimersRef.current = cancelDemoTimers;

  const resetSession = useCallback(
    (nextMode: InputMode) => {
      cancelDemoTimers();
      clearSentence();
      setHistory([]);
      setLiveCount(0);
      setDemoCount(0);
      setDemoGesture(null);
      setLiveFrame(null);
      setMode(nextMode);
    },
    [cancelDemoTimers, clearSentence],
  );

  const resetDemo = useCallback(() => {
    resetSession(camOn ? "Live Camera" : "Idle");
    stopSpeech();
  }, [camOn, resetSession, stopSpeech]);

  const runSampleDemo = useCallback(() => {
    resetSession("Sample Demo");
    setDemoRunning(true);
    SAMPLE_DEMO_SEQUENCE.forEach((gestureId, index) => {
      const timer = window.setTimeout(
        () => {
          simulateRef.current(gestureId);
          if (index === SAMPLE_DEMO_SEQUENCE.length - 1) setDemoRunning(false);
        },
        450 + index * 800,
      );
      demoTimers.current.push(timer);
    });
  }, [resetSession]);

  useEffect(() => () => cancelDemoTimers(), [cancelDemoTimers]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sentence.sentence);
      toast.success("Sentence copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  };

  const save = () => {
    downloadTranscript(sentence.sentence, mode);
    toast.success("Transcript saved as a text file");
  };

  const repeatLast = () => {
    const last = sentence.words[sentence.words.length - 1];
    if (last) addSentenceWord(last.text, "manual");
  };

  const startLive = () => {
    setCamOn(true);
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
  };

  const currentGesture = demoGesture ?? liveFrame?.gesture ?? null;
  const mappedText = currentGesture ? textFor(currentGesture) : null;

  return (
    <div className="min-h-screen">
      <a
        href="#studio"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to translation studio
      </a>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3"
          aria-label="Main"
        >
          <a href="#" className="flex items-center gap-2.5 font-display text-xl font-bold">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
              <Hand className="size-5" aria-hidden />
            </span>
            <span>
              Sign<span className="text-gradient-brand">Speak</span>
            </span>
          </a>
          <div className="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
            <a href="#studio" className="hover:text-foreground">
              Studio
            </a>
            <a href="#demo" className="hover:text-foreground">
              Try Demo
            </a>
            <a href="#library" className="hover:text-foreground">
              Gesture Library
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#future" className="hover:text-foreground">
              Future
            </a>
          </div>
          <span
            className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground"
            role="img"
            aria-label="Accessibility-first product"
          >
            <Accessibility className="size-5" aria-hidden />
          </span>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gradient-hero">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-5 pb-10 pt-12 text-center lg:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-semibold text-accent-foreground shadow-card">
            <Sparkles className="size-4 text-primary" aria-hidden /> AI-Powered Accessibility
            Prototype
          </span>
          <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            Every Gesture Has a <span className="text-gradient-brand">Voice.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Recognize hand gestures, compose a sentence you can edit, and speak it aloud — in real
            time.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="hero" size="xl" onClick={startLive}>
              Start Live Translation <ArrowRight />
            </Button>
            <Button variant="outline" size="xl" className="rounded-full" asChild>
              <a href="#demo">Try Demo</a>
            </Button>
          </div>
          <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-success" aria-hidden /> Hand tracking runs in your
            browser. {GESTURE_LIBRARY.length} static poses · editable dictionary · sentence
            composer.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Session statistics" className="mx-auto max-w-7xl px-5">
        <dl className="grid grid-cols-2 divide-y divide-x rounded-2xl border bg-card shadow-card sm:grid-cols-4 sm:divide-y-0">
          {(
            [
              ["Recognized words · live", liveCount],
              ["Words in sentence", sentence.words.length],
              ["Simulated words", demoCount],
              ["Input mode", mode],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="px-3 py-3 text-center sm:px-5 sm:py-4">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                {label}
              </dt>
              <dd className="mt-1 font-display text-lg font-bold sm:text-2xl" aria-live="polite">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Studio */}
      <section id="studio" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Live Translation Studio</h2>
            <p className="mt-1 text-muted-foreground">
              Show one supported static gesture and watch it become an editable word.
            </p>
          </div>
          <p className="flex max-w-md items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Recognizes {GESTURE_LIBRARY.length} predefined static hand poses mapped to editable demo
            words. Not full sign language and not a replacement for a qualified interpreter.
          </p>
        </div>

        {modelFailed && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4"
          >
            <p className="text-sm font-medium">
              The hand-tracking model didn't load. You can still present with the Sample Demo.
            </p>
            <Button variant="soft" asChild>
              <a href="#demo">Open Sample Demo</a>
            </Button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <CameraPanel
              active={camOn}
              onActiveChange={handleActiveChange}
              onAccepted={onAccepted}
              onDetection={onDetection}
              onLive={onLive}
              onFailure={() => setModelFailed(true)}
            />
          </div>

          <SentenceComposer
            words={sentence.words}
            sentence={sentence.sentence}
            liveFrame={liveFrame}
            demoGesture={demoGesture}
            mappedText={mappedText}
            mode={mode}
            cameraOn={camOn}
            history={history}
            speech={speech}
            autoSpeak={autoSpeak}
            onAutoSpeakChange={setAutoSpeak}
            onEditWord={sentence.edit}
            onRemoveWord={sentence.remove}
            onUndo={sentence.undo}
            onClear={sentence.clear}
            onPunctuate={sentence.punctuate}
            onAddManual={(text) => sentence.addWord(text, "manual")}
            onReplaceSentence={(text) => sentence.replaceSentence(text, "manual")}
            onRepeatLast={repeatLast}
            onCopy={copy}
            onSave={save}
            onReset={resetDemo}
          />
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="scroll-mt-20 bg-muted/60 py-14">
        <div className="mx-auto max-w-7xl px-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold text-warning">
            <MousePointerClick className="size-4" aria-hidden /> Sample Demo — Simulated Input
          </span>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">Try Demo</h2>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                No camera? Click a gesture to see how SignSpeak responds. Simulated words are amber
                everywhere so they are never confused with live recognition.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="hero" onClick={runSampleDemo} disabled={demoRunning}>
                <Play /> {demoRunning ? "Building sentence…" : "Run Sample Demo"}
              </Button>
              <Button variant="outline" onClick={resetDemo}>
                Reset demo session
              </Button>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold">One-click sequence:</span>
            {SAMPLE_DEMO_SEQUENCE.map((id, index) => (
              <span key={`${id}-${index}`} className="rounded-full bg-card px-2 py-0.5 font-medium">
                {gestureMap[id].emoji} {gestureMap[id].name} → “{gestureMap[id].text}”
              </span>
            ))}
            <span className="rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
              replaces current sentence
            </span>
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {GESTURE_LIBRARY.map((gesture) => {
              const mapped = gestureMap[gesture.id];
              return (
                <button
                  key={gesture.id}
                  onClick={() => simulate(gesture.id)}
                  aria-label={`Simulate ${gesture.name}, outputs ${mapped.text}`}
                  className="group flex flex-col items-center rounded-3xl border bg-card p-3 text-center shadow-card transition-all hover:-translate-y-1 hover:shadow-glow"
                >
                  <span
                    className="grid size-14 place-items-center rounded-2xl bg-accent text-4xl transition-transform group-hover:scale-110"
                    aria-hidden
                  >
                    {gesture.emoji}
                  </span>
                  <span className="mt-2 font-display text-sm font-semibold">{gesture.name}</span>
                  <span className="text-[11px] text-muted-foreground">{gesture.hint}</span>
                  <span className="mt-2 max-w-full truncate rounded-full bg-gradient-brand px-3 py-1 text-xs font-bold text-primary-foreground">
                    “{mapped.text}”
                  </span>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
                    Simulated
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <GestureLibrary
        dictionary={dictionary}
        onChangeWord={setWord}
        onResetDictionary={resetDictionary}
        liveFrame={liveFrame}
        cameraOn={camOn}
        onTest={simulate}
      />

      {/* How */}
      <section id="how" className="scroll-mt-20 bg-muted/40 py-14">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-3xl font-bold sm:text-4xl">How It Works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [Camera, "Capture", "Camera captures your hand."],
              [Cpu, "Track", "MediaPipe finds 21 hand landmarks."],
              [Hand, "Classify", "Scale-relative geometry identifies one static pose."],
              [Type, "Compose", "The mapped word becomes an editable sentence chip."],
              [Speaker, "Speak", "The finished sentence can be spoken aloud."],
            ].map(([Icon, title, body], index) => {
              const I = Icon as typeof Camera;
              return (
                <li key={index} className="rounded-3xl border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                      <I className="size-5" aria-hidden />
                    </span>
                    <span className="font-display text-3xl font-bold text-muted-foreground/40">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-4 font-display text-lg font-semibold">{title as string}</p>
                  <p className="text-sm text-muted-foreground">{body as string}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Future */}
      <section id="future" className="scroll-mt-20 bg-navy py-14 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-3xl font-bold sm:text-4xl">Future Scope</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                Database,
                "Validated datasets",
                "Train on verified sign-language datasets built with Deaf communities.",
              ],
              [
                Languages,
                "Sentence-level recognition",
                "Understand continuous signing and grammar, not single gestures.",
              ],
              [
                Globe2,
                "Regional sign languages",
                "Support Indian Sign Language (ISL) and other regional languages.",
              ],
              [
                ArrowLeftRight,
                "Two-way interface",
                "Speech-to-sign avatars for full two-way conversations.",
              ],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Camera;
              return (
                <div
                  key={title as string}
                  className="rounded-3xl border border-primary-foreground/15 bg-primary-foreground/5 p-5"
                >
                  <I className="size-6 text-teal" aria-hidden />
                  <p className="mt-3 font-display text-lg font-semibold">{title as string}</p>
                  <p className="text-sm opacity-75">{body as string}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-sm opacity-70">
            Static Gesture Mode is available today. Sign Language Mode is a research preview — see
            the Gesture Library tab for what genuine ISL recognition would require. No video is
            stored or uploaded.
          </p>
        </div>
      </section>
    </div>
  );
}
