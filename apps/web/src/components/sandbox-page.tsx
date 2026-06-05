import { RotateCcw } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { ResultsTable } from "@/components/results-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

const LazySqlEditor = lazy(() =>
  import("@/components/sql-editor").then((m) => ({ default: m.SqlEditor })),
);

const LazySchemaViewer = lazy(() =>
  import("@/components/schema-viewer").then((m) => ({
    default: m.SchemaViewer,
  })),
);

type QueryResultData = {
  columns: string[];
  rows: Record<string, unknown>[];
  affectedRows?: number;
};

export function SandboxPage() {
  const [sql, setSql] = useState("");
  const [runResult, setRunResult] = useState<QueryResultData | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

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

  const reseedMutation = trpc.db.reseed.useMutation({
    onSuccess: () => {
      setRunResult(null);
      setRunError(null);
      setResetError(null);
    },
    onError: (error) => {
      setResetError(error.message);
    },
  });

  const handleRun = () => {
    setRunError(null);
    setResetError(null);
    runMutation.mutate({ sql, allowAlter: false });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">Sandbox</h1>
        <div className="flex items-center gap-2">
          <Suspense
            fallback={
              <Button
                size="sm"
                disabled
                className="border border-border bg-white/5 text-muted-foreground"
              >
                Database Schema
              </Button>
            }
          >
            <LazySchemaViewer />
          </Suspense>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => reseedMutation.mutate()}
            disabled={reseedMutation.isPending}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {reseedMutation.isPending ? "Resetting..." : "Reset Database"}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-auto p-4 space-y-4">
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
            hideSubmit
            value={sql}
            onChange={setSql}
            onSubmit={handleRun}
            onRun={handleRun}
            isSubmitting={false}
            isRunning={runMutation.isPending}
          />
        </Suspense>

        {runError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 font-mono text-sm text-red-400 whitespace-pre-wrap">
            {runError}
          </div>
        )}

        {resetError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-red-400">
            {resetError}
          </div>
        )}

        {runResult && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Output
            </p>
            <ResultsTable {...runResult} />
          </div>
        )}
      </div>
    </div>
  );
}
