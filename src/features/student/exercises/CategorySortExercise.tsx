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

export function CategorySortExercise({ exercise, lesson, answer, setAnswer, disabled }: Props) {
  const { tx } = useLessonLocale(lesson);
  const items = (exercise.items ?? []) as { sk: string; category: string }[];
  const categories = exercise.categories ?? [];
  const chosen = Array.isArray(answer) ? answer : [];
  const map = new Map(chosen.map((entry) => entry.split(":") as [string, string]));
  const [activeItem, setActiveItem] = useState<number | null>(0);

  function place(categoryId: string) {
    if (disabled || activeItem == null) return;
    const next = new Map(map);
    next.set(String(activeItem), categoryId);
    setAnswer(Array.from(next.entries()).map(([k, v]) => `${k}:${v}`));
    const nextEmpty = items.findIndex((_, idx) => !next.has(String(idx)));
    setActiveItem(nextEmpty === -1 ? null : nextEmpty);
  }

  const unplaced = items.map((_, idx) => idx).filter((idx) => !map.has(String(idx)));

  return (
    <div className="category-sort">
      <div className="chip-grid">
        {unplaced.map((idx) => (
          <button key={idx} type="button" className={`chip${activeItem === idx ? " active" : ""}`} disabled={disabled} onClick={() => setActiveItem(idx)}>
            {items[idx].sk}
          </button>
        ))}
      </div>
      <div className="category-board">
        {categories.map((cat) => (
          <div key={cat.id} className="category-bucket" onClick={() => place(cat.id)}>
            <div className="category-bucket-title">{tx(cat.title)}</div>
            <div className="category-bucket-items">
              {items.map((item, idx) => map.get(String(idx)) === cat.id ? <span key={idx} className="chip chip--placed">{item.sk}</span> : null)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
