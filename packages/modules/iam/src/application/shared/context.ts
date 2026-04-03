import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type ModuleRuntime,
  type UuidGenerator,
} from "@bedrock/shared/core";

import type { IamPasswordHasherPort } from "./external-ports";
import type {
  IamUsersCommandUnitOfWork,
  IamUsersReads,
} from "../users/ports";

export interface IamServiceDeps {
  reads: IamUsersReads;
  commandUow: IamUsersCommandUnitOfWork;
  passwordHasher: IamPasswordHasherPort;
  logger?: Logger;
  now?: Clock;
  generateUuid?: UuidGenerator;
}

export interface IamServiceContext {
  reads: IamUsersReads;
  commandUow: IamUsersCommandUnitOfWork;
  passwordHasher: IamPasswordHasherPort;
  runtime: ModuleRuntime;
}

export function createIamServiceContext(
  deps: IamServiceDeps,
): IamServiceContext {
  return {
    reads: deps.reads,
    commandUow: deps.commandUow,
    passwordHasher: deps.passwordHasher,
    runtime: createModuleRuntime({
      logger: deps.logger ?? noopLogger,
      now: deps.now,
      generateUuid: deps.generateUuid,
      service: "iam.users",
    }),
  };
}
