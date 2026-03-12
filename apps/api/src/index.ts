import { serve } from "@hono/node-server";

import "./load-env";
import { app } from "./app";


const port = Number(process.env.PORT);

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`api listening on http://localhost:${info.port}`);
  }
);

// graceful shutdown
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
