import { createRoute } from "@tanstack/react-router";
import { ExerciseWorkspace } from "@/components/exercise-workspace";
import { appLayoutRoute } from "./_layout";

export const exerciseRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/exercise/$exerciseId",
  component: ExercisePage,
});

export function ExercisePage() {
  const { exerciseId } = exerciseRoute.useParams();

  return <ExerciseWorkspace exerciseId={exerciseId} />;
}
