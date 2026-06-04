import { Link } from "@tanstack/react-router";
import { CheckCircle2, Database, FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type SidebarProps = {
  completed: string[];
  hintedExerciseIds: string[];
  revealedExerciseIds: string[];
  activeExerciseId?: string;
  onReset: () => void;
};

export function Sidebar({
  completed,
  hintedExerciseIds,
  revealedExerciseIds,
  activeExerciseId,
  onReset,
}: SidebarProps) {
  const { data: groups, isLoading } = trpc.exercises.byPart.useQuery();
  const [showReset, setShowReset] = useState(false);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 font-mono font-semibold text-foreground no-underline"
        >
          <Database className="h-5 w-5 text-accent" />
          BDD Revision
        </Link>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-2 py-2" data-tour="sidebar">
        {isLoading && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Loading exercises...
          </p>
        )}

        {groups?.map((group) => (
          <div key={group.part} className="mb-2">
            <Badge variant="accent" className="mb-1 ml-2 text-xs">
              {group.part}
            </Badge>
            <div className="space-y-0.5">
              {group.exercises.map((exercise) => {
                const isActive = exercise.id === activeExerciseId;
                const isCompleted = completed.includes(exercise.id);
                const isRevealed = revealedExerciseIds.includes(exercise.id);
                const isHinted = hintedExerciseIds.includes(exercise.id);
                const checkColor = isRevealed
                  ? "text-destructive"
                  : isHinted
                    ? "text-yellow-400"
                    : isCompleted
                      ? "text-success"
                      : "text-muted-foreground";

                return (
                  <Link
                    key={exercise.id}
                    to="/exercise/$exerciseId"
                    params={{ exerciseId: exercise.id }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors no-underline",
                      isActive
                        ? "bg-sidebar-active text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground",
                    )}
                  >
                    <CheckCircle2
                      className={cn("h-4 w-4 shrink-0", checkColor)}
                    />
                    <span className="truncate">{exercise.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {!isLoading && groups?.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No exercises found.
          </p>
        )}
      </ScrollArea>

      <Separator />

      <div className="px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>
            {completed.length} /{" "}
            {groups?.reduce((sum, g) => sum + g.exercises.length, 0) ?? 0}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sidebar-active">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{
              width: `${
                groups
                  ? (
                      completed.length /
                        Math.max(
                          groups.reduce(
                            (sum, g) => sum + g.exercises.length,
                            0,
                          ),
                          1,
                        )
                    ) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      <div className="px-2 py-2 space-y-1">
        <Link
          to="/sandbox"
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-sidebar-hover hover:text-foreground"
          data-tour="sandbox"
        >
          <FlaskConical className="h-4 w-4" />
          Sandbox
        </Link>
        <a
          href="https://github.com/flh-raouf/td-bdd"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-sidebar-hover hover:text-yellow-400"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Star on GitHub
        </a>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setShowReset(true)}
        >
          <RotateCcw className="h-4 w-4" />
          Reset progress
        </Button>
      </div>

      {showReset && (
        <div>
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset progress?</DialogTitle>
              <DialogDescription>
                This will clear all completed exercise marks. You can redo any
                exercise at any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="default" onClick={() => setShowReset(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onReset();
                  setShowReset(false);
                }}
              >
                Reset
              </Button>
            </DialogFooter>
          </DialogContent>
        </div>
      )}
    </aside>
  );
}
