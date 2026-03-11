import { inspect } from "node:util";

import { token } from "./kernel";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, unknown>>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child?: (fields: LogFields) => Logger;
};

export type ConsoleLoggerSink = Pick<Console, "debug" | "info" | "warn" | "error">;

export type ConsoleLoggerOptions = {
  level?: LogLevel;
  levels?: readonly LogLevel[];
  timestamp?: false | "iso" | "diff";
  prefix?: string;
  context?: string;
  json?: boolean;
  colors?: boolean;
  compact?: boolean | number;
  maxArrayLength?: number | null;
  maxStringLength?: number | null;
  sorted?: boolean | ((left: string, right: string) => number);
  depth?: number | null;
  showHidden?: boolean;
  breakLength?: number;
  baseFields?: Record<string, unknown>;
  sink?: ConsoleLoggerSink;
};

export const LoggerToken = token<Logger>("logger");

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_PREFIX = "Bedrock";

type ConsoleLoggerState = {
  lastTimestamp?: number;
};

export function createConsoleLogger(options: ConsoleLoggerOptions = {}): Logger {
  const state: ConsoleLoggerState = {};
  const baseBindings = options.context
    ? {
        ...(options.baseFields ?? {}),
        contextName: options.context,
      }
    : (options.baseFields ?? {});

  return createConsoleLoggerWithBindings(options, baseBindings, state);
}

export function createNoopLogger(): Logger {
  const logger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return logger;
    },
  };

  return logger;
}

export function normalizeLogLevels(
  levels?: readonly LogLevel[],
  level?: LogLevel,
): readonly LogLevel[] {
  if (levels && levels.length > 0) {
    return levels;
  }

  if (level) {
    return [level];
  }

  return ["info"];
}

export function createLevelFilteredLogger(
  logger: Logger,
  levels?: readonly LogLevel[],
): Logger {
  const enabledLevels = buildEnabledLevelSet(normalizeLogLevels(levels));
  const wrap = (
    method: LogLevel,
    message: string,
    fields?: LogFields,
  ): void => {
    if (!enabledLevels.has(method)) {
      return;
    }

    logger[method](message, fields);
  };

  return {
    debug(message, fields) {
      wrap("debug", message, fields);
    },
    info(message, fields) {
      wrap("info", message, fields);
    },
    warn(message, fields) {
      wrap("warn", message, fields);
    },
    error(message, fields) {
      wrap("error", message, fields);
    },
    child(fields) {
      const next = logger.child ? logger.child(fields) : mergeLoggerFields(logger, fields);
      return createLevelFilteredLogger(next, levels);
    },
  };
}

function createConsoleLoggerWithBindings(
  options: ConsoleLoggerOptions,
  bindings: Record<string, unknown>,
  state: ConsoleLoggerState,
): Logger {
  const sink = options.sink ?? console;
  const json = options.json ?? false;
  const colors = options.colors ?? !json;
  const timestamp = options.timestamp ?? "iso";
  const enabledLevels = buildEnabledLevelSet(
    normalizeLogLevels(options.levels, options.level),
  );

  const write = (method: LogLevel, message: string, fields?: LogFields): void => {
    if (!enabledLevels.has(method)) {
      return;
    }

    const mergedFields = mergeFields(bindings, fields);

    if (json) {
      sink[method](
        JSON.stringify(
          buildJsonRecord(method, message, mergedFields, timestamp, state, options.prefix),
        ),
      );
      return;
    }

    const renderedMessage = renderTextRecord({
      method,
      message,
      fields: mergedFields,
      colors,
      timestamp,
      state,
      prefix: options.prefix ?? DEFAULT_PREFIX,
  inspectOptions: {
        compact: options.compact ?? true,
        colors,
        maxArrayLength: options.maxArrayLength ?? 100,
        maxStringLength: options.maxStringLength ?? 10_000,
        sorted: options.sorted ?? false,
        depth: options.depth ?? 5,
        showHidden: options.showHidden ?? false,
        breakLength:
          options.breakLength ?? (options.compact === false ? 80 : Number.POSITIVE_INFINITY),
      } satisfies Parameters<typeof inspect>[1],
    });

    sink[method](renderedMessage);
  };

  return {
    debug(message, fields) {
      write("debug", message, fields);
    },
    info(message, fields) {
      write("info", message, fields);
    },
    warn(message, fields) {
      write("warn", message, fields);
    },
    error(message, fields) {
      write("error", message, fields);
    },
    child(fields) {
      return createConsoleLoggerWithBindings(
        options,
        {
          ...bindings,
          ...fields,
        },
        state,
      );
    },
  };
}

