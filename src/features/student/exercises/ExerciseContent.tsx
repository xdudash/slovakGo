import type { Exercise, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
}

/**
 * Renders semantic/context fields that describe what the learner is answering.
 * Answer-family components stay focused on interaction mechanics.
 */
export function ExerciseContent({ exercise, lesson }: Props) {
  const { tx } = useLessonLocale(lesson);
  const context = tx(exercise.context);
  const target = tx(exercise.target);
  const phrase = tx(exercise.phrase);

  return (
    <div className="exercise-content">
      {exercise.skill?.length ? (
        <div className="exercise-skills">
          {exercise.skill.map((skill) => <span key={skill} className="badge">{skill}</span>)}
        </div>
      ) : null}

      {exercise.prompt && <div className="card exercise-text-block exercise-prompt">{tx(exercise.prompt)}</div>}
      {exercise.situation && <div className="card exercise-text-block exercise-situation">{tx(exercise.situation)}</div>}

      {exercise.dialogue?.length ? (
        <div className="card theory-dialogue exercise-dialogue">
          {exercise.dialogue.map((line, index) => (
            <div key={`${line.speaker ?? "line"}-${index}`} className="theory-dialogue-line dialogue-line">
              {line.speaker && <span className="theory-dialogue-speaker dialogue-speaker">{line.speaker}:</span>}
              <span className="theory-dialogue-sk">{line.sk}</span>
            </div>
          ))}
        </div>
      ) : null}

      {context && exercise.type !== "sentence_builder" && exercise.type !== "sentence_order" ? (
        <div className="card exercise-text-block exercise-context">{context}</div>
      ) : null}
      {target && target !== context && <div className="card exercise-text-block exercise-target">{target}</div>}
      {phrase && phrase !== context && phrase !== target && <div className="card exercise-text-block exercise-phrase">{phrase}</div>}
    </div>
  );
}
