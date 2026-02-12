import { serve } from '@hono/node-server'
import { app } from "./app";

const DEFAULT_PORT = 3002;
const rawPort = process.env.PORT ?? process.env.API_PORT;
const port = rawPort ? Number.parseInt(rawPort, 10) : DEFAULT_PORT;

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid API port: ${rawPort}`);
}

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
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