function buildEnabledLevelSet(levels: readonly LogLevel[]): ReadonlySet<LogLevel> {
  const minimum = levels.reduce<number | undefined>((current, level) => {
    const next = LEVEL_ORDER[level];
    return current === undefined ? next : Math.min(current, next);
  }, undefined);

  const threshold = minimum ?? Number.POSITIVE_INFINITY;
  const enabled = new Set<LogLevel>();

  for (const [level, order] of Object.entries(LEVEL_ORDER) as Array<[LogLevel, number]>) {
    if (order >= threshold) {
      enabled.add(level);
    }
  }

  return enabled;
}

function buildJsonRecord(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> | undefined,
  timestamp: false | "iso" | "diff",
  state: ConsoleLoggerState,
  prefix?: string,
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    level,
    message,
  };

  if (timestamp !== false) {
    record.timestamp = new Date().toISOString();
    updateTimestampState(state);
  }

  if (prefix) {
    record.prefix = prefix;
  }

  if (fields) {
    Object.assign(record, fields);
  }

  return record;
}

function renderTextRecord(args: {
  method: LogLevel;
  message: string;
  fields?: Record<string, unknown>;
  colors: boolean;
  timestamp: false | "iso" | "diff";
  state: ConsoleLoggerState;
  prefix: string;
  inspectOptions: Parameters<typeof inspect>[1];
}): string {
  const parts: string[] = [];

  if (args.timestamp === "iso") {
    parts.push(new Date().toISOString());
    updateTimestampState(args.state);
  } else if (args.timestamp === "diff") {
    const delta = computeTimestampDelta(args.state);
    if (delta !== undefined) {
      parts.push(`+${delta}ms`);
    }
  }

  parts.push(colorize(args.method.toUpperCase(), args.method, args.colors));

  if (args.prefix) {
    parts.push(`[${args.prefix}]`);
  }

  const contextParts = readContextParts(args.fields);
  if (contextParts.moduleName) {
    parts.push(`[${contextParts.moduleName}]`);
  }
  if (contextParts.contextName) {
    parts.push(`[${contextParts.contextName}]`);
  }

  parts.push(args.message);

  const remainingFields = omitContextFields(args.fields);
  if (remainingFields && Object.keys(remainingFields).length > 0) {
    parts.push(inspect(remainingFields, args.inspectOptions));
  }

  return parts.join(" ");
}

function computeTimestampDelta(state: ConsoleLoggerState): number | undefined {
  const now = Date.now();
  const delta =
    state.lastTimestamp === undefined ? undefined : Math.max(now - state.lastTimestamp, 0);
  state.lastTimestamp = now;
  return delta;
}

function updateTimestampState(state: ConsoleLoggerState): void {
  state.lastTimestamp = Date.now();
}

function colorize(
  value: string,
  level: LogLevel,
  enabled: boolean,
): string {
  if (!enabled) {
    return value;
  }

  const code = {
    debug: 36,
    info: 32,
    warn: 33,
    error: 31,
  }[level];

  return `\u001B[${code}m${value}\u001B[0m`;
}

function readContextParts(
  fields?: Record<string, unknown>,
): {
  moduleName?: string;
  contextName?: string;
} {
  if (!fields) {
    return {};
  }

  const moduleName =
    typeof fields.moduleName === "string" ? fields.moduleName : undefined;
  const contextName =
    typeof fields.contextName === "string" ? fields.contextName : undefined;

  return { moduleName, contextName };
}

function omitContextFields(
  fields?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!fields) {
    return undefined;
  }

  const { moduleName: _moduleName, contextName: _contextName, ...rest } = fields;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function mergeFields(
  baseFields: Record<string, unknown>,
  fields?: LogFields,
): Record<string, unknown> | undefined {
  const merged = {
    ...baseFields,
    ...(fields ?? {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeLoggerFields(base: Logger, baseFields: LogFields): Logger {
  const merge = (fields?: LogFields): LogFields | undefined => {
    if (!fields || Object.keys(fields).length === 0) {
      return baseFields;
    }

    return {
      ...baseFields,
      ...fields,
    };
  };

  return {
    debug(message, fields) {
      base.debug(message, merge(fields));
    },
    info(message, fields) {
      base.info(message, merge(fields));
    },
    warn(message, fields) {
      base.warn(message, merge(fields));
    },
    error(message, fields) {
      base.error(message, merge(fields));
    },
    child(fields) {
      return mergeLoggerFields(base, merge(fields) ?? baseFields);
    },
  };
}
