import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");

describe("lesson phase styling", () => {
  const requiredSelectors = [
    ".lesson-intro-card",
    ".lesson-word-row",
    ".lesson-start-card",
    ".theory-body",
    ".lesson-words-screen",
    ".final-situation-card",
    ".lesson-result-screen",
    ".lesson-result-actions",
  ];

  it.each(requiredSelectors)("defines %s", (selector) => {
    expect(css).toContain(selector);
  });
});
