import { useState } from "react";
import type { Exercise } from "../../../types";

interface Props {
  exercise: Exercise;
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/** dialogue_order — tap dialogue lines into the correct order. */
export function DialogueOrderExercise({ exercise, setAnswer, disabled }: Props) {
  const lines = exercise.lines ?? [];
  const [picked, setPicked] = useState<string[]>([]);

  function pick(id: string) {
    if (disabled || picked.includes(id)) return;
    const next = [...picked, id];
    setPicked(next);
    setAnswer(next);
  }

  function undoTo(pos: number) {
    if (disabled) return;
    const next = picked.slice(0, pos);
    setPicked(next);
    setAnswer(next);
  }

  const bySk = new Map(lines.map((l) => [l.id, l.sk]));

  return (
    <>
      <div className="dialogue-order-list">
        {picked.length === 0 && <p className="hint-text">Обери репліки в правильному порядку</p>}
        {picked.map((id, i) => (
          <div key={id} className="dialogue-order-picked" onClick={() => undoTo(i)}>
            <span className="dialogue-order-num">{i + 1}</span>
            <span>{bySk.get(id)}</span>
          </div>
        ))}
      </div>
      <div className="chip-grid">
        {lines.map((line) => (
          <button key={line.id} type="button" className={`chip${picked.includes(line.id) ? " chip--used" : ""}`} disabled={disabled || picked.includes(line.id)} onClick={() => pick(line.id)}>
            {line.sk}
          </button>
        ))}
      </div>
    </>
  );
}
