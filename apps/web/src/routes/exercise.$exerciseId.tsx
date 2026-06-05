import { createRoute } from "@tanstack/react-router";
import { ExerciseWorkspace } from "@/components/exercise-workspace";
import { RouteError } from "@/components/route-error";
import { appLayoutRoute } from "./_layout";

export const exerciseRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/exercise/$exerciseId",
  component: ExercisePage,
  errorComponent: (props) => (
    <RouteError
      {...props}
      fullScreen={false}
      title="Exercise workspace crashed"
      description="The editor or exercise panel hit a problem. Reload or return home to recover."
    />
  ),
});

export function ExercisePage() {
  const { exerciseId } = exerciseRoute.useParams();

  return <ExerciseWorkspace key={exerciseId} exerciseId={exerciseId} />;
}
