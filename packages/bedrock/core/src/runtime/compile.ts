import {
  bootError,
  conflictError,
  dependencyResolutionError,
  scopeError,
} from "@bedrock/common";
import { findDirectedCycle, topologicalSort } from "@bedrock/common";

import { isActionRoute } from "../controller";
import { getBuiltInExecutionTokenScope } from "../execution-context";
import {
  isHttpFiniteResponseKind,
  normalizeHttpResponseDescriptor,
  validateHttpRequestSpec,
} from "../http";
import {
  getTokenKey,
  type AppGraphActionNode,
  type AppGraphControllerNode,
  type AppGraphModuleNode,
  type AppGraphProviderNode,
  type AppGraphRouteNode,
  type AppGraphServiceNode,
  type AppGraphWorkerTriggerNode,
  type AppGraphWorkerNode,
} from "../kernel";
import type { ModuleDescriptor } from "../module";
import {
  getProviderDepTokenKeys,
  getProviderKind,
  getProviderScope,
  isExistingProvider,
  type ProviderScope,
} from "../provider";
import type { RegisteredWorkerTrigger, WorkerAdapter } from "../worker-trigger";
import {
  getDepTokenKeys,
  joinHttpPath,
  validateReservedLoggerDepName,
  validateDepTokenKeys,
} from "./support";
import { normalizeRouteErrors } from "../route-errors";
import type {
  AnyWorkerTriggerDescriptor,
  AnyRouteDescriptor,
  AppDescriptor,
  CompiledApp,
  ControllerRecord,
  HttpMountRecord,
  ModuleRecord,
  ProviderRecord,
  RouteRecord,
  ServiceRecord,
  WorkerTriggerRecord,
  WorkerRecord,
} from "./types";

