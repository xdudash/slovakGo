import { describe, expect, it } from "vitest";
import {
  combineResults,
  evaluateWriting,
  routeBranch,
  scoreClosed,
  selectWritingTask,
  toCourseLevel,
  type PlacementAnswer
} from "./placementTestService";

function answers(correctIds: string[], unknownIds: string[] = []): PlacementAnswer[] {
  const ids = [
    "R001", "R002", "R003", "R004", "R005", "R006", "R007", "R008",
    "L001", "L002", "L003", "L004", "L005", "L006", "L007", "L008", "L009", "L010", "L011", "L012",
    "M001", "M002", "M003", "M004", "M005", "M006", "M007", "M008", "M009", "M010", "M011", "M012",
    "H001", "H002", "H003", "H004", "H005", "H006", "H007", "H008", "H009", "H010", "H011", "H012"
  ];
  return ids.map((questionId) => ({
    questionId,
    selectedOptionId: unknownIds.includes(questionId) ? "unknown" : "a",
    status: unknownIds.includes(questionId) ? "unknown" : correctIds.includes(questionId) ? "correct" : "incorrect",
    responseTimeMs: 1000
  }));
}

describe("placement routing", () => {
  it("routes weak basics to low", () => {
    expect(routeBranch(answers(["R001", "R002"]))).toBe("low");
  });

  it("routes strong basics and advanced answers to high", () => {
    expect(routeBranch(answers(["R001", "R002", "R003", "R005", "R006", "R007"]))).toBe("high");
  });

  it("uses middle as fallback", () => {
    expect(routeBranch(answers(["R001", "R002", "R003", "R005", "R006"]))).toBe("middle");
  });
});

describe("closed scoring", () => {
  it("scores the upper low branch as A2", () => {
    const correct = Array.from({ length: 12 }, (_, index) => `L${String(index + 1).padStart(3, "0")}`);
    expect(scoreClosed("low", answers(correct))).toBe("A2");
  });

  it("does not confirm C2 from closed questions", () => {
    const correct = Array.from({ length: 12 }, (_, index) => `H${String(index + 1).padStart(3, "0")}`);
    expect(scoreClosed("high", answers(correct))).toBe("C2_candidate");
  });
});

describe("writing and combined result", () => {
  it("selects the upper-bound task for a plus result", () => {
    expect(selectWritingTask("B1+").id).toBe("W4");
  });

  it("lowers a closed result when writing is two levels lower", () => {
    expect(combineResults("B2", "A2")).toBe("B1");
  });

  it("raises by at most one plus marker", () => {
    expect(combineResults("B1", "B2")).toBe("B1+");
  });

  it("requires writing to confirm C2", () => {
    expect(combineResults("C2_candidate", "C2")).toBe("C2");
    expect(combineResults("C2_candidate", "C1")).toBe("C1+");
    expect(toCourseLevel("C2")).toBe("C1");
  });

  it("does not award a language level for lorem ipsum", () => {
    const task = selectWritingTask("B2");
    const lorem = Array.from({ length: 18 }, () => "Lorem ipsum dolor sit amet, consectetur adipiscing elit.").join(" ");
    expect(evaluateWriting(lorem, task).level).toBe("A0");
  });

  it("caps a fluent but unrelated Slovak news text", () => {
    const task = selectWritingTask("B2");
    const news = Array.from({ length: 10 }, () =>
      "Vláda dnes rokovala o novom zákone, ktorý má zmeniť pravidlá v zdravotníctve. Minister povedal, že opatrenie je dôležité, ale opozícia s návrhom nesúhlasí."
    ).join(" ");
    expect(evaluateWriting(news, task).level).toBe("A2");
    expect(evaluateWriting(news, task).scores.task_completion).toBe(0);
  });

  it("recognizes a relevant Slovak response to the selected task", () => {
    const task = selectWritingTask("B2");
    const response = Array.from({ length: 7 }, () =>
      "Online vyučovanie má výhody, pretože je flexibilné, ale nevýhodou je slabší osobný kontakt. Prezenčné štúdium je prirodzenejšie. Podľa mňa je najlepším riešením hybridný model."
    ).join(" ");
    expect(evaluateWriting(response, task).scores.task_completion).toBeGreaterThanOrEqual(3);
    expect(evaluateWriting(response, task).level).not.toBe("A0");
  });
});
