import type { createDrizzlePartiesReadRuntime } from "@bedrock/parties/adapters/drizzle";

export {
  createDrizzlePartiesModule as createApiPartiesModule,
  createDrizzlePartiesReadRuntime as createApiPartiesReadRuntime,
} from "@bedrock/parties/adapters/drizzle";

export type ApiPartiesReadRuntime = ReturnType<
  typeof createDrizzlePartiesReadRuntime
>;