export function compileApp(def: AppDescriptor): CompiledApp {
  const moduleRecords = collectModules(def.modules);
  const workerAdapterByName = collectWorkerAdapters(def.workerAdapters);
  const providerRecords: ProviderRecord[] = [];
  const providerByTokenKey = new Map<string, ProviderRecord>();
  const providerNodes: AppGraphProviderNode[] = [];
  const rootProviderIds: string[] = [];
  const httpBasePath = def.http?.basePath;

  const registerProvider = (
    provider: ProviderRecord["descriptor"],
    moduleRecord?: ModuleRecord,
  ): void => {
    const tokenKey = getTokenKey(provider.provide);

    if (providerByTokenKey.has(tokenKey)) {
      throw conflictError(`Duplicate provider binding for token "${tokenKey}".`, {
        tokenKey,
      });
    }

    const record: ProviderRecord = {
      slot: providerRecords.length,
      id: `token:${tokenKey}`,
      tokenKey,
      kind: getProviderKind(provider),
      scope: "singleton",
      declaredScope: provider.scope,
      descriptor: provider,
      depTokenKeys: getProviderDepTokenKeys(provider),
      moduleId: moduleRecord?.id,
      aliasToTokenKey: isExistingProvider(provider)
        ? getTokenKey(provider.useExisting)
        : undefined,
    };

    providerRecords.push(record);
    providerByTokenKey.set(tokenKey, record);

    if (moduleRecord) {
      moduleRecord.providerIds.push(record.id);
    } else {
      rootProviderIds.push(record.id);
    }
  };

  for (const provider of def.providers ?? []) {
    registerProvider(provider);
  }

  for (const moduleRecord of moduleRecords) {
    for (const provider of moduleRecord.descriptor.providers ?? []) {
      registerProvider(provider, moduleRecord);
    }
  }

  for (const providerRecord of providerRecords) {
    for (const depTokenKey of providerRecord.depTokenKeys) {
      if (
        !providerByTokenKey.has(depTokenKey) &&
        getBuiltInExecutionTokenScope(depTokenKey) === undefined
      ) {
        throw dependencyResolutionError(
          `Provider "${providerRecord.tokenKey}" depends on missing token "${depTokenKey}".`,
          {
            tokenKey: providerRecord.tokenKey,
            depTokenKey,
          },
        );
      }
    }
  }

  const providerCycle = findDirectedCycle(
    providerRecords,
    (record) => record.id,
    (record) =>
      record.depTokenKeys
        .map((depTokenKey) => providerByTokenKey.get(depTokenKey))
        .filter((value): value is ProviderRecord => value !== undefined),
  );

  if (providerCycle) {
    throw dependencyResolutionError(
      `Provider cycle detected: ${providerCycle.join(" -> ")}.`,
      { cycle: providerCycle },
    );
  }

  const providerOrder = topologicalSort(
    providerRecords,
    (record) => record.id,
    (record) =>
      record.depTokenKeys
        .map((depTokenKey) => providerByTokenKey.get(depTokenKey))
        .filter((value): value is ProviderRecord => value !== undefined),
  );

  resolveProviderScopes(providerOrder, providerByTokenKey);
  validateProviderScopes(providerRecords, providerByTokenKey);

  for (const providerRecord of providerRecords) {
    providerNodes.push({
      id: providerRecord.id,
      tokenKey: providerRecord.tokenKey,
      kind: providerRecord.kind,
      scope: providerRecord.scope,
      depTokenKeys: providerRecord.depTokenKeys,
      moduleId: providerRecord.moduleId,
      aliasToTokenKey: providerRecord.aliasToTokenKey,
    });
  }

  const serviceRecords: ServiceRecord[] = [];
  const serviceNodes: AppGraphServiceNode[] = [];
  const actionNodes: AppGraphActionNode[] = [];
  const serviceDescriptorOwners = new Map<object, string>();
  const serviceRecordByDescriptor = new WeakMap<object, ServiceRecord>();

  const controllerRecords: ControllerRecord[] = [];
  const controllerNodes: AppGraphControllerNode[] = [];
  const routeNodes: AppGraphRouteNode[] = [];
  const routeOwnerByMethodAndPath = new Map<string, string>();
  const httpMountRecords: HttpMountRecord[] = [];

  const workerRecords: WorkerRecord[] = [];
  const workerNodes: AppGraphWorkerNode[] = [];
  const workerDescriptorOwners = new Map<object, string>();
  const workerRecordByDescriptor = new WeakMap<object, WorkerRecord>();
  const workerTriggerRecords: WorkerTriggerRecord[] = [];
  const workerTriggerNodes: AppGraphWorkerTriggerNode[] = [];
  const workerTriggerRecordByDescriptor = new WeakMap<object, WorkerTriggerRecord>();
  const workerTriggerRecordById = new Map<string, WorkerTriggerRecord>();

  for (const moduleRecord of moduleRecords) {
    collectServices(
      moduleRecord,
      providerByTokenKey,
      serviceRecords,
      serviceNodes,
      actionNodes,
      serviceDescriptorOwners,
      serviceRecordByDescriptor,
    );
    collectControllers(
      moduleRecord,
      providerByTokenKey,
      serviceDescriptorOwners,
      controllerRecords,
      controllerNodes,
      routeNodes,
      routeOwnerByMethodAndPath,
      httpBasePath,
      Boolean(def.http),
    );
    collectHttpMounts(moduleRecord, httpMountRecords, httpBasePath);
    collectWorkers(
      moduleRecord,
      providerByTokenKey,
      workerRecords,
      workerNodes,
      workerDescriptorOwners,
      workerRecordByDescriptor,
    );
  }

  for (const moduleRecord of moduleRecords) {
    collectWorkerTriggers(
      moduleRecord,
      workerRecordByDescriptor,
      workerAdapterByName,
      workerTriggerRecords,
      workerTriggerNodes,
      workerTriggerRecordByDescriptor,
      workerTriggerRecordById,
    );
  }

  const moduleNodes: AppGraphModuleNode[] = moduleRecords.map((moduleRecord) => ({
    id: moduleRecord.id,
    name: moduleRecord.descriptor.name,
    importIds: moduleRecord.importIds,
    providerIds: moduleRecord.providerIds,
    serviceIds: moduleRecord.serviceIds,
    controllerIds: moduleRecord.controllerIds,
    workerIds: moduleRecord.workerIds,
    workerTriggerIds: moduleRecord.workerTriggerIds,
    exportKeys: moduleRecord.exportKeys,
  }));

  return {
    loggerConfig: def.logger,
    graph: {
      rootProviderIds,
      modules: moduleNodes,
      providers: providerNodes,
      services: serviceNodes,
      actions: actionNodes,
      controllers: controllerNodes,
      routes: routeNodes,
      workers: workerNodes,
      workerTriggers: workerTriggerNodes,
    },
    moduleRecords,
    providerRecords,
    providerOrder,
    providerByTokenKey,
    serviceRecords,
    serviceRecordByDescriptor,
    controllerRecords,
    httpMountRecords,
    workerRecords,
    workerTriggerRecords,
    workerTriggerRecordByDescriptor,
    workerTriggerRecordById,
    workerAdapterByName,
    httpAdapter: def.http,
  };
}

