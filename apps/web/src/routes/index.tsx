import { createRoute, Navigate } from "@tanstack/react-router";
import { appLayoutRoute } from "./_layout";

function IndexComponent() {
  return <Navigate to="/exercise/$exerciseId" params={{ exerciseId: "1.1" }} />;
}

export const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: IndexComponent,
});
