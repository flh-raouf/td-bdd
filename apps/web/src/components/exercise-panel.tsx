import { Eye, Lightbulb } from "lucide-react";
import { useState } from "react";
import { SchemaViewer } from "@/components/schema-viewer";
import { Button } from "@/components/ui/button";

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
        <a
          href="https://github.com/flh-raouf/td-bdd"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-md border border-border bg-white/5 px-2.5 py-1 text-xs font-normal text-muted-foreground no-underline transition-colors hover:bg-white/10 hover:text-yellow-400"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Star on GitHub
        </a>
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
              Hint {Math.min(visibleHints + 1, hints.length)} of {hints.length}
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
        <SchemaViewer onClose={onSchemaModalClose} />
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
