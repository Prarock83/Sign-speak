import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Copy,
  History,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GESTURE_DEFINITIONS, type FrameDetection, type GestureId } from "@/lib/gestures";
import type { SpeechController } from "@/hooks/use-speech";
import {
  PUNCTUATION,
  type PunctuationMark,
  type SentenceWord,
  type WordSource,
} from "@/lib/sentence";
import type { GestureHistoryEntry, InputMode } from "@/lib/session";

const MODE_STYLE: Record<InputMode, { label: string; className: string; dot: string }> = {
  "Live Camera": {
    label: "Live Camera",
    className: "bg-success/15 text-success",
    dot: "bg-success",
  },
  "Sample Demo": {
    label: "Simulated Demo",
    className: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  Idle: { label: "Idle", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const SOURCE_STYLE: Record<WordSource, string> = {
  live: "border-primary/30 bg-accent text-accent-foreground",
  demo: "border-warning/40 bg-warning/15 text-foreground",
  manual: "border-border bg-secondary text-secondary-foreground",
};

const SOURCE_LABEL: Record<WordSource, string> = {
  live: "Live camera",
  demo: "Simulated demo",
  manual: "Typed manually",
};

export interface SentenceComposerProps {
  words: SentenceWord[];
  sentence: string;
  liveFrame: FrameDetection | null;
  demoGesture: GestureId | null;
  /** Current editable dictionary entry for the displayed gesture. */
  mappedText: string | null;
  mode: InputMode;
  cameraOn: boolean;
  history: GestureHistoryEntry[];
  speech: SpeechController;
  autoSpeak: boolean;
  onAutoSpeakChange: (value: boolean) => void;
  onEditWord: (id: number, text: string) => void;
  onRemoveWord: (id: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onPunctuate: (mark: PunctuationMark) => void;
  onAddManual: (text: string) => void;
  onReplaceSentence: (text: string) => void;
  onRepeatLast: () => void;
  onCopy: () => void;
  onSave: () => void;
  onReset: () => void;
}

export function SentenceComposer({
  words,
  sentence,
  liveFrame,
  demoGesture,
  mappedText,
  mode,
  cameraOn,
  history,
  speech,
  autoSpeak,
  onAutoSpeakChange,
  onEditWord,
  onRemoveWord,
  onUndo,
  onClear,
  onPunctuate,
  onAddManual,
  onReplaceSentence,
  onRepeatLast,
  onCopy,
  onSave,
  onReset,
}: SentenceComposerProps) {
  const [manualWord, setManualWord] = useState("");
  const [manualSentence, setManualSentence] = useState("");

  const demoDefinition = demoGesture ? GESTURE_DEFINITIONS[demoGesture] : null;
  const liveDefinition =
    !demoDefinition && liveFrame?.gesture ? GESTURE_DEFINITIONS[liveFrame.gesture] : null;
  const definition = demoDefinition ?? liveDefinition;
  const isLiveGesture = Boolean(!demoDefinition && liveDefinition);
  const source: "live" | "demo" | null = demoDefinition ? "demo" : liveDefinition ? "live" : null;

  const stability = isLiveGesture ? (liveFrame?.stability ?? 0) : 0;
  const modeStyle = MODE_STYLE[mode];
  const hasMixedSources = new Set(words.map((word) => word.source)).size > 1;

  const emptyMessage = (() => {
    if (definition) return null;
    if (mode === "Sample Demo")
      return "Demo complete — add another simulated gesture or use the sample sequence.";
    if (cameraOn && liveFrame && liveFrame.handCount > 0) return "Unrecognized gesture";
    if (cameraOn && liveFrame && liveFrame.handCount === 0)
      return "No hand detected — show one hand in the frame";
    if (cameraOn) return "Starting hand tracking…";
    return "Waiting for a gesture…";
  })();

  const addManual = (event: FormEvent) => {
    event.preventDefault();
    const value = manualWord.trim();
    if (!value) return;
    onAddManual(value);
    setManualWord("");
  };

  const applyCorrection = (event: FormEvent) => {
    event.preventDefault();
    const value = manualSentence.trim();
    if (!value) return;
    onReplaceSentence(value);
    setManualSentence("");
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquareText className="size-5 text-primary" aria-hidden /> Sentence Composer
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${modeStyle.className}`}
            aria-live="polite"
          >
            <span className={`size-2 rounded-full ${modeStyle.dot}`} aria-hidden />{" "}
            {modeStyle.label}
          </span>
          <Button variant="ghost" size="sm" onClick={onReset} aria-label="Reset the demo session">
            <RotateCcw /> Reset
          </Button>
        </div>
      </div>

      {mode === "Sample Demo" && cameraOn && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          Camera is live, but the selected input is the simulated demo. Amber chips are simulated,
          not camera recognition.
        </p>
      )}

      <div
        key={words.length}
        className="animate-pop rounded-2xl bg-gradient-brand p-5 text-primary-foreground"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            Current gesture
          </p>
          {source && (
            <span className="rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
              {SOURCE_LABEL[source]}
            </span>
          )}
        </div>
        {definition ? (
          <>
            <p
              className="mt-1 flex items-center gap-3 font-display text-3xl font-bold sm:text-4xl"
              aria-live="polite"
            >
              <span aria-hidden>{definition.emoji}</span>
              {definition.name}
            </p>
            <p className="mt-1 text-sm font-medium opacity-90">
              → “{mappedText ?? definition.defaultText}”
            </p>
          </>
        ) : (
          <p className="mt-1 font-display text-2xl font-semibold opacity-90 sm:text-3xl">
            {emptyMessage ?? "Waiting for a gesture…"}
          </p>
        )}
        {isLiveGesture && liveFrame && (
          <div className="mt-3">
            <div className="flex justify-between text-xs font-medium opacity-90">
              <span>Recognition stability</span>
              <span>
                {Math.round(stability * 100)}% · {liveFrame.stableFrames}/{liveFrame.needFrames}{" "}
                frames
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-primary-foreground/25"
              role="progressbar"
              aria-valuenow={Math.round(stability * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Recognition stability"
            >
              <div
                className="h-full rounded-full bg-primary-foreground transition-all"
                style={{ width: `${stability * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-muted/50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Current sentence
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {words.length} {words.length === 1 ? "word" : "words"}
          </p>
        </div>
        <p
          className="mt-1 min-h-12 font-display text-2xl font-semibold leading-snug sm:text-3xl"
          aria-live="polite"
        >
          {sentence || (
            <span className="text-muted-foreground">
              No words yet — show a supported gesture or use “Add Word” below.
            </span>
          )}
        </p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Editable words
          </p>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-accent-foreground">Purple</span> live ·{" "}
            <span className="font-semibold text-warning">Amber</span> simulated ·{" "}
            <span className="font-semibold">Gray</span> typed
          </p>
        </div>
        <div
          className="flex max-h-40 min-h-16 flex-wrap content-start gap-2 overflow-y-auto rounded-2xl border p-3"
          aria-label="Sentence words"
        >
          {words.length === 0 ? (
            <p className="self-center text-sm text-muted-foreground">
              Recognized words appear here as editable chips.
            </p>
          ) : (
            words.map((word) => (
              <span
                key={word.id}
                className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 ${SOURCE_STYLE[word.source]}`}
                title={SOURCE_LABEL[word.source]}
              >
                <input
                  value={word.text}
                  onChange={(event) => onEditWord(word.id, event.target.value)}
                  aria-label={`Edit word ${word.text || "(blank)"}`}
                  style={{ width: `${Math.max(word.text.length || 1, 2)}ch` }}
                  className="min-w-0 bg-transparent text-base font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() => onRemoveWord(word.id)}
                  aria-label={`Remove ${word.text || "word"}`}
                  className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))
          )}
        </div>
        {hasMixedSources && words.length > 1 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            This sentence contains more than one input source; each chip is labelled by its origin.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onUndo} disabled={words.length === 0}>
          <Undo2 /> Undo Last Word
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} disabled={words.length === 0}>
          <Trash2 /> Clear Sentence
        </Button>
        <Button variant="outline" size="sm" onClick={onRepeatLast} disabled={words.length === 0}>
          <Plus /> Repeat Last
        </Button>
        <span
          className="ml-auto flex items-center gap-1"
          aria-label="Add punctuation to the last word"
        >
          {PUNCTUATION.map((mark) => (
            <Button
              key={mark}
              variant="soft"
              size="sm"
              className="w-8 px-0 text-base"
              onClick={() => onPunctuate(mark)}
              disabled={words.length === 0}
              aria-label={`Add ${mark === "." ? "period" : mark === "," ? "comma" : mark === "!" ? "exclamation mark" : "question mark"}`}
            >
              {mark}
            </Button>
          ))}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <form className="flex gap-2" onSubmit={addManual}>
          <Input
            value={manualWord}
            onChange={(event) => setManualWord(event.target.value)}
            placeholder="Add a word…"
            aria-label="Add a word manually"
          />
          <Button type="submit" variant="soft" disabled={!manualWord.trim()}>
            <Plus /> Add Word
          </Button>
        </form>
        <form className="flex gap-2" onSubmit={applyCorrection}>
          <Input
            value={manualSentence}
            onChange={(event) => setManualSentence(event.target.value)}
            placeholder="Rewrite sentence…"
            aria-label="Correct the full sentence"
          />
          <Button type="submit" variant="outline" disabled={!manualSentence.trim()}>
            Apply
          </Button>
        </form>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {speech.speaking ? (
          <Button onClick={speech.stop}>
            <Square /> Stop Speech
          </Button>
        ) : (
          <Button
            onClick={() => speech.speak(sentence)}
            disabled={!speech.supported || !sentence.trim()}
          >
            <Volume2 /> Speak Sentence
          </Button>
        )}
        <Button variant="outline" onClick={onCopy} disabled={!sentence.trim()}>
          <Copy /> Copy Sentence
        </Button>
        <Button variant="outline" onClick={onSave} disabled={!sentence.trim()}>
          <Save /> Save Transcript
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-3 sm:items-center">
        {speech.supported ? (
          <>
            <div className="flex items-center gap-2">
              <Switch id="auto" checked={autoSpeak} onCheckedChange={onAutoSpeakChange} />
              <Label htmlFor="auto">Auto-speak each word</Label>
            </div>
            <Select value={speech.voiceURI} onValueChange={speech.setVoiceURI}>
              <SelectTrigger aria-label="Voice">
                <SelectValue placeholder="Voice" />
              </SelectTrigger>
              <SelectContent>
                {speech.voices.map((voice) => (
                  <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label htmlFor="rate" className="whitespace-nowrap text-xs">
                Rate {speech.rate.toFixed(1)}×
              </Label>
              <Slider
                id="rate"
                min={0.5}
                max={2}
                step={0.1}
                value={[speech.rate]}
                onValueChange={([value]) => speech.setRate(value ?? 1)}
                aria-label="Speech rate"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-3">
            Speech isn't supported in this browser. Try Chrome, Edge or Safari.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <History className="size-3.5" aria-hidden /> Recent gestures
        </p>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            No gestures yet this session.
          </p>
        ) : (
          <ol className="max-h-40 space-y-1.5 overflow-y-auto" aria-label="Recent gesture history">
            {history.map((entry) => {
              const gesture = GESTURE_DEFINITIONS[entry.gestureId];
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-2 rounded-xl border bg-background px-2.5 py-1.5 text-sm"
                >
                  <span className="text-lg" aria-hidden>
                    {gesture.emoji}
                  </span>
                  <span className="font-semibold">{gesture.name}</span>
                  <span className="text-muted-foreground">→ “{entry.text}”</span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      entry.source === "live"
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {entry.source}
                  </span>
                  <time
                    className="text-[11px] tabular-nums text-muted-foreground"
                    dateTime={new Date(entry.at).toISOString()}
                  >
                    {new Date(entry.at).toLocaleTimeString([], {
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
