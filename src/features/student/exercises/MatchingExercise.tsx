import { useEffect, useState } from "react";
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
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongRight, setWrongRight] = useState<number | null>(null);

  const chosen = Array.isArray(answer) ? answer : [];
  useEffect(() => {
    if (matched.length > 0) setAnswer(matched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const matchedLeft = new Set(chosen.map((p) => Number(p.split("|")[0])));
  const matchedRight = new Set(chosen.map((p) => Number(p.split("|")[1])));

  function pickLeft(idx: number) {
    if (disabled || matchedLeft.has(idx)) return;
    setSelectedLeft((prev) => (prev === idx ? null : idx));
  }

  function pickRight(idx: number) {
    if (disabled || matchedRight.has(idx) || selectedLeft == null) return;
    if (selectedLeft === idx) {
      setMatched((prev) => [...prev, `${selectedLeft}|${idx}`]);
      setSelectedLeft(null);
    } else {
      setWrongRight(idx);
      setTimeout(() => { setWrongRight(null); setSelectedLeft(null); }, 500);
    }
  }

  return (
    <div className="match-grid">
      <div className="match-col">
        {left.map((label, idx) => (
          <button
            key={idx}
            type="button"
            className={`match-item${matchedLeft.has(idx) ? " matched" : selectedLeft === idx ? " active" : ""}`}
            onClick={() => pickLeft(idx)}
            disabled={disabled || matchedLeft.has(idx)}
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
              className={`match-item${matchedRight.has(idx) ? " matched" : wrongRight === idx ? " wrong" : ""}`}
              onClick={() => pickRight(idx)}
              disabled={disabled || matchedRight.has(idx)}
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
