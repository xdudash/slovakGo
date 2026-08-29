import type { Exercise, ExerciseOption, Lesson } from "../../../types";
import { useLessonLocale } from "../../../hooks/useLessonLocale";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  answer: string | string[];
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/**
 * Covers every new-format exercise whose answer is one-or-many option ids:
 * single_choice, multiple_select, dialogue_choose_reply, meaning_in_context,
 * natural_phrase, tone, register, hidden_meaning, real_document, real_schedule,
 * listen_choice.
 */
export function OptionListExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);
  const options = (exercise.options ?? []) as ExerciseOption[];
  const isMulti = exercise.type === "multiple_select";
  const chosen = Array.isArray(answer) ? answer : answer ? [answer] : [];

  function toggle(id: string) {
    if (disabled) return;
    if (isMulti) {
      setAnswer(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]);
    } else {
      setAnswer(id);
    }
  }

  return (
    <div className={`option-list${isMulti ? " option-list--multi" : ""}`}>
      {options.map((option) => {
        const label = option.sk ?? tx(option.text);
        const isChosen = chosen.includes(option.id);
        const revealClass = disabled && option.correct ? " option--correct" : disabled && isChosen && !option.correct ? " option--wrong" : "";
        return (
          <button
            key={option.id}
            type="button"
            className={`option${isChosen ? " active" : ""}${revealClass}`}
            onClick={() => toggle(option.id)}
            disabled={disabled}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
