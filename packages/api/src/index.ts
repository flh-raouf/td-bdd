import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { connectRedis } from "./redis";
import { appRouter, createContext, warmStaticCaches } from "./router";

const port = Number(process.env.API_PORT ?? 3001);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

connectRedis().catch((error) => {
  console.warn(
    "Redis connection failed; rate limiting will use in-memory fallback.",
    error,
  );
});

createHTTPServer({
  middleware: (request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", webOrigin);
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    next();
  },
  createContext,
  router: appRouter,
}).listen(port);

console.log(`BDD Revision API listening on http://localhost:${port}`);

if (process.env.WARM_STATIC_CACHES !== "false") {
  warmStaticCaches().catch((error) => {
    console.warn("Static cache warmup failed; will retry lazily.", error);
  });
}
