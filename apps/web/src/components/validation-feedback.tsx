import type { ResultDiff } from "@/lib/validation";

type ValidationFeedbackProps = {
  passed: boolean;
  matchedSolutionIndex?: number;
  result?: { columns: string[]; rows: Record<string, unknown>[] };
  diff?: ResultDiff;
};

function getSolutionLabel(solutionIndex?: number) {
  if (!solutionIndex || solutionIndex <= 1) return "Teacher solution";
  return `Alternative solution ${solutionIndex - 1}`;
}

export function ValidationFeedback({
  passed,
  matchedSolutionIndex,
  result,
  diff,
}: ValidationFeedbackProps) {
  if (passed) {
    const solutionLabel = getSolutionLabel(matchedSolutionIndex);

    return (
      <div className="rounded-md border border-success/50 bg-success/10 p-4">
        <h3 className="font-semibold text-success">Correct!</h3>
        <p className="mt-1 text-sm font-medium text-foreground">
          Matched: {solutionLabel}
        </p>
        {result && (
          <p className="mt-1 text-sm text-muted-foreground">
            Your query returned {result.rows.length} row
            {result.rows.length !== 1 ? "s" : ""} matching the expected output.
          </p>
        )}
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <h3 className="font-semibold text-destructive">Incorrect</h3>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
      <h3 className="mb-2 font-semibold text-destructive">Incorrect</h3>

      {diff.sqlError && (
        <div className="mb-3 rounded bg-card p-3 font-mono text-sm text-red-400 whitespace-pre-wrap">
          {diff.sqlError}
        </div>
      )}

      {diff.columnDiff && (
        <div className="mb-3">
          <p className="mb-1 text-sm font-medium">Column mismatch</p>
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              Expected:{" "}
              <span className="text-foreground">
                {diff.columnDiff.expected.join(", ")}
              </span>
            </span>
            <span className="text-muted-foreground">
              Got:{" "}
              <span className="text-foreground">
                {diff.columnDiff.actual.join(", ")}
              </span>
            </span>
          </div>
          {diff.columnDiff.missing.length > 0 && (
            <p className="text-xs text-red-400">
              Missing: {diff.columnDiff.missing.join(", ")}
            </p>
          )}
          {diff.columnDiff.extra.length > 0 && (
            <p className="text-xs text-red-400">
              Extra: {diff.columnDiff.extra.join(", ")}
            </p>
          )}
        </div>
      )}

      {diff.rowCountDiff && (
        <p className="mb-3 text-sm">
          Row count mismatch: expected {diff.rowCountDiff.expected}, got{" "}
          {diff.rowCountDiff.actual}
        </p>
      )}

      {diff.dataDiff && (
        <div className="text-xs">
          {diff.dataDiff.missingRows.length > 0 && (
            <p className="text-red-400">
              {diff.dataDiff.missingRows.length} expected row
              {diff.dataDiff.missingRows.length !== 1 ? "s" : ""} missing
            </p>
          )}
          {diff.dataDiff.extraRows.length > 0 && (
            <p className="text-red-400">
              {diff.dataDiff.extraRows.length} unexpected row
              {diff.dataDiff.extraRows.length !== 1 ? "s" : ""} returned
            </p>
          )}
        </div>
      )}
    </div>
  );
}
