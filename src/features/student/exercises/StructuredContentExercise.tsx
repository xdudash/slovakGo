import type { Exercise, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";
import { OptionListExercise } from "./OptionListExercise";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  answer: string | string[];
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/** Covers reading_comprehension, real_menu, real_document, real_schedule. */
export function StructuredContentExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);
  const chosen = Array.isArray(answer) ? answer : [];

  function setQuestionAnswer(idx: number, value: string) {
    const next = [...chosen];
    next[idx] = value;
    setAnswer(next);
  }

  const content = (
    <>
      {exercise.text && <div className="card exercise-text-block">{tx(exercise.text)}</div>}
      {exercise.document && (
        <div className="card structured-document">
          {exercise.document.title && <h3>{tx(exercise.document.title)}</h3>}
          {exercise.document.fields.map((f, i) => (
            <div key={i} className="structured-document-row">
              <span className="muted">{tx(f.label)}</span>
              <strong>{tx(f.value)}</strong>
            </div>
          ))}
        </div>
      )}
      {exercise.message && (
        <div className="card structured-message">
          {exercise.message.sender && <div className="structured-message-sender">{tx(exercise.message.sender)}</div>}
          <p>{tx(exercise.message.body)}</p>
        </div>
      )}
      {exercise.menuData && (
        <div className="structured-table-wrap">
          <table className="structured-table">
            <tbody>
              {exercise.menuData.map((row, i) => (
                <tr key={i}>
                  <td className="muted">{tx(row.category)}</td>
                  <td>{tx(row.item)}</td>
                  <td className="structured-table-price">{row.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {exercise.schedule && (
        <div className="structured-table-wrap">
          {exercise.schedule.title && <h3>{tx(exercise.schedule.title)}</h3>}
          <table className="structured-table">
            <tbody>
              {exercise.schedule.rows.map((row, i) => (
                <tr key={i}>
                  <td>{tx(row.day)}</td>
                  <td>{tx(row.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (exercise.type === "real_document" || exercise.type === "real_schedule" || exercise.type === "real_message") {
    return (
      <div className="structured-content-exercise">
        {content}
        {exercise.question && <p className="sk exercise-statement">{tx(exercise.question)}</p>}
        <OptionListExercise exercise={exercise} lesson={lesson} answer={answer} setAnswer={setAnswer} disabled={disabled} />
      </div>
    );
  }

  return (
    <div className="structured-content-exercise">
      {content}
      {(exercise.questions ?? []).map((q, idx) => (
        <div key={idx} className="card structured-question">
          <p className="sk exercise-statement">{tx(q.question)}</p>
          {q.options ? (
            <div className="option-list">
              {q.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`option${chosen[idx] === opt.id ? " active" : ""}`}
                  disabled={disabled}
                  onClick={() => setQuestionAnswer(idx, opt.id)}
                >
                  {opt.sk ?? tx(opt.text)}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="blank-text-input"
              value={chosen[idx] ?? ""}
              disabled={disabled}
              onChange={(e) => setQuestionAnswer(idx, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
