import { Outlet, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "@/components/sidebar";
import { useProgress } from "@/hooks/use-progress";

export function AppShell() {
  const {
    completed,
    completedExerciseStatuses,
    hintedExerciseIds,
    revealedExerciseIds,
    reset: resetProgress,
  } = useProgress();

  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const exerciseMatch = currentPath.match(/\/exercise\/(.+)/);
  const activeExerciseId = exerciseMatch ? exerciseMatch[1] : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        completed={completed}
        completedExerciseStatuses={completedExerciseStatuses}
        hintedExerciseIds={hintedExerciseIds}
        revealedExerciseIds={revealedExerciseIds}
        activeExerciseId={activeExerciseId}
        onReset={resetProgress}
      />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