function collectWorkerAdapters(
  workerAdapters: readonly WorkerAdapter[] | undefined,
): Map<string, WorkerAdapter> {
  const workerAdapterByName = new Map<string, WorkerAdapter>();

  for (const workerAdapter of workerAdapters ?? []) {
    if (workerAdapterByName.has(workerAdapter.name)) {
      throw conflictError(
        `Duplicate worker adapter "${workerAdapter.name}".`,
        {
          adapterName: workerAdapter.name,
        },
      );
    }

    workerAdapterByName.set(workerAdapter.name, workerAdapter);
  }

  return workerAdapterByName;
}

function resolveProviderScopes(
  providerOrder: readonly ProviderRecord[],
  providerByTokenKey: ReadonlyMap<string, ProviderRecord>,
): void {
  for (const providerRecord of providerOrder) {
    if (!isExistingProvider(providerRecord.descriptor)) {
      providerRecord.scope = getProviderScope(providerRecord.descriptor);
      continue;
    }

    const aliasTargetKey = providerRecord.aliasToTokenKey;
    const aliasTarget =
      aliasTargetKey === undefined ? undefined : providerByTokenKey.get(aliasTargetKey);

    if (!aliasTarget) {
      throw dependencyResolutionError(
        `Provider alias "${providerRecord.tokenKey}" depends on missing token "${aliasTargetKey}".`,
        {
          tokenKey: providerRecord.tokenKey,
          aliasTargetKey,
        },
      );
    }

    if (providerRecord.declaredScope && providerRecord.declaredScope !== aliasTarget.scope) {
      throw scopeError(
        `Provider alias "${providerRecord.tokenKey}" must use the same scope as "${aliasTarget.tokenKey}".`,
        {
          tokenKey: providerRecord.tokenKey,
          scope: providerRecord.declaredScope,
          aliasTargetKey: aliasTarget.tokenKey,
          aliasTargetScope: aliasTarget.scope,
        },
      );
    }

    providerRecord.scope = providerRecord.declaredScope ?? aliasTarget.scope;
  }
}

function validateProviderScopes(
  providerRecords: readonly ProviderRecord[],
  providerByTokenKey: ReadonlyMap<string, ProviderRecord>,
): void {
  for (const providerRecord of providerRecords) {
    for (const depTokenKey of providerRecord.depTokenKeys) {
      const dependencyScope =
        providerByTokenKey.get(depTokenKey)?.scope ??
        getBuiltInExecutionTokenScope(depTokenKey);

      if (!dependencyScope) {
        continue;
      }

      if (!isProviderScopeDependencyAllowed(providerRecord.scope, dependencyScope)) {
        throw scopeError(
          `Provider "${providerRecord.tokenKey}" with scope "${providerRecord.scope}" cannot depend on "${depTokenKey}" with scope "${dependencyScope}".`,
          {
            tokenKey: providerRecord.tokenKey,
            scope: providerRecord.scope,
            depTokenKey,
            depScope: dependencyScope,
          },
        );
      }
    }
  }
}

