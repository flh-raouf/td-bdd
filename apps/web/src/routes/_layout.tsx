import { createRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { rootRoute } from "./__root";

export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  component: AppShell,
});
