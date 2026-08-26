import { describe, expect, it } from "vitest";
import { soundService } from "./soundService";

describe("soundService", () => {
  it("is safe when sound is disabled", () => {
    expect(() => soundService.play("correct", false)).not.toThrow();
  });

  it("is safe when Web Audio is unavailable", () => {
    expect(() => soundService.play("complete", true)).not.toThrow();
  });
});
