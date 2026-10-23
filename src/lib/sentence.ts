import type { GestureId } from "./gestures";

export type WordSource = "live" | "demo" | "manual";

export interface SentenceWord {
  id: number;
  text: string;
  source: WordSource;
  gestureId?: GestureId;
}

export const PUNCTUATION = [".", ",", "!", "?"] as const;
export type PunctuationMark = (typeof PUNCTUATION)[number];

export function sentenceText(words: SentenceWord[]): string {
  return words
    .map((word) => word.text.trim())
    .filter(Boolean)
    .join(" ");
}

export function appendWord(words: SentenceWord[], word: SentenceWord): SentenceWord[] {
  return word.text.trim() ? [...words, word] : words;
}

export function editWord(words: SentenceWord[], id: number, text: string): SentenceWord[] {
  return words.map((word) => (word.id === id ? { ...word, text } : word));
}

export function removeWord(words: SentenceWord[], id: number): SentenceWord[] {
  return words.filter((word) => word.id !== id);
}

export function undoLastWord(words: SentenceWord[]): SentenceWord[] {
  return words.slice(0, -1);
}

/** Punctuation attaches to the previous word rather than becoming its own chip. */
export function punctuate(words: SentenceWord[], mark: PunctuationMark): SentenceWord[] {
  if (words.length === 0) return words;
  const last = words[words.length - 1]!;
  const cleaned = last.text.trim().replace(/[.,!?]+$/, "");
  return [...words.slice(0, -1), { ...last, text: `${cleaned}${mark}` }];
}

/** Splits a manually corrected sentence into editable chips. */
export function wordsFromText(
  text: string,
  source: WordSource,
  nextId: () => number,
): SentenceWord[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ id: nextId(), text: word, source }));
}

export function transcriptFile(sentence: string, mode: string, date = new Date()): string {
  const stamp = date.toISOString().replace("T", " ").slice(0, 19);
  return [
    "SignSpeak — session transcript",
    `Saved: ${stamp}`,
    `Input mode: ${mode}`,
    "Note: static demo gestures mapped to custom words, not a sign-language translation.",
    "",
    sentence.trim() || "(empty sentence)",
    "",
  ].join("\n");
}

/** Browser-only: download a transcript without sending anything to a server. */
export function downloadTranscript(sentence: string, mode: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([transcriptFile(sentence, mode)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `signspeak-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
