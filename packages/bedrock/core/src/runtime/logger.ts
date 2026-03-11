import {
  dependencyResolutionError,
  scopeError,
} from "@bedrock/common";

import { getTokenKey, type Token } from "../kernel";
import {
  createConsoleLogger,
  createLevelFilteredLogger,
  createNoopLogger,
  LoggerToken,
  type LogFields,
  type Logger,
} from "../logging";
import type {
  AppLoggerConfig,
  AppLoggerSourceConfig,
  CompiledApp,
  StartedApp,
} from "./types";

export function resolveAppLogger(
  config: AppLoggerConfig | undefined,
  compiled: CompiledApp,
  started: StartedApp,
): Logger {
  if (config?.enabled === false) {
    return createNoopLogger();
  }

  const source = config?.source ?? { type: "console" as const };
  const logger = resolveLoggerSource(source, compiled, started);
  return config?.levels ? createLevelFilteredLogger(logger, config.levels) : logger;
}

export function createChildLogger(
  logger: Logger,
  fields: LogFields,
): Logger {
  if (logger.child) {
    return logger.child(fields);
  }

  return createMergedLogger(logger, fields);
}

export function isLogger(value: unknown): value is Logger {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Logger>;
  return (
    typeof candidate.debug === "function" &&
    typeof candidate.info === "function" &&
    typeof candidate.warn === "function" &&
    typeof candidate.error === "function" &&
    (candidate.child === undefined || typeof candidate.child === "function")
  );
}

function resolveLoggerSource(
  source: AppLoggerSourceConfig,
  compiled: CompiledApp,
  started: StartedApp,
): Logger {
  switch (source.type) {
    case "console":
      return createConsoleLogger(source.options);
    case "instance":
      if (!isLogger(source.logger)) {
        throw dependencyResolutionError(
          "App logger source resolved to an invalid logger implementation.",
        );
      }

      return source.logger;
    case "provider":
      return resolveProviderLogger(source.token ?? LoggerToken, compiled, started);
    default:
      return createNoopLogger();
  }
}

function resolveProviderLogger(
  tokenValue: Token<Logger>,
  compiled: CompiledApp,
  started: StartedApp,
): Logger {
  const tokenKey = getTokenKey(tokenValue);
  const providerRecord = compiled.providerByTokenKey.get(tokenKey);

  if (!providerRecord) {
    throw dependencyResolutionError(
      `No provider is registered for app logger token "${tokenKey}".`,
      { tokenKey },
    );
  }

  if (providerRecord.scope !== "singleton") {
    throw scopeError(
      `App logger token "${tokenKey}" must use "singleton" scope.`,
      {
        tokenKey,
        scope: providerRecord.scope,
      },
    );
  }

  if (!started.singletonProviderResolved[providerRecord.slot]) {
    throw dependencyResolutionError(
      `No singleton value is available for app logger token "${tokenKey}".`,
      { tokenKey },
    );
  }

  const logger = started.singletonProviderValues[providerRecord.slot];
  if (!isLogger(logger)) {
    throw dependencyResolutionError(
      `App logger token "${tokenKey}" resolved to an invalid logger implementation.`,
      { tokenKey },
    );
  }

  return logger;
}

function createMergedLogger(base: Logger, baseFields: LogFields): Logger {
  const mergeFields = (fields?: LogFields): LogFields | undefined => {
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
      base.debug(message, mergeFields(fields));
    },
    info(message, fields) {
      base.info(message, mergeFields(fields));
    },
    warn(message, fields) {
      base.warn(message, mergeFields(fields));
    },
    error(message, fields) {
      base.error(message, mergeFields(fields));
    },
    child(fields) {
      return createMergedLogger(base, mergeFields(fields) ?? baseFields);
    },
  };
}
