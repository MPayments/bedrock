import { sql } from "drizzle-orm";

import type { Database, Transaction } from "./client";

interface PgNotifyConnection {
  execute?: (
    query: Parameters<Database["execute"]>[0],
  ) => ReturnType<Database["execute"]>;
}
const CHANNEL_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertChannelName(channel: string): string {
  if (!CHANNEL_NAME_RE.test(channel)) {
    throw new Error(`Invalid PG channel name: ${channel}`);
  }
  return channel;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Send a PG NOTIFY inside an existing transaction (or bare database connection).
 * Because NOTIFY is transactional in Postgres, the notification is only
 * delivered once the enclosing transaction commits.
 */
export function pgNotify(
  conn: PgNotifyConnection,
  channel: string,
  payload: string,
): Promise<unknown> {
  const safeChannel = assertChannelName(channel);
  if (typeof conn.execute !== "function") {
    return Promise.resolve(undefined);
  }
  return conn.execute(sql`SELECT pg_notify(${safeChannel}, ${payload})`);
}

/** Callback for a LISTEN subscription. */
export type PgSubscriptionHandler = (payload: string) => void;

interface ListenClient {
  query: (text: string) => Promise<unknown>;
  on: (
    event: "notification",
    listener: (message: { channel: string; payload?: string | null }) => void,
  ) => void;
  removeAllListeners?: (event: "notification") => void;
  release: () => void;
}

interface PgSubscriberConnection {
  $client?: {
    connect?: () => Promise<ListenClient>;
  };
}

/**
 * Manage PG LISTEN subscriptions on a dedicated pool connection.
 *
 * Usage:
 *   const sub = createPgSubscriber(db);
 *   await sub.subscribe("document_changed", (payload) => { ... });
 *   // later:
 *   await sub.close();
 */
export interface PgSubscriber {
  subscribe(channel: string, handler: PgSubscriptionHandler): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  close(): Promise<void>;
}

export async function createPgSubscriber(db: unknown): Promise<PgSubscriber> {
  const pool = (db as PgSubscriberConnection).$client;
  if (!pool?.connect) {
    throw new Error("Database pool does not support LISTEN subscriptions");
  }

  const client = await pool.connect();
  const handlers = new Map<string, Set<PgSubscriptionHandler>>();

  client.on(
    "notification",
    (message: { channel: string; payload?: string | null }) => {
      const channelHandlers = handlers.get(message.channel);
      if (!channelHandlers) return;
      const payload = message.payload ?? "";
      for (const handler of channelHandlers) {
        try {
          handler(payload);
        } catch {
          // handlers must not throw — swallow
        }
      }
    },
  );

  return {
    async subscribe(channel, handler) {
      const safeChannel = assertChannelName(channel);
      let set = handlers.get(safeChannel);
      if (!set) {
        set = new Set();
        handlers.set(safeChannel, set);
        await client.query(`LISTEN ${quoteIdentifier(safeChannel)}`);
      }
      set.add(handler);
    },

    async unsubscribe(channel) {
      const safeChannel = assertChannelName(channel);
      handlers.delete(safeChannel);
      try {
        await client.query(`UNLISTEN ${quoteIdentifier(safeChannel)}`);
      } catch {
        // ignore unlisten errors on closed connections
      }
    },

    async close() {
      for (const channel of handlers.keys()) {
        try {
          await client.query(`UNLISTEN ${quoteIdentifier(channel)}`);
        } catch {
          // ignore
        }
      }
      handlers.clear();
      try {
        client.removeAllListeners?.("notification");
        client.release();
      } catch {
        // ignore close errors
      }
    },
  };
}
