import { Eye, Lightbulb } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";

const LazySchemaViewer = lazy(() =>
  import("@/components/schema-viewer").then((m) => ({
    default: m.SchemaViewer,
  })),
);

type ExercisePanelProps = {
  title: string;
  description: string;
  hints: string[];
  solutionQueries: string[];
  visibleHints: number;
  showSolution: boolean;
  onHintRevealed: () => void;
  onSolutionRevealed: () => void;
  onSchemaModalClose: () => void;
  onVisibleHintsChange: (n: number) => void;
  onShowSolutionChange: (v: boolean) => void;
};

export function ExercisePanel({
  title,
  description,
  hints,
  solutionQueries,
  visibleHints,
  showSolution,
  onHintRevealed,
  onSolutionRevealed,
  onSchemaModalClose,
  onVisibleHintsChange,
  onShowSolutionChange,
}: ExercisePanelProps) {
  const [confirmSolution, setConfirmSolution] = useState(false);

  return (
    <div className="px-4 pt-4 pb-1">
      <h1 className="mb-3 flex items-center justify-between text-xl font-semibold">
        <span className="font-mono">{title}</span>
      </h1>

      <div className="mb-4 flex items-center gap-2" data-tour="help-buttons">
        {hints.length > 0 && (
          <>
            <Button
              size="sm"
              onClick={() => {
                onHintRevealed();
                onVisibleHintsChange(visibleHints + 1);
              }}
              disabled={visibleHints >= hints.length}
              className="border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
            >
              <Lightbulb className="mr-1 h-4 w-4" />
              <span className="hidden lg:inline">
                Hint {Math.min(visibleHints + 1, hints.length)} of{" "}
                {hints.length}
              </span>
              <span className="lg:hidden">Hint</span>
            </Button>

            {!showSolution && (
              <Button
                size="sm"
                onClick={() => setConfirmSolution(true)}
                className="border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                <Eye className="mr-1 h-4 w-4" />
                Solution
              </Button>
            )}
          </>
        )}

        <div className="flex-1" />
        <Suspense
          fallback={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-white/5 px-3 py-1.5 text-sm text-muted-foreground"
              disabled
            >
              Database Schema
            </button>
          }
        >
          <LazySchemaViewer onClose={onSchemaModalClose} />
        </Suspense>
      </div>

      {visibleHints > 0 && (
        <div className="mb-4">
          {hints.slice(0, visibleHints).map((hint, index) => (
            <div
              key={hint}
              className="mb-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-200"
            >
              <span className="mr-1 font-medium text-yellow-400">
                Hint {index + 1}:
              </span>
              {hint}
            </div>
          ))}
        </div>
      )}

      {showSolution && (
        <div className="mb-4">
          {solutionQueries.map((solution, index) => (
            <div key={solution} className="mb-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-300">
                {index === 0
                  ? "Teacher solution"
                  : `Alternative solution ${index}`}
              </div>
              <pre className="rounded-md border border-red-500/30 bg-red-500/5 p-3 font-mono text-sm text-red-200 whitespace-pre-wrap overflow-auto">
                {solution}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div
        className="mb-4 overflow-hidden rounded-lg border border-accent/30 bg-accent/[0.06] shadow-sm"
        data-tour="question"
      >
        <div className="border-b border-accent/20 bg-accent/[0.08] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Question
          </span>
        </div>
        <div className="p-4">
          <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
            {description}
          </p>
        </div>
      </div>

      {confirmSolution && (
        <div>
          <div className="fixed inset-0 z-50 bg-black/60" />
          <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-red-500/40 bg-card p-6 shadow-lg">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-red-400">
              <Eye className="h-5 w-5" />
              Reveal solution?
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure? Try the hints first before looking at the answer.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="default"
                onClick={() => setConfirmSolution(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onSolutionRevealed();
                  onShowSolutionChange(true);
                  setConfirmSolution(false);
                }}
              >
                Reveal solution
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
