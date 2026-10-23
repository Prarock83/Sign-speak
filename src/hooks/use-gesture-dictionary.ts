import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildGestureMap,
  DEFAULT_DICTIONARY,
  GESTURE_DEFINITIONS,
  normalizeDictionary,
  type GestureId,
} from "@/lib/gestures";

const STORAGE_KEY = "signspeak.dictionary.v1";

export function useGestureDictionary() {
  const [dictionary, setDictionary] = useState<Record<GestureId, string>>({
    ...DEFAULT_DICTIONARY,
  });
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDictionary(normalizeDictionary(JSON.parse(saved)));
    } catch {
      // A blocked or malformed localStorage should never stop the demo.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionary));
    } catch {
      // Private mode can reject writes; the in-memory dictionary still works.
    }
  }, [dictionary, restored]);

  const setWord = useCallback((id: GestureId, text: string) => {
    setDictionary((current) => ({ ...current, [id]: text }));
  }, []);

  const resetDictionary = useCallback(() => {
    setDictionary({ ...DEFAULT_DICTIONARY });
  }, []);

  /** A blank edit falls back to the default so recognition never adds nothing. */
  const textFor = useCallback(
    (id: GestureId) => dictionary[id]?.trim() || GESTURE_DEFINITIONS[id].defaultText,
    [dictionary],
  );

  const gestureMap = useMemo(() => buildGestureMap(dictionary), [dictionary]);

  return { dictionary, setWord, resetDictionary, textFor, gestureMap };
}
