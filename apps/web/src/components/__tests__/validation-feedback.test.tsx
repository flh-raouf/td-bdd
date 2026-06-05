import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValidationFeedback } from "../validation-feedback";

describe("ValidationFeedback", () => {
  it("shows correct message when passed=true", () => {
    render(<ValidationFeedback passed={true} />);
    expect(screen.getByText("Correct!")).toBeInTheDocument();
  });

  it("shows row count when correct with result", () => {
    render(
      <ValidationFeedback
        passed={true}
        result={{
          columns: ["id"],
          rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        }}
      />,
    );
    expect(screen.getByText(/3 rows/)).toBeInTheDocument();
  });

  it("labels the first matched solution as teacher solution", () => {
    render(<ValidationFeedback passed={true} matchedSolutionIndex={1} />);
    expect(screen.getByText("Matched: Teacher solution")).toBeInTheDocument();
  });

  it("labels later matched solutions as alternatives", () => {
    render(<ValidationFeedback passed={true} matchedSolutionIndex={3} />);
    expect(
      screen.getByText("Matched: Alternative solution 2"),
    ).toBeInTheDocument();
  });

  it("uses singular row when count is 1", () => {
    render(
      <ValidationFeedback
        passed={true}
        result={{ columns: ["id"], rows: [{ id: 1 }] }}
      />,
    );
    expect(screen.getByText(/1 row/)).toBeInTheDocument();
  });

  it("shows incorrect without diff details", () => {
    render(<ValidationFeedback passed={false} />);
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });

  it("shows SQL error", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{ sqlError: "Syntax error near SELECT" }}
      />,
    );
    expect(screen.getByText("Syntax error near SELECT")).toBeInTheDocument();
  });

  it("shows column mismatch", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{
          columnDiff: {
            expected: ["id", "name"],
            actual: ["id"],
            missing: ["name"],
            extra: [],
          },
        }}
      />,
    );
    expect(screen.getByText("Column mismatch")).toBeInTheDocument();
    expect(screen.getByText(/id, name/)).toBeInTheDocument();
    expect(screen.getByText("Missing: name")).toBeInTheDocument();
  });

  it("shows extra columns", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{
          columnDiff: {
            expected: ["id"],
            actual: ["id", "name"],
            missing: [],
            extra: ["name"],
          },
        }}
      />,
    );
    expect(screen.getByText("Extra: name")).toBeInTheDocument();
  });

  it("shows row count mismatch", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{
          rowCountDiff: { expected: 5, actual: 3 },
        }}
      />,
    );
    expect(screen.getByText(/expected 5, got 3/)).toBeInTheDocument();
  });

  it("shows missing rows count", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{
          dataDiff: {
            missingRows: [{ id: 1 }, { id: 2 }],
            extraRows: [],
          },
        }}
      />,
    );
    expect(screen.getByText(/2 expected rows missing/)).toBeInTheDocument();
  });

  it("shows extra rows count", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{
          dataDiff: {
            missingRows: [],
            extraRows: [{ id: 5 }],
          },
        }}
      />,
    );
    expect(screen.getByText(/1 unexpected row returned/)).toBeInTheDocument();
  });

  it("shows all diff details simultaneously", () => {
    render(
      <ValidationFeedback
        passed={false}
        diff={{
          columnDiff: {
            expected: ["id", "name"],
            actual: ["id"],
            missing: ["name"],
            extra: [],
          },
          rowCountDiff: { expected: 3, actual: 2 },
          dataDiff: {
            missingRows: [{ id: 1 }],
            extraRows: [{ id: 9 }],
          },
        }}
      />,
    );
    expect(screen.getByText("Column mismatch")).toBeInTheDocument();
    expect(screen.getByText(/expected 3, got 2/)).toBeInTheDocument();
    expect(screen.getByText(/1 expected row missing/)).toBeInTheDocument();
    expect(screen.getByText(/1 unexpected row returned/)).toBeInTheDocument();
  });
});
