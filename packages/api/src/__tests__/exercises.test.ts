import { describe, expect, it } from "vitest";
import {
  exercises,
  getExercise,
  getExerciseSummaries,
  getExercisesByPart,
  getNextExerciseId,
  getPreviousExerciseId,
} from "../exercises";

describe("getExercise", () => {
  it("returns exercise by valid id", () => {
    const ex = getExercise("1.1");
    expect(ex).not.toBeNull();
    expect(ex?.title).toBe("Create CUSTOMER table");
  });

  it("returns null for invalid id", () => {
    expect(getExercise("999.999")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getExercise("")).toBeNull();
  });

  it("can retrieve all 25 exercises", () => {
    const ids = [
      "1.1",
      "1.2",
      "1.3",
      "1.4",
      "1.5",
      "1.6",
      "1.7",
      "1.8",
      "2.1.1",
      "2.1.2",
      "2.1.3",
      "2.1.4",
      "2.1.5",
      "2.2.1",
      "2.2.2",
      "2.2.3",
      "2.2.4",
      "2.3.1",
      "2.3.2",
      "2.3.3",
      "2.3.4",
      "2.3.5",
      "2.4.1",
      "2.4.2",
      "2.4.3",
    ];
    for (const id of ids) {
      expect(getExercise(id)).not.toBeNull();
    }
    expect(exercises).toHaveLength(25);
  });
});

describe("getExerciseSummaries", () => {
  it("returns summaries for all exercises", () => {
    const summaries = getExerciseSummaries();
    expect(summaries).toHaveLength(25);
  });

  it("reuses the cached summary collection", () => {
    expect(getExerciseSummaries()).toBe(getExerciseSummaries());
  });

  it("each summary has required fields", () => {
    for (const s of getExerciseSummaries()) {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("part");
      expect(s).toHaveProperty("order");
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("type");
    }
  });
});

describe("getExercisesByPart", () => {
  it("groups exercises by part", () => {
    const groups = getExercisesByPart();
    const partNames = groups.map((g) => g.part);
    expect(partNames).toContain("Exercise 1 - Database Creation Script");
    expect(partNames).toContain("Exercise 2 - Part 1");
    expect(partNames).toContain("Exercise 2 - Part 2");
    expect(partNames).toContain("Exercise 2 - Part 3");
    expect(partNames).toContain("Exercise 2 - Part 4");
  });

  it("sorts exercises within groups by order", () => {
    for (const group of getExercisesByPart()) {
      const orders = group.exercises.map((e) => e.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it("reuses the cached grouped collection", () => {
    expect(getExercisesByPart()).toBe(getExercisesByPart());
  });

  it("Exercise 1 has 8 exercises", () => {
    const groups = getExercisesByPart();
    const ex1 = groups.find(
      (g) => g.part === "Exercise 1 - Database Creation Script",
    );
    expect(ex1?.exercises).toHaveLength(8);
  });
});

describe("getNextExerciseId / getPreviousExerciseId", () => {
  it("getNextExerciseId returns next id", () => {
    expect(getNextExerciseId("1.1")).toBe("1.2");
    expect(getNextExerciseId("1.8")).toBe("2.1.1");
  });

  it("getNextExerciseId returns null for last exercise", () => {
    expect(getNextExerciseId("2.4.3")).toBeNull();
  });

  it("getNextExerciseId returns null for invalid id", () => {
    expect(getNextExerciseId("nonexistent")).toBeNull();
  });

  it("getPreviousExerciseId returns previous id", () => {
    expect(getPreviousExerciseId("1.2")).toBe("1.1");
    expect(getPreviousExerciseId("2.1.1")).toBe("1.8");
  });

  it("getPreviousExerciseId returns null for first exercise", () => {
    expect(getPreviousExerciseId("1.1")).toBeNull();
  });

  it("getPreviousExerciseId returns null for invalid id", () => {
    expect(getPreviousExerciseId("nonexistent")).toBeNull();
  });
});

describe("exercise data integrity", () => {
  it("all exercises have valid types", () => {
    for (const ex of exercises) {
      expect(["ddl", "dql", "dml"]).toContain(ex.type);
    }
  });

  it("all exercises have non-empty solution queries", () => {
    for (const ex of exercises) {
      expect(ex.solutionQueries.length).toBeGreaterThan(0);
    }
  });

  it("DDL exercises have verification queries", () => {
    for (const ex of exercises) {
      if (ex.type === "ddl") {
        expect(ex.verificationQueries).toBeDefined();
        expect(ex.verificationQueries?.length).toBeGreaterThan(0);
      }
    }
  });

  it("Exercise 1 DDLs have table creation SQL", () => {
    const ddlExercises = exercises.filter((e) => e.id.startsWith("1."));
    for (const ex of ddlExercises) {
      expect(ex.type).toBe("ddl");
      expect(ex.solutionQueries[0]).toContain("CREATE TABLE");
    }
  });

  it("no duplicate exercise ids", () => {
    const ids = exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
