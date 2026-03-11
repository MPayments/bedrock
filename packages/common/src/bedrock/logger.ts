import type { Logger as BedrockLogger } from "@bedrock/core";

import type { Logger } from "../common/logger";

export function adaptBedrockLogger(logger: BedrockLogger): Logger {
  return {
    debug(message, meta) {
      logger.debug(message, meta);
    },
    info(message, meta) {
      logger.info(message, meta);
    },
    warn(message, meta) {
      logger.warn(message, meta);
    },
    error(message, meta) {
      logger.error(message, meta);
    },
    child(meta) {
      return adaptBedrockLogger(logger.child ? logger.child(meta) : logger);
    },
  };
}
