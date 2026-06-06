import { Link } from "@tanstack/react-router";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Trophy,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ExercisePanel } from "@/components/exercise-panel";
import { ErrorState, LoadingState } from "@/components/query-state";
import { ResultsTable } from "@/components/results-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ValidationFeedback } from "@/components/validation-feedback";
import { useExerciseState } from "@/hooks/use-exercise-state";
import type { CompletedExerciseStatus } from "@/hooks/use-progress";
import { useProgress } from "@/hooks/use-progress";
import { fireCannonConfetti, fireConfetti } from "@/lib/confetti";
import { trpc } from "@/lib/trpc";
import type { ResultDiff } from "@/lib/validation";

const LazySqlEditor = lazy(() =>
  import("@/components/sql-editor").then((m) => ({ default: m.SqlEditor })),
);

type QueryResultData = {
  columns: string[];
  rows: Record<string, unknown>[];
  affectedRows?: number;
};

function getSolutionLabel(index: number) {
  return index === 0 ? "Teacher solution" : `Alternative solution ${index}`;
}

export function ExerciseWorkspace({ exerciseId }: { exerciseId: string }) {
  const {
    data: exercise,
    error,
    isError,
    isLoading,
  } = trpc.exercises.get.useQuery(exerciseId);
  const {
    completed,
    markComplete,
    markHintUsed,
    markSolutionRevealed,
    hintedExerciseIds,
    revealedExerciseIds,
  } = useProgress();
  const { getState, saveState } = useExerciseState();

  const savedState = getState(exerciseId);

  const [sql, setSql] = useState(savedState.sql);
  const [visibleHints, setVisibleHints] = useState(savedState.visibleHints);
  const [showSolution, setShowSolution] = useState(savedState.showSolution);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [runResult, setRunResult] = useState<QueryResultData | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [ddlJobId, setDdlJobId] = useState<string | null>(null);
  const lastProcessedResultRef = useRef<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    passed: boolean;
    diff?: ResultDiff;
    result?: QueryResultData;
    matchedSolutionIndex?: number;
    verificationLabel?: string;
  } | null>(null);

  const exerciseEventMutation = trpc.analytics.exerciseEvent.useMutation();

  const ddlJobStatusQuery = trpc.validation.jobStatus.useQuery(ddlJobId ?? "", {
    enabled: !!ddlJobId,
    refetchInterval: 1000,
    staleTime: 0,
  });

  const ddlJob = ddlJobStatusQuery.data;
  const ddlStatus = ddlJob?.status;
  const isDdlPending = ddlStatus === "pending" || ddlStatus === "running";
  const isSubmitted =
    validationResult?.passed ?? completed.includes(exerciseId);

  useEffect(() => {
    if (!ddlJob) return;
    const resultKey = `${ddlJob.id}:${ddlJob.status}`;
    if (lastProcessedResultRef.current === resultKey) return;
    lastProcessedResultRef.current = resultKey;

    if (ddlJob.status === "completed" && ddlJob.result) {
      setValidationResult(ddlJob.result);
      if (ddlJob.result.passed) {
        const st: CompletedExerciseStatus = revealedExerciseIds.includes(
          exerciseId,
        )
          ? "revealed"
          : hintedExerciseIds.includes(exerciseId)
            ? "hinted"
            : "success";
        markComplete(exerciseId, st);
        if (exercise?.nextExerciseId === null) {
          setShowCompletionModal(true);
          fireCannonConfetti();
        } else {
          setShowSuccessModal(true);
          fireConfetti();
        }
      }
    } else if (ddlJob.status === "failed" || ddlJob.status === "timeout") {
      setValidationResult({
        passed: false,
        diff: { sqlError: ddlJob.error ?? "Validation did not complete." },
      });
    }
  }, [
    ddlJob,
    exerciseId,
    exercise?.nextExerciseId,
    revealedExerciseIds,
    hintedExerciseIds,
    markComplete,
  ]);

  const runMutation = trpc.query.execute.useMutation({
    onSuccess: (data) => {
      setRunResult(data as QueryResultData);
      setRunError(null);
    },
    onError: (error) => {
      setRunError(error.message);
      setRunResult(null);
    },
  });

  const submitMutation = trpc.validation.submit.useMutation({
    onSuccess: (data) => {
      if ("status" in data && data.status === "pending") {
        setDdlJobId((data as unknown as { jobId: string }).jobId);
        setValidationResult(null);
        lastProcessedResultRef.current = null;
        return;
      }

      setDdlJobId(null);
      setValidationResult(data);
      if (data.passed) {
        const status: CompletedExerciseStatus = revealedExerciseIds.includes(
          exerciseId,
        )
          ? "revealed"
          : hintedExerciseIds.includes(exerciseId)
            ? "hinted"
            : "success";
        markComplete(exerciseId, status);
        if (exercise?.nextExerciseId === null) {
          setShowCompletionModal(true);
          fireCannonConfetti();
        } else {
          setShowSuccessModal(true);
          fireConfetti();
        }
      }
    },
    onError: (error) => {
      setDdlJobId(null);
      setValidationResult({ passed: false, diff: { sqlError: error.message } });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading exercise..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState title="Exercise failed to load" error={error} />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Exercise not found.</p>
      </div>
    );
  }

  const handleSubmit = () => {
    setValidationResult(null);
    setDdlJobId(null);
    submitMutation.mutate({ exerciseId, userSql: sql });
  };

  const handleRun = () => {
    setValidationResult(null);
    setRunError(null);
    runMutation.mutate({ sql });
  };

  const handleSqlChange = (value: string) => {
    setSql(value);
    saveState(exerciseId, { sql: value, visibleHints, showSolution });
  };

  const handleVisibleHintsChange = (value: number) => {
    setVisibleHints(value);
    saveState(exerciseId, { sql, visibleHints: value, showSolution });
  };

  const handleShowSolutionChange = (value: boolean) => {
    setShowSolution(value);
    saveState(exerciseId, { sql, visibleHints, showSolution: value });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto px-4 pt-0 pb-4 space-y-4">
        <ExercisePanel
          title={exercise.title}
          description={exercise.description}
          hints={exercise.hints}
          solutionQueries={exercise.solutionQueries}
          visibleHints={visibleHints}
          showSolution={showSolution}
          onHintRevealed={() => {
            markHintUsed(exerciseId);
            exerciseEventMutation.mutate({ exerciseId, event: "hint" });
          }}
          onSolutionRevealed={() => {
            markSolutionRevealed(exerciseId);
            exerciseEventMutation.mutate({ exerciseId, event: "solution" });
          }}
          onVisibleHintsChange={handleVisibleHintsChange}
          onShowSolutionChange={handleShowSolutionChange}
          onSchemaModalClose={() => {
            setTimeout(() => editorRef.current?.view?.focus(), 0);
          }}
        />

        <Separator />

        <Suspense
          fallback={
            <div className="rounded-md border border-border h-[240px] flex items-center justify-center bg-sidebar/30">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Loading editor...
              </div>
            </div>
          }
        >
          <LazySqlEditor
            ref={editorRef}
            data-tour="editor"
            hideRun={exercise.type === "ddl"}
            value={sql}
            onChange={handleSqlChange}
            onSubmit={handleSubmit}
            onRun={handleRun}
            isSubmitting={submitMutation.isPending || isDdlPending}
            isRunning={runMutation.isPending}
          />
        </Suspense>

        <div data-tour="results">
          {runError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 font-mono text-sm text-red-400 whitespace-pre-wrap">
              {runError}
            </div>
          )}

          {runResult && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Run output
              </p>
              <ResultsTable {...runResult} />
            </div>
          )}

          {isDdlPending && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Submission result
              </p>
              <ValidationFeedback
                passed={false}
                status={ddlStatus}
                jobId={ddlJob?.id}
              />
            </div>
          )}

          {ddlJobStatusQuery.isError && ddlJobId && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Submission result
              </p>
              <ValidationFeedback
                passed={false}
                status="failed"
                error="Lost connection while checking job status."
                onRetry={() => ddlJobStatusQuery.refetch()}
              />
            </div>
          )}

          {validationResult && !isDdlPending && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Submission result
              </p>
              <ValidationFeedback {...validationResult} />
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          asChild
          disabled={!exercise.previousExerciseId}
        >
          <Link
            to="/exercise/$exerciseId"
            params={{ exerciseId: exercise.previousExerciseId ?? exerciseId }}
            className="gap-1 no-underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        </Button>

        <span className="text-xs text-muted-foreground">
          {exercise.id} {isSubmitted ? "- Completed" : ""}
        </span>

        <Button
          variant="ghost"
          size="sm"
          asChild
          disabled={!exercise.nextExerciseId}
        >
          <Link
            to="/exercise/$exerciseId"
            params={{ exerciseId: exercise.nextExerciseId ?? exerciseId }}
            className="gap-1 no-underline"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {showSuccessModal && (
        <div>
          <button
            type="button"
            className="fixed inset-0 z-50 cursor-default border-none bg-black/60 p-0"
            onClick={() => setShowSuccessModal(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowSuccessModal(false);
            }}
            aria-label="Close"
          />
          <div className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-full max-w-xl translate-x-[-50%] translate-y-[-50%] overflow-auto rounded-lg border border-success/40 bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-lg font-semibold text-success">Correct!</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSuccessModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Great work! Here are the accepted solutions:
            </p>

            <div className="mb-4">
              {exercise.solutionQueries.map((solution, index) => (
                <div key={solution} className="mb-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-success">
                    {getSolutionLabel(index)}
                  </div>
                  <pre className="rounded-md border border-border bg-sidebar p-3 font-mono text-sm text-foreground whitespace-pre-wrap overflow-auto">
                    {solution}
                  </pre>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                disabled={!exercise.previousExerciseId}
                onClick={() => setShowSuccessModal(false)}
              >
                <Link
                  to="/exercise/$exerciseId"
                  params={{
                    exerciseId: exercise.previousExerciseId ?? exerciseId,
                  }}
                  className="gap-1 no-underline"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                asChild
                disabled={!exercise.nextExerciseId}
                onClick={() => setShowSuccessModal(false)}
              >
                <Link
                  to="/exercise/$exerciseId"
                  params={{ exerciseId: exercise.nextExerciseId ?? exerciseId }}
                  className="gap-1 no-underline"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCompletionModal && (
        <div>
          <button
            type="button"
            className="fixed inset-0 z-50 cursor-default border-none bg-black/60 p-0"
            onClick={() => setShowCompletionModal(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowCompletionModal(false);
            }}
            aria-label="Close"
          />
          <div className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] overflow-auto rounded-lg border border-border bg-card p-8 shadow-lg text-center">
            <Trophy className="mx-auto mb-4 h-12 w-12 text-yellow-400" />
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Congratulations!
            </h2>
            <p className="mb-2 text-muted-foreground">
              You&apos;ve completed all {exercise?.order ?? ""} exercises!
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              If this helped you, please consider starring the repository on
              GitHub. It means a lot!
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://github.com/flh-raouf/td-bdd"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-5 text-sm font-medium text-yellow-400 no-underline transition-colors hover:bg-yellow-500/20"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>GitHub</title>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Star us on GitHub
              </a>
              <Button
                variant="ghost"
                onClick={() => setShowCompletionModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
