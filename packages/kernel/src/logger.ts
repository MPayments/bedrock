import pino from "pino";

/**
 * Logger interface - all packages depend on this abstraction.
 */
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Creates a pino-based logger.
 * Uses pino-pretty in development for readable output.
 */
export function createConsoleLogger(base?: Record<string, unknown>): Logger {
  const pinoLogger = pino({
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    ...(base && { base }),
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  });

  return wrapPinoLogger(pinoLogger);
}

function wrapPinoLogger(pinoLogger: pino.Logger): Logger {
  return {
    info(msg: string, meta?: Record<string, unknown>) {
      meta ? pinoLogger.info(meta, msg) : pinoLogger.info(msg);
    },
    warn(msg: string, meta?: Record<string, unknown>) {
      meta ? pinoLogger.warn(meta, msg) : pinoLogger.warn(msg);
    },
    error(msg: string, meta?: Record<string, unknown>) {
      meta ? pinoLogger.error(meta, msg) : pinoLogger.error(msg);
    },
    debug(msg: string, meta?: Record<string, unknown>) {
      meta ? pinoLogger.debug(meta, msg) : pinoLogger.debug(msg);
    },
    child(meta: Record<string, unknown>): Logger {
      return wrapPinoLogger(pinoLogger.child(meta));
    },
  };
}

/**
 * Silent logger for use as default when no logger is provided.
 * Useful for tests and cases where logging is not needed.
 */
export const noopLogger: Logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return noopLogger;
  },
};
