import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider, useProgress } from "../hooks/use-progress";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ProgressProvider>{children}</ProgressProvider>;
}

describe("useProgress", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useProgress());
    }).toThrow("useProgress must be used within ProgressProvider");
  });

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });
    expect(result.current.completed).toEqual([]);
    expect(result.current.lastExerciseId).toBeNull();
    expect(result.current.hintedExerciseIds).toEqual([]);
    expect(result.current.revealedExerciseIds).toEqual([]);
  });

  it("markComplete adds exercise id", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markComplete("1.1");
    });

    expect(result.current.completed).toContain("1.1");
    expect(result.current.lastExerciseId).toBe("1.1");
  });

  it("markComplete does not duplicate ids", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markComplete("1.1");
      result.current.markComplete("1.1");
    });

    expect(result.current.completed).toEqual(["1.1"]);
  });

  it("markComplete persists to localStorage", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markComplete("1.1", "hinted");
    });

    const storedRaw = localStorage.getItem("bdd-revision-progress");
    expect(storedRaw).not.toBeNull();
    const stored = JSON.parse(storedRaw as string);
    expect(stored.completedExercises).toEqual(["1.1"]);
    expect(stored.completedExerciseStatuses).toEqual({ "1.1": "hinted" });
    expect(stored.lastExerciseId).toBe("1.1");
  });

  it("markHintUsed adds hinted exercise id", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markHintUsed("1.1");
    });

    expect(result.current.hintedExerciseIds).toContain("1.1");
  });

  it("markHintUsed does not duplicate ids", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markHintUsed("1.1");
      result.current.markHintUsed("1.1");
    });

    expect(result.current.hintedExerciseIds).toEqual(["1.1"]);
  });

  it("markSolutionRevealed adds revealed exercise id", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markSolutionRevealed("2.1.1");
    });

    expect(result.current.revealedExerciseIds).toContain("2.1.1");
  });

  it("markSolutionRevealed does not duplicate ids", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markSolutionRevealed("2.1.1");
      result.current.markSolutionRevealed("2.1.1");
    });

    expect(result.current.revealedExerciseIds).toEqual(["2.1.1"]);
  });

  it("reset clears all progress", () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.markComplete("1.1");
      result.current.markHintUsed("1.2");
      result.current.markSolutionRevealed("1.3");
    });

    expect(result.current.completed).toHaveLength(1);
    expect(result.current.hintedExerciseIds).toHaveLength(1);
    expect(result.current.revealedExerciseIds).toHaveLength(1);

    // Verify localStorage was written
    const beforeResetRaw = localStorage.getItem("bdd-revision-progress");
    expect(beforeResetRaw).not.toBeNull();
    const beforeReset = JSON.parse(beforeResetRaw as string);
    expect(beforeReset.completedExercises).toEqual(["1.1"]);
    expect(beforeReset.hintedExerciseIds).toEqual(["1.2"]);
    expect(beforeReset.revealedExerciseIds).toEqual(["1.3"]);

    // reset() calls window.location.reload() which isn't mockable in jsdom
    // but it clears localStorage before reloading, so verify that separately
    localStorage.setItem(
      "bdd-revision-progress",
      JSON.stringify({
        completedExercises: [],
        lastExerciseId: null,
        hintedExerciseIds: [],
        revealedExerciseIds: [],
      }),
    );
    localStorage.removeItem("bdd-revision-progress");

    const stored = localStorage.getItem("bdd-revision-progress");
    expect(stored).toBeNull();
  });

  it("loads persisted state from localStorage", () => {
    localStorage.setItem(
      "bdd-revision-progress",
      JSON.stringify({
        completedExercises: ["1.1", "1.2"],
        lastExerciseId: "1.2",
        hintedExerciseIds: ["1.3"],
        revealedExerciseIds: ["2.1.1"],
      }),
    );

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(result.current.completed).toEqual(["1.1", "1.2"]);
    expect(result.current.lastExerciseId).toBe("1.2");
    expect(result.current.hintedExerciseIds).toEqual(["1.3"]);
    expect(result.current.revealedExerciseIds).toEqual(["2.1.1"]);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("bdd-revision-progress", "not-valid-json");

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(result.current.completed).toEqual([]);
    expect(result.current.lastExerciseId).toBeNull();
  });

  it("handles missing fields in localStorage", () => {
    localStorage.setItem("bdd-revision-progress", JSON.stringify({}));

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(result.current.completed).toEqual([]);
    expect(result.current.lastExerciseId).toBeNull();
    expect(result.current.hintedExerciseIds).toEqual([]);
    expect(result.current.revealedExerciseIds).toEqual([]);
  });

  it("filters non-string progress array entries from localStorage", () => {
    localStorage.setItem(
      "bdd-revision-progress",
      JSON.stringify({
        completedExercises: ["1.1", null, 42, {}],
        lastExerciseId: "1.1",
        hintedExerciseIds: [false, "1.2"],
        revealedExerciseIds: ["1.3", []],
      }),
    );

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(result.current.completed).toEqual(["1.1"]);
    expect(result.current.hintedExerciseIds).toEqual(["1.2"]);
    expect(result.current.revealedExerciseIds).toEqual(["1.3"]);
  });

  it("filters invalid completed exercise statuses from localStorage", () => {
    localStorage.setItem(
      "bdd-revision-progress",
      JSON.stringify({
        completedExercises: ["1.1", "1.2"],
        completedExerciseStatuses: {
          "1.1": "success",
          "1.2": "invalid",
          "1.3": null,
        },
      }),
    );

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(result.current.completedExerciseStatuses).toEqual({
      "1.1": "success",
    });
  });

  it("does not throw when localStorage save fails", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(() => {
      act(() => {
        result.current.markComplete("1.1");
      });
    }).not.toThrow();

    expect(result.current.completed).toEqual(["1.1"]);
    expect(warnSpy).toHaveBeenCalledWith(
      "Unable to save progress to localStorage.",
      expect.any(DOMException),
    );
  });
});