function collectServices(
  moduleRecord: ModuleRecord,
  providerByTokenKey: Map<string, ProviderRecord>,
  serviceRecords: ServiceRecord[],
  serviceNodes: AppGraphServiceNode[],
  actionNodes: AppGraphActionNode[],
  serviceDescriptorOwners: Map<object, string>,
  serviceRecordByDescriptor: WeakMap<object, ServiceRecord>,
): void {
  for (const [serviceKey, serviceDescriptor] of Object.entries(
    moduleRecord.descriptor.services ?? {},
  )) {
    validateReservedLoggerDepName(
      serviceDescriptor.deps,
      `Service "${moduleRecord.id}/${serviceKey}"`,
    );
    if (serviceKey !== serviceDescriptor.name) {
      throw conflictError(
        `Service registration key "${serviceKey}" must match service name "${serviceDescriptor.name}" in module "${moduleRecord.id}".`,
        {
          moduleId: moduleRecord.id,
          serviceKey,
          serviceName: serviceDescriptor.name,
        },
      );
    }

    const existingOwner = serviceDescriptorOwners.get(serviceDescriptor as object);
    if (existingOwner) {
      throw conflictError(
        `Service descriptor "${serviceDescriptor.name}" is registered multiple times (${existingOwner}, ${moduleRecord.id}/${serviceKey}).`,
        {
          serviceName: serviceDescriptor.name,
          existingOwner,
          nextOwner: `${moduleRecord.id}/${serviceKey}`,
        },
      );
    }

    serviceDescriptorOwners.set(
      serviceDescriptor as object,
      `${moduleRecord.id}/${serviceKey}`,
    );

    const depTokenKeys = getDepTokenKeys(serviceDescriptor.deps);
    validateDepTokenKeys(
      depTokenKeys,
      providerByTokenKey,
      `Service "${moduleRecord.id}/${serviceKey}"`,
    );

    const depScope = getHighestDepScope(depTokenKeys, providerByTokenKey);

    if (
      depScope !== "singleton" &&
      (serviceDescriptor.hooks?.onInit || serviceDescriptor.hooks?.onDispose)
    ) {
      throw scopeError(
        `Service "${moduleRecord.id}/${serviceKey}" cannot use lifecycle hooks with non-singleton dependencies.`,
        {
          serviceId: `service:${moduleRecord.descriptor.name}/${serviceKey}`,
          scope: depScope,
        },
      );
    }

    const serviceId = `service:${moduleRecord.descriptor.name}/${serviceKey}`;
    const actionIds = Object.keys(serviceDescriptor.actions).map(
      (actionName) => `action:${moduleRecord.descriptor.name}/${serviceKey}/${actionName}`,
    );

    moduleRecord.serviceIds.push(serviceId);

    const record: ServiceRecord = {
      slot: serviceRecords.length,
      id: serviceId,
      moduleId: moduleRecord.id,
      moduleName: moduleRecord.descriptor.name,
      key: serviceKey,
      descriptor: serviceDescriptor,
      depTokenKeys,
      depScope,
    };

    serviceRecords.push(record);
    serviceRecordByDescriptor.set(serviceDescriptor as object, record);
    serviceNodes.push({
      id: serviceId,
      moduleId: moduleRecord.id,
      key: serviceKey,
      name: serviceDescriptor.name,
      depTokenKeys,
      actionIds,
    });

    for (const actionName of Object.keys(serviceDescriptor.actions)) {
      actionNodes.push({
        id: `action:${moduleRecord.descriptor.name}/${serviceKey}/${actionName}`,
        serviceId,
        name: actionName,
      });
    }
  }
}

