import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExercisePanel } from "../exercise-panel";

describe("ExercisePanel", () => {
  const defaultProps = {
    title: "Test Exercise",
    description: "Write a SELECT query.",
    hints: ["Hint one", "Hint two"],
    solutionQueries: ["SELECT * FROM t"],
    visibleHints: 0,
    showSolution: false,
    onHintRevealed: vi.fn(),
    onSolutionRevealed: vi.fn(),
    onSchemaModalClose: vi.fn(),
    onVisibleHintsChange: vi.fn(),
    onShowSolutionChange: vi.fn(),
  };

  it("renders title and description", () => {
    render(<ExercisePanel {...defaultProps} />);
    expect(screen.getByText("Test Exercise")).toBeInTheDocument();
    expect(screen.getByText("Write a SELECT query.")).toBeInTheDocument();
  });

  it("shows 'Hint 1 of 2' button when hints exist", () => {
    render(<ExercisePanel {...defaultProps} />);
    expect(screen.getByText("Hint 1 of 2")).toBeInTheDocument();
  });

  it("does not show hint button when no hints", () => {
    render(<ExercisePanel {...defaultProps} hints={[]} />);
    expect(screen.queryByText(/Hint/)).not.toBeInTheDocument();
  });

  it("reveals first hint on click and calls callback", () => {
    const onHintRevealed = vi.fn();
    render(<ExercisePanel {...defaultProps} onHintRevealed={onHintRevealed} />);

    fireEvent.click(screen.getByText("Hint 1 of 2"));
    expect(screen.getByText(/Hint one/)).toBeInTheDocument();
    expect(onHintRevealed).toHaveBeenCalledTimes(1);
  });

  it("reveals second hint on second click", () => {
    render(<ExercisePanel {...defaultProps} />);

    fireEvent.click(screen.getByText("Hint 1 of 2"));
    fireEvent.click(screen.getByText("Hint 2 of 2"));

    expect(screen.getByText(/Hint one/)).toBeInTheDocument();
    expect(screen.getByText(/Hint two/)).toBeInTheDocument();
  });

  it("disables hint button when all hints revealed", () => {
    render(<ExercisePanel {...defaultProps} hints={["Only hint"]} />);

    const hintButton = screen.getByRole("button", { name: /Hint/ });
    fireEvent.click(hintButton);
    expect(hintButton).toBeDisabled();
  });

  it("shows solution button initially and hides after reveal", () => {
    render(<ExercisePanel {...defaultProps} />);

    expect(screen.getByText("Solution")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Solution"));
    // Confirmation dialog appears
    expect(screen.getByText("Reveal solution?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reveal solution"));

    // Solution button disappears after reveal
    expect(screen.queryByText("Solution")).not.toBeInTheDocument();
  });

  it("shows confirmation dialog and can cancel", () => {
    render(<ExercisePanel {...defaultProps} />);

    fireEvent.click(screen.getByText("Solution"));
    expect(screen.getByText("Reveal solution?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Reveal solution?")).not.toBeInTheDocument();
  });

  it("reveals solution queries after confirmation", () => {
    const onSolutionRevealed = vi.fn();
    render(
      <ExercisePanel
        {...defaultProps}
        onSolutionRevealed={onSolutionRevealed}
      />,
    );

    fireEvent.click(screen.getByText("Solution"));
    fireEvent.click(screen.getByText("Reveal solution"));

    expect(screen.getByText("SELECT * FROM t")).toBeInTheDocument();
    expect(onSolutionRevealed).toHaveBeenCalledTimes(1);
  });

  it("renders multiple solution queries", () => {
    render(
      <ExercisePanel
        {...defaultProps}
        solutionQueries={["SELECT 1", "SELECT 2"]}
      />,
    );

    fireEvent.click(screen.getByText("Solution"));
    fireEvent.click(screen.getByText("Reveal solution"));

    expect(screen.getByText("SELECT 1")).toBeInTheDocument();
    expect(screen.getByText("SELECT 2")).toBeInTheDocument();
  });

  it("renders SchemaViewer with onClose callback", () => {
    render(<ExercisePanel {...defaultProps} />);
    expect(screen.getByText("Database Schema")).toBeInTheDocument();
  });

  it("does not show hint/solution buttons when both are empty", () => {
    render(<ExercisePanel {...defaultProps} hints={[]} solutionQueries={[]} />);
    expect(screen.queryByText(/Hint/)).not.toBeInTheDocument();
    expect(screen.queryByText("Solution")).not.toBeInTheDocument();
  });
});
