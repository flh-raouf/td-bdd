import { createRoute } from "@tanstack/react-router";
import { appLayoutRoute } from "./_layout";

export const sandboxRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/sandbox",
  component: SandboxPage,
});

function SandboxPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold">Sandbox</h2>
        <p className="text-muted-foreground">
          Free-form SQL editor will be implemented in F3.
        </p>
      </div>
    </div>
  );
}
