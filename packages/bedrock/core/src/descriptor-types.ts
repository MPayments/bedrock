import type { Simplify } from "@bedrock/common";

import type { Logger } from "./logging";

export type ReservedLoggerDepGuard = {
  logger?: never;
};

export type ReservedLoggerContextGuard = {
  logger?: never;
};

export type WithAmbientLogger<TCtx> = Simplify<
  (TCtx extends undefined ? {} : TCtx) & {
    logger: Logger;
  }
>;
