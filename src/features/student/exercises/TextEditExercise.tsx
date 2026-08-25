import type { Exercise, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  answer: string | string[];
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/** Covers find_error (tap the wrong word), correct_error and transformation (free text). */
export function TextEditExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);
  const chosen = Array.isArray(answer) ? answer[0] ?? "" : answer;

  if (exercise.type === "find_error") {
    const words = tx(exercise.sentence).split(/(\s+)/);
    return (
      <p className="full-sentence-hint find-error-sentence">
        {words.map((w, i) => {
          const clean = w.trim();
          if (!clean) return <span key={i}>{w}</span>;
          return (
            <button
              key={i}
              type="button"
              className={`find-error-word${chosen === clean ? " active" : ""}`}
              disabled={disabled}
              onClick={() => setAnswer(clean)}
            >
              {w}
            </button>
          );
        })}
      </p>
    );
  }

  const source = tx(exercise.sentence ?? exercise.source);
  return (
    <div className="fill-blank-exercise">
      {source && <p className="full-sentence-hint">{source}</p>}
      <input
        className="blank-text-input"
        value={chosen}
        disabled={disabled}
        placeholder="Введи виправлений варіант…"
        onChange={(e) => setAnswer(e.target.value)}
      />
    </div>
  );
}
