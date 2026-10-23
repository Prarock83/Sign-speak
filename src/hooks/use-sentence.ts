import { useCallback, useRef, useState } from "react";
import type { GestureId } from "@/lib/gestures";
import {
  editWord,
  punctuate,
  removeWord,
  sentenceText,
  undoLastWord,
  wordsFromText,
  type PunctuationMark,
  type SentenceWord,
  type WordSource,
} from "@/lib/sentence";

export function useSentence() {
  const [words, setWords] = useState<SentenceWord[]>([]);
  const nextId = useRef(1);

  const addWord = useCallback((text: string, source: WordSource, gestureId?: GestureId) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const word: SentenceWord = { id: nextId.current++, text: trimmed, source };
    if (gestureId) word.gestureId = gestureId;
    setWords((current) => [...current, word]);
  }, []);

  const addGesture = useCallback(
    (gestureId: GestureId, text: string, source: WordSource) => addWord(text, source, gestureId),
    [addWord],
  );

  const edit = useCallback((id: number, text: string) => {
    setWords((current) => editWord(current, id, text));
  }, []);

  const remove = useCallback((id: number) => {
    setWords((current) => removeWord(current, id));
  }, []);

  const undo = useCallback(() => setWords((current) => undoLastWord(current)), []);
  const clear = useCallback(() => setWords([]), []);

  const punctuateSentence = useCallback((mark: PunctuationMark) => {
    setWords((current) => punctuate(current, mark));
  }, []);

  const replaceSentence = useCallback((text: string, source: WordSource = "manual") => {
    setWords(wordsFromText(text, source, () => nextId.current++));
  }, []);

  return {
    words,
    sentence: sentenceText(words),
    addWord,
    addGesture,
    edit,
    remove,
    undo,
    clear,
    punctuate: punctuateSentence,
    replaceSentence,
    resetIds: () => {
      nextId.current = 1;
    },
  };
}

export type SentenceController = ReturnType<typeof useSentence>;
