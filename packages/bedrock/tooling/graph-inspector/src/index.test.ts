import { expect, test } from "bun:test";
import type { AppGraph } from "@bedrock/core";

import {
  selectControllerRouteMap,
  selectModuleGraph,
  selectProviderGraph,
  selectTokenRegistry,
  selectWorkerTriggerRegistry,
  selectWorkerRegistry,
} from "./index";

test("derives module, provider, controller, route, token, and worker views from AppGraph", () => {
  const graph: AppGraph = {
    rootProviderIds: [],
    modules: [
      {
        id: "module:feature",
        name: "feature",
        importIds: [],
        providerIds: ["token:audit"],
        serviceIds: ["service:feature/audit"],
        controllerIds: ["controller:feature/audit-http"],
        workerIds: ["worker:feature/audit-worker"],
        workerTriggerIds: ["worker-trigger:feature/audit-dispatch"],
        exportKeys: [],
      },
      {
        id: "module:root",
        name: "root",
        importIds: ["module:feature"],
        providerIds: [],
        serviceIds: [],
        controllerIds: [],
        workerIds: [],
        workerTriggerIds: [],
        exportKeys: [],
      },
    ],
    providers: [
      {
        id: "token:audit",
        tokenKey: "audit",
        kind: "value" as const,
        scope: "singleton" as const,
        depTokenKeys: [],
        moduleId: "module:feature",
      },
    ],
    services: [
      {
        id: "service:feature/audit",
        moduleId: "module:feature",
        key: "audit",
        name: "audit-service",
        depTokenKeys: ["audit"],
        actionIds: ["action:feature/audit/write"],
      },
    ],
    actions: [
      {
        id: "action:feature/audit/write",
        serviceId: "service:feature/audit",
        name: "write",
      },
    ],
    controllers: [
      {
        id: "controller:feature/audit-http",
        moduleId: "module:feature",
        name: "audit-http",
        basePath: "/audit",
        depTokenKeys: ["audit"],
        routeIds: ["route:feature/audit-http/write"],
      },
    ],
    routes: [
      {
        id: "route:feature/audit-http/write",
        controllerId: "controller:feature/audit-http",
        name: "write",
        method: "POST",
        path: "/",
        fullPath: "/audit",
        tags: [],
      },
    ],
    workers: [
      {
        id: "worker:feature/audit-worker",
        moduleId: "module:feature",
        name: "audit-worker",
        depTokenKeys: ["audit"],
        hasPartitionKey: false,
        hasIdempotencyKey: false,
      },
    ],
    workerTriggers: [
      {
        id: "worker-trigger:feature/audit-dispatch",
        moduleId: "module:feature",
        name: "audit-dispatch",
        workerId: "worker:feature/audit-worker",
        trigger: "dispatch",
        adapter: "queue",
        tags: ["audit"],
        hasPartitionKey: false,
        hasIdempotencyKey: false,
      },
    ],
  };

  expect(selectModuleGraph(graph)).toEqual({
    nodes: graph.modules,
    edges: [
      {
        from: "module:root",
        to: "module:feature",
      },
    ],
  });
  expect(selectProviderGraph(graph)).toEqual({
    nodes: graph.providers,
    edges: [],
  });
  expect(selectTokenRegistry(graph)).toEqual([
    {
      tokenKey: "audit",
      providerId: "token:audit",
      moduleId: "module:feature",
      aliasToTokenKey: undefined,
    },
  ]);
  expect(selectControllerRouteMap(graph)).toEqual([
    {
      controller: graph.controllers[0]!,
      routes: [...graph.routes],
    },
  ]);
  expect(selectWorkerRegistry(graph)).toEqual(graph.workers);
  expect(selectWorkerTriggerRegistry(graph)).toEqual(graph.workerTriggers);
});
