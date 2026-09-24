import { useState } from "react";
import type { Exercise, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  answer: string | string[];
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/** Covers matching, collocation (text pairs) and image_match (word ↔ picture). */
export function MatchingExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx, asset } = useLessonLocale(lesson);
  const isImageMatch = exercise.type === "image_match";

  const left = isImageMatch
    ? ((exercise.items ?? []) as { sk: string; imageRef: string }[]).map((it) => it.sk)
    : (exercise.pairs ?? []).map((p) => tx(p.left));
  const rightRaw = isImageMatch
    ? ((exercise.items ?? []) as { sk: string; imageRef: string }[]).map((it) => it.imageRef)
    : (exercise.pairs ?? []).map((p) => tx(p.right));

  const [order] = useState(() => {
    const idx = rightRaw.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  });
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);

  const chosen = Array.isArray(answer) ? answer : [];
  const pairMap = new Map<number, number>(
    chosen.map((entry) => {
      const [leftIdx, rightIdx] = entry.split("|").map(Number);
      return [leftIdx, rightIdx];
    })
  );
  const matchedRight = new Set(pairMap.values());

  function removeLeftPair(leftIdx: number): string[] {
    return chosen.filter((entry) => Number(entry.split("|")[0]) !== leftIdx);
  }

  function pickLeft(idx: number) {
    if (disabled) return;
    if (pairMap.has(idx)) {
      setAnswer(removeLeftPair(idx));
    }
    setSelectedLeft((prev) => (prev === idx ? null : idx));
  }

  function pickRight(idx: number) {
    if (disabled || selectedLeft == null) return;

    // A right-side item belongs to only one pair. If it was already paired,
    // remove the old pair before assigning it to the currently selected left.
    const withoutLeft = removeLeftPair(selectedLeft);
    const next = withoutLeft.filter((entry) => Number(entry.split("|")[1]) !== idx);
    next.push(`${selectedLeft}|${idx}`);
    setAnswer(next);
    setSelectedLeft(null);
  }

  return (
    <div className="match-grid">
      <div className="match-col">
        {left.map((label, idx) => (
          <button
            key={idx}
            type="button"
            className={`match-item${pairMap.has(idx) ? " matched" : selectedLeft === idx ? " active" : ""}`}
            onClick={() => pickLeft(idx)}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="match-col">
        {order.map((idx) => {
          const img = isImageMatch ? asset(rightRaw[idx], "images") : undefined;
          return (
            <button
              key={idx}
              type="button"
              className={`match-item${matchedRight.has(idx) ? " matched" : ""}`}
              onClick={() => pickRight(idx)}
              disabled={disabled || selectedLeft == null}
            >
              {isImageMatch
                ? (img ? <img src={img.src} alt={img.alt ?? ""} loading="lazy" className="match-item-image" /> : rightRaw[idx])
                : rightRaw[idx]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