function collectControllers(
  moduleRecord: ModuleRecord,
  providerByTokenKey: Map<string, ProviderRecord>,
  serviceDescriptorOwners: Map<object, string>,
  controllerRecords: ControllerRecord[],
  controllerNodes: AppGraphControllerNode[],
  routeNodes: AppGraphRouteNode[],
  routeOwnerByMethodAndPath: Map<string, string>,
  httpBasePath: string | undefined,
  validateHttpRouteContract: boolean,
): void {
  for (const controllerDescriptor of moduleRecord.descriptor.controllers ?? []) {
    validateReservedLoggerDepName(
      controllerDescriptor.deps,
      `Controller "${moduleRecord.id}/${controllerDescriptor.name}"`,
    );
    const depTokenKeys = getDepTokenKeys(controllerDescriptor.deps);
    validateDepTokenKeys(
      depTokenKeys,
      providerByTokenKey,
      `Controller "${moduleRecord.id}/${controllerDescriptor.name}"`,
    );

    const depScope = getHighestDepScope(depTokenKeys, providerByTokenKey);
    const controllerId = `controller:${moduleRecord.descriptor.name}/${controllerDescriptor.name}`;
    const routeRecords: RouteRecord[] = [];
    const routeIds = Object.keys(controllerDescriptor.routes).map(
      (routeName) =>
        `route:${moduleRecord.descriptor.name}/${controllerDescriptor.name}/${routeName}`,
    );

    moduleRecord.controllerIds.push(controllerId);

    for (const [routeName, routeDescriptor] of Object.entries(
      controllerDescriptor.routes as Record<string, AnyRouteDescriptor>,
    )) {
      if (validateHttpRouteContract) {
        validateHttpRequestSpec(
          `${controllerId}/${routeName}`,
          routeDescriptor.request,
        );
        validateHttpSuccessResponses(
          `${controllerId}/${routeName}`,
          routeDescriptor.responses,
          isActionRoute(routeDescriptor),
        );
      }

      if (
        isActionRoute(routeDescriptor) &&
        !serviceDescriptorOwners.has(routeDescriptor.handler.service as object)
      ) {
        throw dependencyResolutionError(
          `Controller route "${controllerId}/${routeName}" targets a service action that is not registered in this app.`,
          {
            routeId: `${controllerId}/${routeName}`,
            actionName: routeDescriptor.handler.name,
            serviceName: routeDescriptor.handler.service.name,
          },
        );
      }

      if (
        isActionRoute(routeDescriptor) &&
        routeDescriptor.select === undefined
      ) {
        throw bootError(
          `Controller route "${controllerId}/${routeName}" requires an explicit select() because the action input cannot be inferred from the route request contract.`,
          {
            routeId: `${controllerId}/${routeName}`,
          },
        );
      }

      const routeId = `route:${moduleRecord.descriptor.name}/${controllerDescriptor.name}/${routeName}`;
      const errorContract = normalizeRouteErrors({
        routeId,
        method: routeDescriptor.method,
        routeErrors: routeDescriptor.errors,
        middlewareErrors: routeDescriptor.middleware?.map((entry) => entry.errors),
        domainErrors: isActionRoute(routeDescriptor)
          ? routeDescriptor.handler.errors
          : undefined,
        requireRouteLocalMappings: isActionRoute(routeDescriptor),
      });
      const routeRecord: RouteRecord = {
        id: routeId,
        name: routeName,
        controllerId,
        descriptor: routeDescriptor,
        path: routeDescriptor.path,
        fullPath: joinHttpPath(
          httpBasePath,
          controllerDescriptor.basePath,
          routeDescriptor.path,
        ),
        summary: routeDescriptor.summary,
        description: routeDescriptor.description,
        tags: routeDescriptor.tags ?? [],
        errorContract,
      };
      const methodAndPathKey = `${routeDescriptor.method} ${routeRecord.fullPath}`;
      const existingOwner = routeOwnerByMethodAndPath.get(methodAndPathKey);

      if (existingOwner) {
        throw conflictError(
          `Duplicate controller route "${methodAndPathKey}" (${existingOwner}, ${routeId}).`,
          {
            method: routeDescriptor.method,
            fullPath: routeRecord.fullPath,
            existingOwner,
            nextOwner: routeId,
          },
        );
      }

      routeOwnerByMethodAndPath.set(methodAndPathKey, routeId);

      routeRecords.push(routeRecord);
      routeNodes.push({
        id: routeRecord.id,
        controllerId,
        name: routeRecord.name,
        method: routeDescriptor.method,
        path: routeRecord.path,
        fullPath: routeRecord.fullPath,
        summary: routeRecord.summary,
        description: routeRecord.description,
        tags: routeRecord.tags,
      });
    }

    controllerRecords.push({
      slot: controllerRecords.length,
      id: controllerId,
      moduleId: moduleRecord.id,
      moduleName: moduleRecord.descriptor.name,
      descriptor: controllerDescriptor,
      depTokenKeys,
      depScope,
      routeIds,
      routes: routeRecords,
    });

    controllerNodes.push({
      id: controllerId,
      moduleId: moduleRecord.id,
      name: controllerDescriptor.name,
      basePath: controllerDescriptor.basePath,
      depTokenKeys,
      routeIds,
    });
  }
}

function validateHttpSuccessResponses(
  routeId: string,
  responses: Record<number, unknown>,
  actionRoute: boolean,
): void {
  const entries = Object.entries(responses).map(([status, descriptor]) => [
    Number(status),
    descriptor,
  ] as const);

  if (entries.length === 0) {
    throw bootError(`HTTP route "${routeId}" must declare at least one success response.`, {
      routeId,
    });
  }

  for (const [status, descriptor] of entries) {
    if (!Number.isInteger(status) || status < 200 || status > 399) {
      throw bootError(
        `HTTP route "${routeId}" must use only success HTTP statuses in responses.`,
        {
          routeId,
          status,
        },
      );
    }

    const normalized = normalizeHttpResponseDescriptor(
      descriptor as never,
    );

    if (
      normalized.kind === "redirect" &&
      !new Set([301, 302, 303, 307, 308]).has(status)
    ) {
      throw bootError(
        `HTTP route "${routeId}" may only use redirect() with 301, 302, 303, 307, or 308.`,
        {
          routeId,
          status,
        },
      );
    }
  }

  if (!actionRoute) {
    return;
  }

  if (entries.length !== 1) {
    throw bootError(
      `Action route "${routeId}" must declare exactly one success response.`,
      {
        routeId,
      },
    );
  }

  const [status, descriptor] = entries[0]!;
  const normalized = normalizeHttpResponseDescriptor(descriptor as never);

  if (!isHttpFiniteResponseKind(normalized.kind)) {
    throw bootError(
      `Action route "${routeId}" cannot use ${normalized.kind}() success responses.`,
      {
        routeId,
        status,
        kind: normalized.kind,
      },
    );
  }
}

