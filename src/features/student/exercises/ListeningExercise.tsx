import type { Exercise, Lesson } from "../../../types";
import { AudioBanner } from "./AudioBanner";
import { OptionListExercise } from "./OptionListExercise";
import { TrueFalseExercise } from "./TrueFalseExercise";
import { BlankFillExercise } from "./BlankFillExercise";

interface Props {
  exercise: Exercise;
  lesson: Lesson;
  answer: string | string[];
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
  soundEnabled: boolean;
}

/** Covers listen_choice, listen_true_false, listen_fill, dictation — audio banner + a delegated answer UI. */
export function ListeningExercise({ exercise, lesson, answer, setAnswer, disabled, soundEnabled }: Props) {
  const chosen = Array.isArray(answer) ? answer[0] ?? "" : answer;

  return (
    <div className="listening-exercise">
      <AudioBanner lesson={lesson} audioRef={exercise.audioRef} soundEnabled={soundEnabled} />
      {exercise.type === "listen_choice" && <OptionListExercise exercise={exercise} lesson={lesson} answer={answer} setAnswer={setAnswer} disabled={disabled} />}
      {exercise.type === "listen_true_false" && <TrueFalseExercise exercise={exercise} lesson={lesson} answer={answer} setAnswer={setAnswer} disabled={disabled} />}
      {exercise.type === "listen_fill" && <BlankFillExercise exercise={exercise} lesson={lesson} answer={answer} setAnswer={setAnswer} disabled={disabled} />}
      {exercise.type === "dictation" && (
        <div className="fill-blank-exercise">
          <input
            className="blank-text-input"
            value={chosen}
            disabled={disabled}
            placeholder="Надрукуй почуте речення…"
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
