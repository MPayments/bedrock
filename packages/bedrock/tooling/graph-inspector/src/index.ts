import type {
  AppGraph,
  AppGraphControllerNode,
  AppGraphModuleNode,
  AppGraphProviderNode,
  AppGraphRouteNode,
  AppGraphWorkerTriggerNode,
  AppGraphWorkerNode,
} from "@bedrock/core";

export type GraphEdge = {
  from: string;
  to: string;
};

export function selectModuleGraph(graph: AppGraph): {
  nodes: readonly AppGraphModuleNode[];
  edges: readonly GraphEdge[];
} {
  return {
    nodes: graph.modules,
    edges: graph.modules.flatMap((moduleNode) =>
      moduleNode.importIds.map((importId) => ({
        from: moduleNode.id,
        to: importId,
      })),
    ),
  };
}

export function selectProviderGraph(graph: AppGraph): {
  nodes: readonly AppGraphProviderNode[];
  edges: readonly GraphEdge[];
} {
  const edges = graph.providers.flatMap((providerNode) =>
    providerNode.depTokenKeys.map((tokenKey) => ({
      from: providerNode.id,
      to: `token:${tokenKey}`,
    })),
  );

  return {
    nodes: graph.providers,
    edges,
  };
}

export function selectTokenRegistry(graph: AppGraph): Array<{
  tokenKey: string;
  providerId: string;
  moduleId?: string;
  aliasToTokenKey?: string;
}> {
  return [...graph.providers]
    .sort((left, right) => left.tokenKey.localeCompare(right.tokenKey))
    .map((providerNode) => ({
      tokenKey: providerNode.tokenKey,
      providerId: providerNode.id,
      moduleId: providerNode.moduleId,
      aliasToTokenKey: providerNode.aliasToTokenKey,
    }));
}

export function selectControllerRouteMap(graph: AppGraph): Array<{
  controller: AppGraphControllerNode;
  routes: AppGraphRouteNode[];
}> {
  const routesByControllerId = new Map<string, AppGraphRouteNode[]>();

  for (const routeNode of graph.routes) {
    const routes = routesByControllerId.get(routeNode.controllerId);
    if (routes) {
      routes.push(routeNode);
      continue;
    }

    routesByControllerId.set(routeNode.controllerId, [routeNode]);
  }

  return graph.controllers.map((controllerNode) => ({
    controller: controllerNode,
    routes: [...(routesByControllerId.get(controllerNode.id) ?? [])].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  }));
}

export function selectWorkerRegistry(graph: AppGraph): readonly AppGraphWorkerNode[] {
  return [...graph.workers].sort((left, right) => left.id.localeCompare(right.id));
}

export function selectWorkerTriggerRegistry(
  graph: AppGraph,
): readonly AppGraphWorkerTriggerNode[] {
  return [...graph.workerTriggers].sort((left, right) => left.id.localeCompare(right.id));
}
