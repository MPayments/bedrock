import { randomUUID } from "node:crypto";

export type Clock = () => Date;
export type UuidGenerator = () => string;
export interface ModuleRuntimeLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): ModuleRuntimeLogger;
}

const noopLogger: ModuleRuntimeLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return noopLogger;
  },
};

export interface ModuleRuntime {
  generateUuid: UuidGenerator;
  log: ModuleRuntimeLogger;
  now: Clock;
}

export interface CreateModuleRuntimeInput {
  generateUuid?: UuidGenerator;
  logger?: ModuleRuntimeLogger;
  now?: Clock;
  service: string;
}

export function createModuleRuntime(
  input: CreateModuleRuntimeInput,
): ModuleRuntime {
  return {
    generateUuid: input.generateUuid ?? randomUUID,
    log: input.logger?.child({ service: input.service }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
  };
}
