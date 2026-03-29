import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";

import type { IamPasswordHasherPort } from "./external-ports";
import type {
  IamIdentityCommandRepository,
  IamIdentityQueryRepository,
} from "../users/ports";

export interface IamServiceDeps {
  identityStore: IamIdentityQueryRepository & IamIdentityCommandRepository;
  passwordHasher: IamPasswordHasherPort;
  logger?: Logger;
}

export interface IamServiceContext {
  identityQueries: IamIdentityQueryRepository;
  identityCommands: IamIdentityCommandRepository;
  passwordHasher: IamPasswordHasherPort;
  log: Logger;
}

export function createIamServiceContext(
  deps: IamServiceDeps,
): IamServiceContext {
  return {
    identityQueries: deps.identityStore,
    identityCommands: deps.identityStore,
    passwordHasher: deps.passwordHasher,
    log: deps.logger?.child({ service: "iam" }) ?? noopLogger,
  };
}