function collectWorkers(
  moduleRecord: ModuleRecord,
  providerByTokenKey: Map<string, ProviderRecord>,
  workerRecords: WorkerRecord[],
  workerNodes: AppGraphWorkerNode[],
  workerDescriptorOwners: Map<object, string>,
  workerRecordByDescriptor: WeakMap<object, WorkerRecord>,
): void {
  for (const workerDescriptor of moduleRecord.descriptor.workers ?? []) {
    validateReservedLoggerDepName(
      workerDescriptor.deps,
      `Worker "${moduleRecord.id}/${workerDescriptor.name}"`,
    );
    const depTokenKeys = getDepTokenKeys(workerDescriptor.deps);
    validateDepTokenKeys(
      depTokenKeys,
      providerByTokenKey,
      `Worker "${moduleRecord.id}/${workerDescriptor.name}"`,
    );

    const existingOwner = workerDescriptorOwners.get(workerDescriptor as object);
    if (existingOwner) {
      throw conflictError(
        `Worker descriptor "${workerDescriptor.name}" is registered multiple times (${existingOwner}, ${moduleRecord.id}/${workerDescriptor.name}).`,
        {
          workerName: workerDescriptor.name,
          existingOwner,
          nextOwner: `${moduleRecord.id}/${workerDescriptor.name}`,
        },
      );
    }

    workerDescriptorOwners.set(
      workerDescriptor as object,
      `${moduleRecord.id}/${workerDescriptor.name}`,
    );

    const workerId = `worker:${moduleRecord.descriptor.name}/${workerDescriptor.name}`;
    const depScope = getHighestDepScope(depTokenKeys, providerByTokenKey);

    moduleRecord.workerIds.push(workerId);
    const record: WorkerRecord = {
      id: workerId,
      moduleId: moduleRecord.id,
      moduleName: moduleRecord.descriptor.name,
      descriptor: workerDescriptor,
      depTokenKeys,
      depScope,
    };

    workerRecords.push(record);
    workerRecordByDescriptor.set(workerDescriptor as object, record);

    workerNodes.push({
      id: workerId,
      moduleId: moduleRecord.id,
      name: workerDescriptor.name,
      depTokenKeys,
      retry: workerDescriptor.retry
        ? {
            attempts: workerDescriptor.retry.attempts,
            backoffMs: workerDescriptor.retry.backoffMs,
          }
        : undefined,
      concurrency: workerDescriptor.concurrency,
      timeoutMs: workerDescriptor.timeoutMs,
      hasPartitionKey: workerDescriptor.partitionBy !== undefined,
      hasIdempotencyKey: workerDescriptor.idempotencyKey !== undefined,
    });
  }
}

