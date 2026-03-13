import type {
  AuthIdentityStorePort,
  PasswordHasherPort,
} from "@bedrock/identity";
import { noopLogger, type Logger } from "@bedrock/observability/logger";

export interface UsersServiceDeps {
  authStore: AuthIdentityStorePort;
  passwordHasher: PasswordHasherPort;
  logger?: Logger;
}

export interface UsersServiceContext {
  authStore: AuthIdentityStorePort;
  passwordHasher: PasswordHasherPort;
  log: Logger;
}

export function createUsersServiceContext(
  deps: UsersServiceDeps,
): UsersServiceContext {
  return {
    authStore: deps.authStore,
    passwordHasher: deps.passwordHasher,
    log: deps.logger?.child({ service: "users" }) ?? noopLogger,
  };
}
