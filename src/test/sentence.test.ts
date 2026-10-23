import { describe, expect, it } from "vitest";
import {
  editWord,
  punctuate,
  removeWord,
  sentenceText,
  transcriptFile,
  undoLastWord,
  wordsFromText,
  type SentenceWord,
} from "@/lib/sentence";

const words: SentenceWord[] = [
  { id: 1, text: "HELLO", source: "live", gestureId: "open_palm" },
  { id: 2, text: "YES", source: "demo", gestureId: "thumbs_up" },
  { id: 3, text: "friend", source: "manual" },
];

describe("sentence composition", () => {
  it("joins words into a readable sentence", () => {
    expect(sentenceText(words)).toBe("HELLO YES friend");
    expect(sentenceText([])).toBe("");
  });

  it("ignores blank words when joining", () => {
    expect(sentenceText([...words, { id: 4, text: "   ", source: "manual" }])).toBe(
      "HELLO YES friend",
    );
  });

  it("edits a single word without touching the rest", () => {
    expect(editWord(words, 2, "NO").map((word) => word.text)).toEqual(["HELLO", "NO", "friend"]);
  });

  it("removes individual words and supports undo", () => {
    expect(removeWord(words, 2).map((word) => word.text)).toEqual(["HELLO", "friend"]);
    expect(undoLastWord(words).map((word) => word.text)).toEqual(["HELLO", "YES"]);
    expect(undoLastWord([])).toEqual([]);
  });

  it("attaches punctuation to the last word instead of adding a space", () => {
    const punctuated = punctuate(words, "!");
    expect(sentenceText(punctuated)).toBe("HELLO YES friend!");
    expect(punctuated).toHaveLength(3);
  });

  it("replaces existing trailing punctuation", () => {
    const once = punctuate(words, "!");
    expect(sentenceText(punctuate(once, "?"))).toBe("HELLO YES friend?");
  });

  it("splits a corrected sentence back into editable chips", () => {
    let id = 10;
    const split = wordsFromText("  Hello,   friend!  ", "manual", () => id++);
    expect(split.map((word) => word.text)).toEqual(["Hello,", "friend!"]);
    expect(split.map((word) => word.id)).toEqual([10, 11]);
    expect(split.every((word) => word.source === "manual")).toBe(true);
  });

  it("writes a transcript with mode and disclaimer", () => {
    const file = transcriptFile("HELLO YES", "Live Camera", new Date("2026-01-02T03:04:05Z"));
    expect(file).toContain("SignSpeak — session transcript");
    expect(file).toContain("Input mode: Live Camera");
    expect(file).toContain("HELLO YES");
    expect(file).toContain("not a sign-language translation");
  });
});
