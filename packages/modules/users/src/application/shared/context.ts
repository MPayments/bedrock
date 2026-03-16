import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";

import type {
  UsersIdentityCommandRepository,
  UsersIdentityQueryRepository,
} from "../users/ports";
import type { UsersPasswordHasherPort } from "./external-ports";

export interface UsersServiceDeps {
  identityStore: UsersIdentityQueryRepository & UsersIdentityCommandRepository;
  passwordHasher: UsersPasswordHasherPort;
  logger?: Logger;
}

export interface UsersServiceContext {
  identityQueries: UsersIdentityQueryRepository;
  identityCommands: UsersIdentityCommandRepository;
  passwordHasher: UsersPasswordHasherPort;
  log: Logger;
}

export function createUsersServiceContext(
  deps: UsersServiceDeps,
): UsersServiceContext {
  return {
    identityQueries: deps.identityStore,
    identityCommands: deps.identityStore,
    passwordHasher: deps.passwordHasher,
    log: deps.logger?.child({ service: "users" }) ?? noopLogger,
  };
}
