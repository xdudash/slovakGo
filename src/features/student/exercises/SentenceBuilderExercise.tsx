import { useState } from "react";
import type { Exercise, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

function joinTokens(tokens: string[]): string {
  let out = "";
  for (const tok of tokens) {
    out += /^[,.!?;:]+$/.test(tok) || out === "" ? tok : " " + tok;
  }
  return out;
}

/** Covers sentence_builder and sentence_order — tap tokens into place, in order. */
export function SentenceBuilderExercise({ exercise, lesson, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);
  const tokens = exercise.tokens ?? [];
  const [picked, setPicked] = useState<number[]>([]);

  function pick(idx: number) {
    if (disabled || picked.includes(idx)) return;
    const next = [...picked, idx];
    setPicked(next);
    setAnswer(next.map((i) => tokens[i]));
  }

  function undo(pos: number) {
    if (disabled) return;
    const next = picked.slice(0, pos);
    setPicked(next);
    setAnswer(next.map((i) => tokens[i]));
  }

  return (
    <>
      {exercise.context && <div className="card exercise-text-block">{tx(exercise.context)}</div>}
      <div className="answer-build" onClick={() => undo(Math.max(0, picked.length - 1))}>
        {picked.length > 0 ? joinTokens(picked.map((i) => tokens[i])) : "Обери слова нижче"}
      </div>
      <div className="chip-grid">
        {tokens.map((token, idx) => (
          <button key={idx} type="button" className={`chip${picked.includes(idx) ? " chip--used" : ""}`} disabled={disabled || picked.includes(idx)} onClick={() => pick(idx)}>
            {token}
          </button>
        ))}
      </div>
    </>
  );
}
