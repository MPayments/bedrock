import type {
  AuthIdentityStorePort,
  PasswordHasherPort,
} from "@bedrock/auth";
import { type Logger, noopLogger } from "@bedrock/common";

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
