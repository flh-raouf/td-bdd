// Auto-generated route tree.
// Do not modify manually.

import { rootRoute } from "./routes/__root";
import { appLayoutRoute } from "./routes/_layout";
import { exerciseRoute } from "./routes/exercise.$exerciseId";
import { indexRoute } from "./routes/index";
import { sandboxRoute } from "./routes/sandbox";

export const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([indexRoute, exerciseRoute, sandboxRoute]),
]);