function collectWorkerTriggers(
  moduleRecord: ModuleRecord,
  workerRecordByDescriptor: WeakMap<object, WorkerRecord>,
  workerAdapterByName: ReadonlyMap<string, WorkerAdapter>,
  workerTriggerRecords: WorkerTriggerRecord[],
  workerTriggerNodes: AppGraphWorkerTriggerNode[],
  workerTriggerRecordByDescriptor: WeakMap<object, WorkerTriggerRecord>,
  workerTriggerRecordById: Map<string, WorkerTriggerRecord>,
): void {
  for (const workerTriggerDescriptor of moduleRecord.descriptor.workerTriggers ?? []) {
    const workerTriggerId = `worker-trigger:${moduleRecord.descriptor.name}/${workerTriggerDescriptor.name}`;

    if (workerTriggerRecordById.has(workerTriggerId)) {
      throw conflictError(
        `Duplicate worker trigger "${workerTriggerDescriptor.name}" in module "${moduleRecord.id}".`,
        {
          moduleId: moduleRecord.id,
          workerTriggerId,
        },
      );
    }

    const workerRecord = workerRecordByDescriptor.get(workerTriggerDescriptor.worker as object);

    if (!workerRecord) {
      throw dependencyResolutionError(
        `Worker trigger "${workerTriggerId}" targets a worker that is not registered in this app.`,
        {
          workerTriggerId,
          workerName: workerTriggerDescriptor.worker.name,
        },
      );
    }

    const workerAdapter = workerAdapterByName.get(workerTriggerDescriptor.source.adapter);

    if (!workerAdapter) {
      throw dependencyResolutionError(
        `Worker trigger "${workerTriggerId}" targets missing worker adapter "${workerTriggerDescriptor.source.adapter}".`,
        {
          workerTriggerId,
          adapterName: workerTriggerDescriptor.source.adapter,
        },
      );
    }

    validateWorkerTriggerCapabilities(workerTriggerId, workerTriggerDescriptor, workerAdapter);

    const registeredTrigger: RegisteredWorkerTrigger = {
      id: workerTriggerId,
      moduleId: moduleRecord.id,
      name: workerTriggerDescriptor.name,
      workerId: workerRecord.id,
      workerName: workerRecord.descriptor.name,
      trigger: workerTriggerDescriptor.source.trigger,
      adapter: workerTriggerDescriptor.source.adapter,
      source: workerTriggerDescriptor.source,
      worker: workerRecord.descriptor,
      retry: workerTriggerDescriptor.retry ?? workerRecord.descriptor.retry,
      concurrency:
        workerTriggerDescriptor.concurrency ?? workerRecord.descriptor.concurrency,
      timeoutMs: workerTriggerDescriptor.timeoutMs ?? workerRecord.descriptor.timeoutMs,
      partitionBy: workerTriggerDescriptor.partitionBy,
      idempotencyKey: workerTriggerDescriptor.idempotencyKey,
      summary: workerTriggerDescriptor.summary,
      description: workerTriggerDescriptor.description,
      tags: workerTriggerDescriptor.tags ?? [],
    };

    const graphNode: AppGraphWorkerTriggerNode = {
      id: workerTriggerId,
      moduleId: moduleRecord.id,
      name: workerTriggerDescriptor.name,
      workerId: workerRecord.id,
      trigger: workerTriggerDescriptor.source.trigger,
      adapter: workerTriggerDescriptor.source.adapter,
      tags: workerTriggerDescriptor.tags ?? [],
      retry: registeredTrigger.retry
        ? {
            attempts: registeredTrigger.retry.attempts,
            backoffMs: registeredTrigger.retry.backoffMs,
          }
        : undefined,
      concurrency: registeredTrigger.concurrency,
      timeoutMs: registeredTrigger.timeoutMs,
      hasPartitionKey:
        workerTriggerDescriptor.partitionBy !== undefined ||
        workerRecord.descriptor.partitionBy !== undefined,
      hasIdempotencyKey:
        workerTriggerDescriptor.idempotencyKey !== undefined ||
        workerRecord.descriptor.idempotencyKey !== undefined,
    };

    const record: WorkerTriggerRecord = {
      id: workerTriggerId,
      moduleId: moduleRecord.id,
      moduleName: moduleRecord.descriptor.name,
      name: workerTriggerDescriptor.name,
      descriptor: workerTriggerDescriptor,
      workerRecord,
      trigger: workerTriggerDescriptor.source.trigger,
      adapterName: workerTriggerDescriptor.source.adapter,
      registeredTrigger,
      graphNode,
    };

    moduleRecord.workerTriggerIds.push(workerTriggerId);
    workerTriggerRecords.push(record);
    workerTriggerNodes.push(graphNode);
    workerTriggerRecordByDescriptor.set(workerTriggerDescriptor as object, record);
    workerTriggerRecordById.set(workerTriggerId, record);
  }
}

