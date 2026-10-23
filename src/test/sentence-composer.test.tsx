import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SentenceComposer } from "@/components/SentenceComposer";
import type { SpeechController } from "@/hooks/use-speech";
import type { SentenceWord } from "@/lib/sentence";

const words: SentenceWord[] = [
  { id: 1, text: "HELLO", source: "live", gestureId: "open_palm" },
  { id: 2, text: "YES", source: "demo", gestureId: "thumbs_up" },
];

function speechMock(overrides: Partial<SpeechController> = {}): SpeechController {
  return {
    supported: true,
    voices: [],
    voiceURI: "",
    setVoiceURI: () => {},
    rate: 1,
    setRate: () => {},
    speaking: false,
    speak: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

function renderComposer(overrides: Partial<Parameters<typeof SentenceComposer>[0]> = {}) {
  const handlers = {
    onEditWord: vi.fn(),
    onRemoveWord: vi.fn(),
    onUndo: vi.fn(),
    onClear: vi.fn(),
    onPunctuate: vi.fn(),
    onAddManual: vi.fn(),
    onReplaceSentence: vi.fn(),
    onRepeatLast: vi.fn(),
    onCopy: vi.fn(),
    onSave: vi.fn(),
    onReset: vi.fn(),
    onAutoSpeakChange: vi.fn(),
    speech: speechMock(),
  };
  const props = {
    words,
    sentence: "HELLO YES",
    liveFrame: null,
    demoGesture: null,
    mappedText: null,
    mode: "Live Camera" as const,
    cameraOn: true,
    history: [],
    autoSpeak: false,
    ...handlers,
    ...overrides,
  };
  render(<SentenceComposer {...props} />);
  return props;
}

describe("SentenceComposer", () => {
  it("shows the sentence and editable word chips", () => {
    renderComposer();
    expect(screen.getByText("HELLO YES")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit word HELLO")).toHaveValue("HELLO");
    expect(screen.getByLabelText("Edit word YES")).toHaveValue("YES");
  });

  it("calls edit and remove actions per chip", () => {
    const props = renderComposer();
    fireEvent.change(screen.getByLabelText("Edit word HELLO"), { target: { value: "HI" } });
    expect(props.onEditWord).toHaveBeenCalledWith(1, "HI");
    fireEvent.click(screen.getByLabelText("Remove YES"));
    expect(props.onRemoveWord).toHaveBeenCalledWith(2);
  });

  it("wires undo, clear, repeat, punctuation and reset", () => {
    const props = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: /undo last word/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear sentence/i }));
    fireEvent.click(screen.getByRole("button", { name: /repeat last/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add period" }));
    fireEvent.click(screen.getByRole("button", { name: /reset the demo session/i }));
    expect(props.onUndo).toHaveBeenCalled();
    expect(props.onClear).toHaveBeenCalled();
    expect(props.onRepeatLast).toHaveBeenCalled();
    expect(props.onPunctuate).toHaveBeenCalledWith(".");
    expect(props.onReset).toHaveBeenCalled();
  });

  it("adds a manual word and replaces the full sentence", () => {
    const props = renderComposer();
    fireEvent.change(screen.getByLabelText("Add a word manually"), { target: { value: "please" } });
    fireEvent.click(screen.getByRole("button", { name: /add word/i }));
    expect(props.onAddManual).toHaveBeenCalledWith("please");

    fireEvent.change(screen.getByLabelText("Correct the full sentence"), {
      target: { value: "HELLO MY FRIEND" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(props.onReplaceSentence).toHaveBeenCalledWith("HELLO MY FRIEND");
  });

  it("speaks, copies and saves the sentence", () => {
    const props = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: /speak sentence/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy sentence/i }));
    fireEvent.click(screen.getByRole("button", { name: /save transcript/i }));
    expect(props.speech.speak).toHaveBeenCalledWith("HELLO YES");
    expect(props.onCopy).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalled();
  });

  it("shows an empty state with no words and disables sentence actions", () => {
    renderComposer({ words: [], sentence: "" });
    expect(screen.getByText(/no words yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /speak sentence/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /undo last word/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /clear sentence/i })).toBeDisabled();
  });

  it("shows a real-camera empty state without a recognized gesture", () => {
    renderComposer({
      words: [],
      sentence: "",
      liveFrame: {
        handCount: 1,
        gesture: null,
        reason: "Pose is not one of the supported static gestures",
        stability: 0,
        stableFrames: 0,
        needFrames: 8,
        accepted: null,
        rejection: "Pose is not one of the supported static gestures",
        delegate: "GPU",
        fps: 24,
      },
    });
    expect(screen.getByText("Unrecognized gesture")).toBeInTheDocument();
  });
});
