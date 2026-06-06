import { createRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin-page";
import { rootRoute } from "./__root";

export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});
