import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router";

const port = Number(process.env.API_PORT ?? 3001);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

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
  router: appRouter,
}).listen(port);

console.log(`BDD Revision API listening on http://localhost:${port}`);
