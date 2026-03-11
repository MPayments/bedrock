import { freezeObject } from "./immutability";

export type Token<T> = {
  readonly kind: "token";
  readonly key: string;
  readonly __type?: T;
};

export type TokenMap = Record<string, Token<any>>;

export type ResolveTokenMap<T extends TokenMap> = {
  [K in keyof T]: T[K] extends Token<infer V> ? V : never;
};

export function normalizeTokenKey(key: string): string {
  const normalized = key.trim();

  if (normalized.length === 0) {
    throw new TypeError("Token key cannot be empty.");
  }

  return normalized;
}

export function token<T>(key: string): Token<T> {
  return freezeObject({
    kind: "token",
    key: normalizeTokenKey(key),
  } as Token<T>);
}

export function getTokenKey(tokenValue: Token<unknown>): string {
  return normalizeTokenKey(tokenValue.key);
}

export type AppGraphModuleNode = {
  id: string;
  name: string;
  importIds: readonly string[];
  providerIds: readonly string[];
  serviceIds: readonly string[];
  controllerIds: readonly string[];
  workerIds: readonly string[];
  workerTriggerIds: readonly string[];
  exportKeys: readonly string[];
};

export type AppGraphProviderNode = {
  id: string;
  tokenKey: string;
  kind: "value" | "factory" | "existing";
  scope: "singleton" | "request" | "transient";
  depTokenKeys: readonly string[];
  moduleId?: string;
  aliasToTokenKey?: string;
};

export type AppGraphServiceNode = {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  depTokenKeys: readonly string[];
  actionIds: readonly string[];
};

export type AppGraphActionNode = {
  id: string;
  serviceId: string;
  name: string;
};

export type AppGraphControllerNode = {
  id: string;
  moduleId: string;
  name: string;
  basePath?: string;
  depTokenKeys: readonly string[];
  routeIds: readonly string[];
};

export type AppGraphRouteNode = {
  id: string;
  controllerId: string;
  name: string;
  method: string;
  path: string;
  fullPath: string;
  summary?: string;
  description?: string;
  tags: readonly string[];
};

export type AppGraphWorkerNode = {
  id: string;
  moduleId: string;
  name: string;
  depTokenKeys: readonly string[];
  retry?: {
    attempts: number;
    backoffMs?: number;
  };
  concurrency?: number;
  timeoutMs?: number;
  hasPartitionKey: boolean;
  hasIdempotencyKey: boolean;
};

export type AppGraphWorkerTriggerNode = {
  id: string;
  moduleId: string;
  name: string;
  workerId: string;
  trigger: "dispatch" | "subscription" | "schedule";
  adapter: string;
  tags: readonly string[];
  retry?: {
    attempts: number;
    backoffMs?: number;
  };
  concurrency?: number;
  timeoutMs?: number;
  hasPartitionKey: boolean;
  hasIdempotencyKey: boolean;
};

export type AppGraph = {
  rootProviderIds: readonly string[];
  modules: readonly AppGraphModuleNode[];
  providers: readonly AppGraphProviderNode[];
  services: readonly AppGraphServiceNode[];
  actions: readonly AppGraphActionNode[];
  controllers: readonly AppGraphControllerNode[];
  routes: readonly AppGraphRouteNode[];
  workers: readonly AppGraphWorkerNode[];
  workerTriggers: readonly AppGraphWorkerTriggerNode[];
};
