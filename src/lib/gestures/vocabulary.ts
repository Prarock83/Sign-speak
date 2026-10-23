// The single place to add or edit a static gesture.
//
// SignSpeak's dictionary is a DEMO MAPPING between a static hand shape and a
// short English word. It is not a translation of Indian Sign Language or of any
// natural sign language. Many real signs depend on movement, both hands,
// facial expression, orientation and grammar; a static landmark classifier
// cannot represent those.

import type { GestureDefinition, GestureId } from "./types";

export const GESTURE_LIBRARY: GestureDefinition[] = [
  {
    id: "open_palm",
    name: "Open Palm",
    emoji: "🖐️",
    defaultText: "HELLO",
    hint: "Five fingers spread wide",
    howTo:
      "Raise one hand with all five fingers straight and spread apart. Face your palm toward the camera and keep your thumb clearly away from your index finger.",
    category: "Hand shape",
  },
  {
    id: "flat_hand",
    name: "Flat Hand",
    emoji: "🤚",
    defaultText: "THANK YOU",
    hint: "Five fingers held together",
    howTo:
      "Hold all five fingers straight up and pressed together like a flat paddle. Keep the thumb out to the side and your palm facing the camera.",
    category: "Hand shape",
  },
  {
    id: "four",
    name: "Four Fingers",
    emoji: "🖖",
    defaultText: "FOUR",
    hint: "Four fingers, thumb tucked",
    howTo:
      "Raise the index, middle, ring and pinky fingers together and fold your thumb across your palm.",
    category: "Finger count",
  },
  {
    id: "three",
    name: "Three Fingers",
    emoji: "🤟",
    defaultText: "THREE",
    hint: "Index, middle + ring up",
    howTo:
      "Raise your index, middle and ring fingers. Fold your pinky down and tuck your thumb across your palm.",
    category: "Finger count",
  },
  {
    id: "victory",
    name: "Victory Sign",
    emoji: "✌️",
    defaultText: "PEACE",
    hint: "Two fingers spread in a V",
    howTo:
      "Raise your index and middle fingers and spread them into a clear V. Fold the ring and pinky fingers and tuck your thumb in.",
    category: "Finger count",
  },
  {
    id: "two",
    name: "Two Fingers",
    emoji: "✌️",
    defaultText: "TWO",
    hint: "Index + middle together",
    howTo:
      "Raise your index and middle fingers but keep them pressed together. Fold the other two fingers down and tuck your thumb in. The gap between the two fingers is what separates Two from Victory.",
    category: "Finger count",
  },
  {
    id: "point_up",
    name: "Point Up",
    emoji: "☝️",
    defaultText: "LOOK UP",
    hint: "Only the index finger up",
    howTo:
      "Extend only your index finger straight up. Curl the other three fingers and tuck your thumb against them.",
    category: "Pointing",
  },
  {
    id: "point_down",
    name: "Point Down",
    emoji: "👇",
    defaultText: "LOOK DOWN",
    hint: "Only the index finger down",
    howTo:
      "Extend only your index finger and angle it clearly downward. Keep the other fingers and thumb curled.",
    category: "Pointing",
  },
  {
    id: "point_side",
    name: "Point Sideways",
    emoji: "👉",
    defaultText: "THERE",
    hint: "Index finger points sideways",
    howTo:
      "Extend only your index finger and point it horizontally to the left or right. Keep the other fingers curled.",
    category: "Pointing",
  },
  {
    id: "fist",
    name: "Closed Fist",
    emoji: "✊",
    defaultText: "STOP",
    hint: "All fingers curled, thumb folded",
    howTo:
      "Close your hand into a fist. Tuck your thumb across the front of your fingers and keep it close to your palm.",
    category: "Thumb",
  },
  {
    id: "thumbs_up",
    name: "Thumbs Up",
    emoji: "👍",
    defaultText: "YES",
    hint: "Fist with the thumb up",
    howTo:
      "Make a fist and point your thumb straight up toward the ceiling. Keep the thumb clearly away from your curled index finger.",
    category: "Thumb",
  },
  {
    id: "thumbs_down",
    name: "Thumbs Down",
    emoji: "👎",
    defaultText: "NO",
    hint: "Fist with the thumb down",
    howTo:
      "Make a fist and point your thumb straight down toward the floor. Keep the rest of the hand still.",
    category: "Thumb",
  },
  {
    id: "thumb_side",
    name: "Thumb Sideways",
    emoji: "🤏",
    defaultText: "THIS",
    hint: "Fist with the thumb pointing aside",
    howTo:
      "Make a fist and extend your thumb horizontally to one side. Keep the thumb straight so it is not mistaken for a bent fist.",
    category: "Thumb",
  },
  {
    id: "ok",
    name: "OK Sign",
    emoji: "👌",
    defaultText: "OKAY",
    hint: "Thumb + index touch, three up",
    howTo:
      "Touch your thumb tip to your index fingertip to make a small circle, then raise your middle, ring and pinky fingers.",
    category: "Expressive",
  },
  {
    id: "pinch",
    name: "Pinch",
    emoji: "🤏",
    defaultText: "SMALL",
    hint: "Thumb + index touch, others curled",
    howTo:
      "Touch your thumb tip and index fingertip together, with the middle, ring and pinky fingers folded into your palm.",
    category: "Expressive",
  },
  {
    id: "call_me",
    name: "Call Me",
    emoji: "🤙",
    defaultText: "CALL ME",
    hint: "Thumb + pinky out",
    howTo:
      "Extend your thumb and pinky only, like a telephone handset, and fold the three middle fingers into your palm.",
    category: "Expressive",
  },
  {
    id: "rock_on",
    name: "Rock On",
    emoji: "🤘",
    defaultText: "ROCK ON",
    hint: "Index + pinky up, thumb tucked",
    howTo:
      "Raise your index and pinky fingers, fold the middle and ring fingers, and keep your thumb tucked across the folded fingers.",
    category: "Expressive",
  },
  {
    id: "i_love_you",
    name: "I Love You",
    emoji: "🤟",
    defaultText: "I LOVE YOU",
    hint: "Thumb, index + pinky out",
    howTo:
      "Raise your thumb, index and pinky fingers together. Fold your middle and ring fingers down. The extended thumb is what separates this from Rock On.",
    category: "Expressive",
  },
];

export const GESTURE_DEFINITIONS: Record<GestureId, GestureDefinition> = Object.fromEntries(
  GESTURE_LIBRARY.map((gesture) => [gesture.id, gesture]),
) as Record<GestureId, GestureDefinition>;

/** Editable starting dictionary for demo mode. Values are uppercase for display. */
export const DEFAULT_DICTIONARY: Record<GestureId, string> = Object.fromEntries(
  GESTURE_LIBRARY.map((gesture) => [gesture.id, gesture.defaultText]),
) as Record<GestureId, string>;

export const GESTURE_IDS = GESTURE_LIBRARY.map((gesture) => gesture.id);

/** One-click presentation sequence: a complete sentence from simulated poses. */
export const SAMPLE_DEMO_SEQUENCE: GestureId[] = [
  "open_palm",
  "thumbs_up",
  "flat_hand",
  "i_love_you",
];
