import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import type {
  UsersIdentityStorePort,
  UsersPasswordHasherPort,
} from "../ports";

export interface UsersServiceDeps {
  identityStore: UsersIdentityStorePort;
  passwordHasher: UsersPasswordHasherPort;
  logger?: Logger;
}

export interface UsersServiceContext {
  identityStore: UsersIdentityStorePort;
  passwordHasher: UsersPasswordHasherPort;
  log: Logger;
}

export function createUsersServiceContext(
  deps: UsersServiceDeps,
): UsersServiceContext {
  return {
    identityStore: deps.identityStore,
    passwordHasher: deps.passwordHasher,
    log: deps.logger?.child({ service: "users" }) ?? noopLogger,
  };
}
