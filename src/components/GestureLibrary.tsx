import {
  BookOpen,
  Brain,
  Camera,
  Clock,
  Database,
  FlaskConical,
  Hand,
  Info,
  Languages,
  Play,
  ScanFace,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GESTURE_LIBRARY,
  STATIC_GESTURE_CLASSIFIER,
  type FrameDetection,
  type GestureId,
} from "@/lib/gestures";

interface GestureLibraryProps {
  dictionary: Record<GestureId, string>;
  onChangeWord: (id: GestureId, text: string) => void;
  onResetDictionary: () => void;
  liveFrame: FrameDetection | null;
  cameraOn: boolean;
  onTest: (id: GestureId) => void;
}

function statusFor(
  id: GestureId,
  liveFrame: FrameDetection | null,
  cameraOn: boolean,
): { label: string; className: string } {
  if (liveFrame?.gesture === id) {
    if (liveFrame.accepted || liveFrame.stability >= 1) {
      return { label: "Recognized now", className: "bg-success/15 text-success" };
    }
    return {
      label: `Matching ${Math.round(liveFrame.stability * 100)}%`,
      className: "bg-accent text-accent-foreground",
    };
  }
  if (cameraOn)
    return { label: "Ready · not detected", className: "bg-muted text-muted-foreground" };
  return { label: "Camera off", className: "bg-muted text-muted-foreground" };
}

export function GestureLibrary({
  dictionary,
  onChangeWord,
  onResetDictionary,
  liveFrame,
  cameraOn,
  onTest,
}: GestureLibraryProps) {
  return (
    <section id="library" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">Gesture Library</h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Every supported static pose, how to make it, and the demo word it adds. Edit any mapping
            below — the dictionary is yours for the demonstration.
          </p>
        </div>
        <Button variant="outline" onClick={onResetDictionary}>
          Reset dictionary
        </Button>
      </div>

      <aside className="mt-5 grid gap-3 rounded-2xl border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            Hand,
            "One hand, inside the frame",
            "Keep a single hand 40–60 cm from the camera, palm or back toward the lens.",
          ],
          [
            Camera,
            "Light your hand",
            "Face a window or lamp. Strong backlight makes landmarks unstable.",
          ],
          [
            Clock,
            "Hold the pose",
            "Stay still for about 0.4 s so the stability filter can accept the gesture.",
          ],
          [
            Info,
            "Release to repeat",
            "Lower your hand or change pose before repeating. Press Repeat Last to add the same word on purpose.",
          ],
        ].map(([Icon, title, body]) => {
          const I = Icon as typeof Hand;
          return (
            <div key={title as string} className="flex gap-2.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <I className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{title as string}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{body as string}</p>
              </div>
            </div>
          );
        })}
      </aside>

      <Tabs defaultValue="library" className="mt-7">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="library">
            <BookOpen className="mr-1.5 size-4" aria-hidden /> Static gestures
          </TabsTrigger>
          <TabsTrigger value="sign-language">
            <Languages className="mr-1.5 size-4" aria-hidden /> Sign language mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-5">
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            These are custom gesture-to-text mappings for the demo, not translations of Indian Sign
            Language or any other natural sign language. “Test This Gesture” adds simulated input,
            labelled amber in the composer.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GESTURE_LIBRARY.map((gesture) => {
              const status = statusFor(gesture.id, liveFrame, cameraOn);
              return (
                <article
                  key={gesture.id}
                  className="flex flex-col rounded-3xl border bg-card p-4 shadow-card"
                  aria-label={gesture.name}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-3xl"
                      aria-hidden
                    >
                      {gesture.emoji}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                      {gesture.category}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">{gesture.name}</h3>
                  <p className="text-sm text-muted-foreground">{gesture.hint}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {gesture.howTo}
                  </p>

                  <div className="mt-3">
                    <Label
                      htmlFor={`word-${gesture.id}`}
                      className="text-[11px] uppercase tracking-wide text-muted-foreground"
                    >
                      Output word
                    </Label>
                    <Input
                      id={`word-${gesture.id}`}
                      value={dictionary[gesture.id]}
                      onChange={(event) => onChangeWord(gesture.id, event.target.value)}
                      onBlur={() => {
                        if (!dictionary[gesture.id]?.trim())
                          onChangeWord(gesture.id, gesture.defaultText);
                      }}
                      className="mt-1 h-9 font-semibold"
                      aria-label={`Output word for ${gesture.name}`}
                    />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <Button size="sm" variant="soft" onClick={() => onTest(gesture.id)}>
                      <Play /> Test This Gesture
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Simulated test input
                  </p>
                </article>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="sign-language" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border bg-card p-5 shadow-card">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-bold text-warning">
                <Info className="size-3.5" aria-hidden /> Research preview · not implemented
              </span>
              <h3 className="mt-3 font-display text-2xl font-bold">Future Sign Language Mode</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                SignSpeak 2.0 recognizes a static hand shape and maps it to a word you can edit.
                Genuine Indian Sign Language recognition is a different problem: signs change over
                time, use both hands, depend on palm orientation, facial expression, signing space
                and grammar. A single-frame landmark classifier cannot honestly claim to translate
                ISL.
              </p>
              <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                <p className="font-semibold">What the current build is</p>
                <p className="mt-1 text-muted-foreground">
                  Static Gesture Mode: {GESTURE_LIBRARY.length} hand-shape classes, one hand, 21
                  MediaPipe landmarks, custom demo dictionary. Classifier id:{" "}
                  <code className="rounded bg-background px-1">{STATIC_GESTURE_CLASSIFIER.id}</code>
                  .
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  [Hand, "One hand", "A single hand's 21 landmarks."],
                  [Camera, "Static pose", "No motion or holding time in the model."],
                  [Users, "No grammar", "Words are concatenated without sign grammar."],
                  [Info, "Custom meanings", "Words are demo mappings, not ISL glosses."],
                ].map(([Icon, title, body]) => {
                  const I = Icon as typeof Hand;
                  return (
                    <div key={title as string} className="rounded-xl border p-3">
                      <I className="size-4 text-primary" aria-hidden />
                      <p className="mt-1 text-sm font-semibold">{title as string}</p>
                      <p className="text-xs text-muted-foreground">{body as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold">What a real ISL mode requires</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {[
                  [
                    Database,
                    "Validated ISL data",
                    "A corpus collected with Deaf ISL signers, with signer-independent train/validation/test splits and community review.",
                  ],
                  [
                    Brain,
                    "Temporal recognition",
                    "A sequence model over landmark or video frames (for example an ST-GCN or transformer) rather than one static frame.",
                  ],
                  [
                    ScanFace,
                    "Two hands + face",
                    "Two-hand landmarks, body pose, facial expression and signing-space context as first-class inputs.",
                  ],
                  [
                    Languages,
                    "Gloss → sentence",
                    "A language model that turns recognized signs into grammatical English or ISL gloss, with human evaluation.",
                  ],
                ].map(([Icon, title, body]) => {
                  const I = Icon as typeof Hand;
                  return (
                    <li key={title as string} className="flex gap-3">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <I className="size-4" aria-hidden />
                      </span>
                      <span>
                        <span className="font-semibold">{title as string}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {body as string}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 rounded-2xl border border-dashed p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FlaskConical className="size-4 text-primary" aria-hidden /> Architecture hook
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The detection loop consumes a{" "}
                  <code className="rounded bg-muted px-1">GestureClassifier</code>. Trained
                  classifiers can implement the same interface; a temporal mode will instead need a
                  frame buffer and sequence model. No fake “ISL toggle” is included while that model
                  does not exist.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
