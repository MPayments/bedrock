import {
  LoggerToken,
  defineProvider,
  type LogLevel,
  type Logger,
  type Provider,
  type Token,
} from "@bedrock/core";
import pino, { type LoggerOptions as NativePinoLoggerOptions } from "pino";

export type PinoLoggerOptions = {
  level?: LogLevel;
  name?: string;
  baseFields?: Record<string, unknown>;
  pinoOptions?: NativePinoLoggerOptions;
};

type PinoLikeLogger = {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  child(bindings: Record<string, unknown>): PinoLikeLogger;
};

export function createPinoLogger(options: PinoLoggerOptions = {}): Logger {
  const instance = pino({
    ...(options.pinoOptions ?? {}),
    level: options.level ?? options.pinoOptions?.level ?? "info",
    name: options.name ?? options.pinoOptions?.name,
    base: {
      ...(options.pinoOptions?.base ?? {}),
      ...(options.baseFields ?? {}),
    },
  });

  return wrapPinoLogger(instance);
}

export function createPinoLoggerProvider(options: {
  provide?: Token<Logger>;
  config?: PinoLoggerOptions;
} = {}): Provider<Logger> {
  return defineProvider({
    provide: options.provide ?? LoggerToken,
    useValue: createPinoLogger(options.config),
    scope: "singleton",
  });
}

function wrapPinoLogger(
  instance: PinoLikeLogger,
): Logger {
  return {
    debug(message, fields) {
      logWithPino(instance.debug.bind(instance), message, fields);
    },
    info(message, fields) {
      logWithPino(instance.info.bind(instance), message, fields);
    },
    warn(message, fields) {
      logWithPino(instance.warn.bind(instance), message, fields);
    },
    error(message, fields) {
      logWithPino(instance.error.bind(instance), message, fields);
    },
    child(fields) {
      return wrapPinoLogger(instance.child(fields));
    },
  };
}

function logWithPino(
  writer: (obj: unknown, msg?: string) => void,
  message: string,
  fields?: Record<string, unknown>,
): void {
  if (fields && Object.keys(fields).length > 0) {
    writer(fields, message);
    return;
  }

  writer({}, message);
}
