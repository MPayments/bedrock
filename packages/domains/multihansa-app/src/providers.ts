import { defineProvider, type Provider } from "@bedrock/core";
import { createPinoLoggerProvider } from "@bedrock/logger-pino";
import { createDrizzleProvider } from "@bedrock/sql-drizzle";
import { AccountingPackDefinitionToken } from "@multihansa/accounting";
import {
  AppNameToken,
  createRequestContextProvider,
  DbToken,
  TbClientToken,
  WorkerIntervalsToken,
  WorkerObserversToken,
  type WorkerRunObserver,
} from "@multihansa/common/bedrock";
import { DocumentRegistryToken } from "@multihansa/documents";
import { RequisitesDomainServiceToken } from "@multihansa/parties";
import { DimensionRegistryToken } from "@multihansa/reporting";

import { resolvePermissionsForRole } from "./auth";
import { createMultihansaDocumentRegistry } from "./bundle";
import { rawPackDefinition } from "./default-pack";
import { createMultihansaDimensionRegistry } from "./dimensions";

export type CreateApiProvidersInput = {
  appName?: string;
  db: unknown;
  logLevel?: "debug" | "info" | "warn" | "error";
};

export type CreateWorkerProvidersInput = {
  appName?: string;
  db: unknown;
  tb: unknown;
  workerIntervals: Record<string, number>;
  workerObservers?: Record<string, WorkerRunObserver | undefined>;
  logLevel?: "debug" | "info" | "warn" | "error";
};

function createBaseProviders(input: {
  appName: string;
  db: unknown;
  logLevel?: "debug" | "info" | "warn" | "error";
}): Provider[] {
  return [
    createPinoLoggerProvider({
      config: {
        level: input.logLevel,
        name: input.appName,
      },
    }),
    defineProvider({
      provide: AppNameToken,
      useValue: input.appName,
    }),
    createDrizzleProvider({
      provide: DbToken,
      db: input.db,
    }),
  ];
}

export function createApiProviders(input: CreateApiProvidersInput): Provider[] {
  return [
    ...createBaseProviders({
      appName: input.appName ?? "multihansa-api",
      db: input.db,
      logLevel: input.logLevel,
    }),
    createRequestContextProvider(),
    defineProvider({
      provide: AccountingPackDefinitionToken,
      useValue: rawPackDefinition,
    }),
    defineProvider({
      provide: DimensionRegistryToken,
      scope: "singleton",
      useFactory: () => createMultihansaDimensionRegistry(),
    }),
    defineProvider({
      provide: DocumentRegistryToken,
      scope: "singleton",
      deps: {
        requisitesService: RequisitesDomainServiceToken,
      },
      useFactory: ({ requisitesService }) =>
        createMultihansaDocumentRegistry({
          requisitesService,
        }),
    }),
  ];
}

export function createWorkerProviders(
  input: CreateWorkerProvidersInput,
): Provider[] {
  return [
    ...createBaseProviders({
      appName: input.appName ?? "multihansa-workers",
      db: input.db,
      logLevel: input.logLevel,
    }),
    defineProvider({
      provide: TbClientToken,
      useValue: input.tb,
    }),
    defineProvider({
      provide: WorkerIntervalsToken,
      useValue: input.workerIntervals,
    }),
    defineProvider({
      provide: WorkerObserversToken,
      useValue: input.workerObservers ?? {},
    }),
  ];
}

export function resolveActorClaims(
  actor: {
    subject: { id: string };
    claims: Record<string, unknown>;
  },
) {
  const role =
    typeof actor.claims.role === "string" ? actor.claims.role : "user";

  return {
    subject: actor.subject,
    role,
    permissions: resolvePermissionsForRole(role),
  };
}
