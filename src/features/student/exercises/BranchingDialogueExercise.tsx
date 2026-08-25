import { useState } from "react";
import type { Exercise } from "../../../types";

interface Props {
  exercise: Exercise;
  setAnswer: (value: string | string[]) => void;
  disabled?: boolean;
}

/**
 * branching_dialogue — walk a small dialogue graph. Reaching a `quality:"wrong"`
 * choice routes to a dead-end node with a "try again" reset; only a fully
 * "best"-quality path is submitted as the answer.
 */
export function BranchingDialogueExercise({ exercise, setAnswer, disabled }: Props) {
  const nodes = exercise.nodes ?? {};
  const startNode = exercise.startNode ?? Object.keys(nodes)[0];
  const [currentNodeId, setCurrentNodeId] = useState(startNode);
  const [history, setHistory] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const node = nodes[currentNodeId];

  function choose(choiceId: string) {
    if (disabled) return;
    const choice = node?.choices?.find((c) => c.id === choiceId);
    if (!choice) return;
    const nextHistory = [...history, choice.id];
    setHistory(nextHistory);
    if (choice.quality === "wrong" || !nodes[choice.next]) {
      if (choice.quality === "wrong") {
        setFailed(true);
        return;
      }
      // quality "best" leading to a terminal (non-fail) sentinel node id = success.
      setSucceeded(true);
      setAnswer(nextHistory);
      return;
    }
    setCurrentNodeId(choice.next);
  }

  function retry() {
    setCurrentNodeId(startNode);
    setHistory([]);
    setFailed(false);
  }

  if (succeeded) {
    return <div className="card branching-success">{exercise.successMessage ? String(exercise.successMessage) : "Діалог пройдено правильно."}</div>;
  }

  if (failed) {
    return (
      <div className="card branching-fail">
        <p>Ця відповідь веде в глухий кут у розмові.</p>
        <button type="button" className="chip" onClick={retry}>Спробувати знову</button>
      </div>
    );
  }

  return (
    <div className="branching-dialogue">
      <div className="branching-node">
        {node?.speaker && <span className="dialogue-order-num">{node.speaker}</span>}
        <p className="sk exercise-statement">{node?.sk}</p>
      </div>
      <div className="option-list">
        {(node?.choices ?? []).map((choice) => (
          <button key={choice.id} type="button" className="option" disabled={disabled} onClick={() => choose(choice.id)}>
            {choice.sk}
          </button>
        ))}
      </div>
    </div>
  );
}
