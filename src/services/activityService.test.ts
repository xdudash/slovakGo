import { describe, it, expect } from "vitest";
import { activeInterval } from "./activityService";
describe("active time", () => {
  it("counts recent input in a visible tab", () => expect(activeInterval(5000, 10000, 0, true)).toBe(5000));
  it("stops counting at the idle boundary", () => expect(activeInterval(58000, 63000, 0, true)).toBe(2000));
  it("ignores hidden tabs and suspended computers", () => {
    expect(activeInterval(0, 5000, 0, false)).toBe(0);
    expect(activeInterval(0, 3600000, 0, true)).toBe(0);
  });
});
