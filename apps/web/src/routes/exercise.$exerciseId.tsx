import { createRoute } from "@tanstack/react-router";
import { appLayoutRoute } from "./_layout";

export const exerciseRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/exercise/$exerciseId",
  component: ExercisePage,
});

function ExercisePage() {
  const { exerciseId } = exerciseRoute.useParams();

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold">Exercise {exerciseId}</h2>
        <p className="text-muted-foreground">
          Exercise workspace will be implemented in F2.
        </p>
      </div>
    </div>
  );
}
