import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ResultsTable } from "@/components/results-table";
import { SchemaViewer } from "@/components/schema-viewer";
import { SqlEditor } from "@/components/sql-editor";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

type QueryResultData = {
  columns: string[];
  rows: Record<string, unknown>[];
  affectedRows?: number;
};

export function SandboxPage() {
  const [sql, setSql] = useState("");
  const [runResult, setRunResult] = useState<QueryResultData | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

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
    },
  });

  const handleRun = () => {
    setRunError(null);
    runMutation.mutate({ sql, allowAlter: false });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">Sandbox</h1>
        <div className="flex items-center gap-2">
          <SchemaViewer />
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
        <SqlEditor
          hideSubmit
          value={sql}
          onChange={setSql}
          onSubmit={handleRun}
          onRun={handleRun}
          isSubmitting={false}
          isRunning={runMutation.isPending}
        />

        {runError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 font-mono text-sm text-red-400 whitespace-pre-wrap">
            {runError}
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
