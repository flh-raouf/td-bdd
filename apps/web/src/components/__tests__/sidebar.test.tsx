import { describe, expect, it } from "vitest";
import { getExerciseIconColor } from "../sidebar";

describe("getExerciseIconColor", () => {
  it("keeps clean completed exercises green even after hints or solution reveal", () => {
    expect(
      getExerciseIconColor({
        completedStatus: "success",
        isCompleted: true,
        isHinted: true,
        isRevealed: true,
      }),
    ).toBe("text-success");
  });

  it("freezes hinted submissions as yellow", () => {
    expect(
      getExerciseIconColor({
        completedStatus: "hinted",
        isCompleted: true,
        isHinted: true,
        isRevealed: true,
      }),
    ).toBe("text-yellow-400");
  });

  it("freezes revealed submissions as destructive", () => {
    expect(
      getExerciseIconColor({
        completedStatus: "revealed",
        isCompleted: true,
        isHinted: true,
        isRevealed: true,
      }),
    ).toBe("text-destructive");
  });

  it("marks revealed unanswered exercises as destructive", () => {
    expect(
      getExerciseIconColor({
        isCompleted: false,
        isHinted: true,
        isRevealed: true,
      }),
    ).toBe("text-destructive");
  });
});
