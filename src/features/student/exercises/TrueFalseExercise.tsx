import type { Exercise, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  answer: string | string[];
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/** Covers new-format `true_false` (single statement) and `true_false_list`. */
export function TrueFalseExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);

  if (exercise.statements) {
    const chosen = Array.isArray(answer) ? answer : [];
    const map = new Map(chosen.map((entry) => entry.split(":") as [string, string]));

    function pick(idx: number, value: boolean) {
      if (disabled) return;
      const next = new Map(map);
      next.set(String(idx), String(value));
      setAnswer(Array.from(next.entries()).map(([k, v]) => `${k}:${v}`));
    }

    return (
      <div className="tf-list">
        {exercise.text && <div className="card exercise-text-block">{tx(exercise.text)}</div>}
        {exercise.statements.map((s, idx) => {
          const chosenValue = map.get(String(idx));
          return (
            <div key={idx} className="tf-list-row">
              <span className="tf-list-statement">{s.sk}</span>
              <div className="tf-toggle">
                <button type="button" className={`chip${chosenValue === "true" ? " active" : ""}`} disabled={disabled} onClick={() => pick(idx, true)}>Pravda</button>
                <button type="button" className={`chip${chosenValue === "false" ? " active" : ""}`} disabled={disabled} onClick={() => pick(idx, false)}>Nepravda</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const chosen = Array.isArray(answer) ? answer[0] : answer;
  return (
    <div>
      {exercise.text && <div className="card exercise-text-block">{tx(exercise.text)}</div>}
      <div className="sk exercise-statement">{tx(exercise.statement)}</div>
      <div className="option-list option-list--binary">
        <button type="button" className={`option option--true${chosen === "true" ? " active" : ""}`} disabled={disabled} onClick={() => setAnswer("true")}>Pravda</button>
        <button type="button" className={`option option--false${chosen === "false" ? " active" : ""}`} disabled={disabled} onClick={() => setAnswer("false")}>Nepravda</button>
      </div>
    </div>
  );
}
