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

/** Covers fill_blank, listen_fill, dropdown_blank, cloze_text, word_bank, drag_to_blank. */
export function BlankFillExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);
  // Hooks must run unconditionally — `exercise.type` never changes for a mounted
  // instance (parent remounts via `key={exercise.id}`), but keep them top-level anyway.
  const [activeBlank, setActiveBlank] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<number | null>(0);

  if (exercise.type === "fill_blank" || exercise.type === "listen_fill") {
    const sentence = tx(exercise.sentence ?? exercise.displaySentence);
    const chosen = Array.isArray(answer) ? answer[0] ?? "" : answer;
    return (
      <div className="fill-blank-exercise">
        {sentence && <p className="full-sentence-hint">{sentence.replace("______", "___")}</p>}
        <input
          className="blank-text-input"
          value={chosen}
          disabled={disabled}
          placeholder="…"
          onChange={(e) => setAnswer(e.target.value)}
        />
        {exercise.hint && <p className="hint-text">{tx(exercise.hint)}</p>}
      </div>
    );
  }

  if (exercise.type === "drag_to_blank") {
    const sentence = tx(exercise.sentence);
    const chosen = Array.isArray(answer) ? answer[0] ?? "" : answer;
    return (
      <div className="fill-blank-exercise">
        {sentence && <p className="full-sentence-hint">{sentence.replace("______", chosen ? chosen : "___")}</p>}
        <div className="chip-grid">
          {(exercise.draggable ?? []).map((word) => (
            <button key={word} type="button" className={`chip${chosen === word ? " active" : ""}`} disabled={disabled} onClick={() => setAnswer(word)}>
              {word}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (exercise.type === "dropdown_blank") {
    const parts = exercise.sentenceParts ?? [];
    const chosen = Array.isArray(answer) ? answer : [];
    const map = new Map(chosen.map((entry) => entry.split("=") as [string, string]));
    const currentBlank = activeBlank ?? parts.find((p) => p.blankId && !map.has(p.blankId))?.blankId ?? null;

    function pick(blankId: string, value: string) {
      if (disabled) return;
      const next = new Map(map);
      next.set(blankId, value);
      setAnswer(Array.from(next.entries()).map(([k, v]) => `${k}=${v}`));
      const remaining = parts.filter((p) => p.blankId && p.blankId !== blankId && !next.has(p.blankId));
      setActiveBlank(remaining[0]?.blankId ?? null);
    }

    return (
      <div className="blank-inline-exercise">
        <p className="full-sentence-hint">
          {parts.map((part, i) =>
            part.blankId ? (
              <button
                key={i}
                type="button"
                className={`blank-slot${currentBlank === part.blankId ? " active" : ""}`}
                onClick={() => !disabled && setActiveBlank(part.blankId!)}
              >
                {map.get(part.blankId) || "___"}
              </button>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </p>
        {currentBlank && (
          <div className="chip-grid">
            {(parts.find((p) => p.blankId === currentBlank)?.options ?? []).map((opt) => (
              <button key={opt} type="button" className="chip" disabled={disabled} onClick={() => pick(currentBlank, opt)}>{opt}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (exercise.type === "cloze_text") {
    const parts = exercise.textParts ?? [];
    const chosen = Array.isArray(answer) ? answer : [];
    const map = new Map(chosen.map((entry) => entry.split("=") as [string, string]));

    function setBlank(blankId: string, value: string) {
      if (disabled) return;
      const next = new Map(map);
      next.set(blankId, value);
      setAnswer(Array.from(next.entries()).map(([k, v]) => `${k}=${v}`));
    }

    return (
      <p className="full-sentence-hint">
        {parts.map((part, i) =>
          part.blankId ? (
            <input
              key={i}
              className="blank-text-input blank-text-input--inline"
              value={map.get(part.blankId) ?? ""}
              disabled={disabled}
              onChange={(e) => setBlank(part.blankId!, e.target.value)}
            />
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </p>
    );
  }

  // word_bank
  const items = (exercise.items ?? []) as { sentence: string; correct: string }[];
  const chosen = Array.isArray(answer) ? answer : [];
  const map = new Map(chosen.map((entry) => entry.split("=") as [string, string]));
  const currentItem = activeItem;
  const usedWords = new Set(Array.from(map.values()));
  const bank = [...(exercise.wordBank ?? []), ...(exercise.extraWords ?? [])];

  function pickWord(word: string) {
    if (disabled || currentItem == null) return;
    const next = new Map(map);
    next.set(String(currentItem), word);
    setAnswer(Array.from(next.entries()).map(([k, v]) => `${k}=${v}`));
    const nextEmpty = items.findIndex((_, idx) => !next.has(String(idx)));
    setActiveItem(nextEmpty === -1 ? null : nextEmpty);
  }

  return (
    <div className="blank-inline-exercise">
      {items.map((item, idx) => {
        const [before, after] = item.sentence.split("______");
        return (
          <p key={idx} className="full-sentence-hint">
            {before}
            <button type="button" className={`blank-slot${currentItem === idx ? " active" : ""}`} disabled={disabled} onClick={() => setActiveItem(idx)}>
              {map.get(String(idx)) || "___"}
            </button>
            {after}
          </p>
        );
      })}
      <div className="chip-grid">
        {bank.map((word, i) => (
          <button key={`${word}-${i}`} type="button" className={`chip${usedWords.has(word) ? " chip--used" : ""}`} disabled={disabled} onClick={() => pickWord(word)}>
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