function collectModules(rootModules: readonly ModuleDescriptor[]): ModuleRecord[] {
  const modulesByName = new Map<string, ModuleDescriptor>();
  const orderedDescriptors: ModuleDescriptor[] = [];
  const visited = new Set<ModuleDescriptor>();
  const visiting = new Set<ModuleDescriptor>();
  const stack: ModuleDescriptor[] = [];

  const visit = (moduleDescriptor: ModuleDescriptor): void => {
    const existing = modulesByName.get(moduleDescriptor.name);
    if (existing && existing !== moduleDescriptor) {
      throw conflictError(`Duplicate module name "${moduleDescriptor.name}".`, {
        moduleName: moduleDescriptor.name,
      });
    }

    if (visiting.has(moduleDescriptor)) {
      const startIndex = stack.indexOf(moduleDescriptor);
      const cycle = [...stack.slice(startIndex), moduleDescriptor].map(
        (moduleEntry) => moduleEntry.name,
      );
      throw bootError(`Module cycle detected: ${cycle.join(" -> ")}.`, { cycle });
    }

    if (visited.has(moduleDescriptor)) {
      return;
    }

    modulesByName.set(moduleDescriptor.name, moduleDescriptor);
    visiting.add(moduleDescriptor);
    stack.push(moduleDescriptor);

    for (const importedModule of moduleDescriptor.imports ?? []) {
      visit(importedModule);
    }

    stack.pop();
    visiting.delete(moduleDescriptor);
    visited.add(moduleDescriptor);
    orderedDescriptors.push(moduleDescriptor);
  };

  for (const moduleDescriptor of rootModules) {
    visit(moduleDescriptor);
  }

  return orderedDescriptors.map((moduleDescriptor) => ({
    id: `module:${moduleDescriptor.name}`,
    descriptor: moduleDescriptor,
    importIds: (moduleDescriptor.imports ?? []).map(
      (importedModule) => `module:${importedModule.name}`,
    ),
    providerIds: [],
    serviceIds: [],
    controllerIds: [],
    httpMountIds: [],
    workerIds: [],
    workerTriggerIds: [],
    exportKeys: Object.keys(moduleDescriptor.exports ?? {}),
  }));
}

function collectHttpMounts(
  moduleRecord: ModuleRecord,
  httpMountRecords: HttpMountRecord[],
  httpBasePath: string | undefined,
): void {
  for (const httpMountDescriptor of moduleRecord.descriptor.httpMounts ?? []) {
    const mountId = `http-mount:${moduleRecord.descriptor.name}/${httpMountDescriptor.name}`;

    moduleRecord.httpMountIds.push(mountId);
    httpMountRecords.push({
      id: mountId,
      moduleId: moduleRecord.id,
      moduleName: moduleRecord.descriptor.name,
      descriptor: httpMountDescriptor,
      fullPath: joinHttpPath(httpBasePath, httpMountDescriptor.basePath),
    });
  }
}

function validateWorkerTriggerCapabilities(
  workerTriggerId: string,
  workerTriggerDescriptor: AnyWorkerTriggerDescriptor,
  workerAdapter: WorkerAdapter,
): void {
  if (
    workerTriggerDescriptor.source.trigger === "dispatch" &&
    !workerAdapter.capabilities.dispatch
  ) {
    throw bootError(
      `Worker trigger "${workerTriggerId}" uses dispatch trigger but adapter "${workerAdapter.name}" does not support dispatch.`,
      {
        workerTriggerId,
        adapterName: workerAdapter.name,
        trigger: workerTriggerDescriptor.source.trigger,
      },
    );
  }

  if (
    workerTriggerDescriptor.source.trigger === "subscription" &&
    !workerAdapter.capabilities.subscription
  ) {
    throw bootError(
      `Worker trigger "${workerTriggerId}" uses subscription trigger but adapter "${workerAdapter.name}" does not support subscriptions.`,
      {
        workerTriggerId,
        adapterName: workerAdapter.name,
        trigger: workerTriggerDescriptor.source.trigger,
      },
    );
  }

  if (
    workerTriggerDescriptor.source.trigger === "schedule" &&
    !workerAdapter.capabilities.schedule
  ) {
    throw bootError(
      `Worker trigger "${workerTriggerId}" uses schedule trigger but adapter "${workerAdapter.name}" does not support schedules.`,
      {
        workerTriggerId,
        adapterName: workerAdapter.name,
        trigger: workerTriggerDescriptor.source.trigger,
      },
    );
  }
}

function getHighestDepScope(
  depTokenKeys: readonly string[],
  providerByTokenKey: ReadonlyMap<string, ProviderRecord>,
): ProviderScope {
  let scope: ProviderScope = "singleton";

  for (const depTokenKey of depTokenKeys) {
    const dependencyScope =
      providerByTokenKey.get(depTokenKey)?.scope ??
      getBuiltInExecutionTokenScope(depTokenKey);

    if (!dependencyScope) {
      continue;
    }

    if (dependencyScope === "transient") {
      return "transient";
    }

    if (dependencyScope === "request") {
      scope = "request";
    }
  }

  return scope;
}

function isProviderScopeDependencyAllowed(
  ownerScope: ProviderScope,
  dependencyScope: ProviderScope,
): boolean {
  if (ownerScope === "singleton") {
    return dependencyScope === "singleton";
  }

  if (ownerScope === "request") {
    return dependencyScope === "singleton" || dependencyScope === "request";
  }

  return true;
}
