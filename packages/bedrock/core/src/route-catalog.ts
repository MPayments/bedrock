import type { HttpMethod } from "./controller";
import {
  normalizeHttpRequestBodyDescriptor,
  normalizeHttpResponseDescriptor,
  type HttpRequestBodyDescriptor,
  type HttpRequestSpec,
  type HttpResponseDescriptor,
  type HttpSuccessResponses,
} from "./http";
import type { AppHttpRouteError } from "./route-errors";
import { compileApp } from "./runtime/compile";
import type { AppDescriptor } from "./runtime/types";

export type AppHttpRoute = {
  id: string;
  moduleId: string;
  moduleName: string;
  controllerId: string;
  controllerName: string;
  routeName: string;
  method: HttpMethod;
  path: string;
  fullPath: string;
  summary?: string;
  description?: string;
  tags: readonly string[];
  request: Omit<HttpRequestSpec, "body"> & {
    body?: HttpRequestBodyDescriptor<any, any>;
  };
  responses: Record<number, HttpResponseDescriptor<any, any>>;
  errors: readonly AppHttpRouteError[];
};

export function inspectHttpRoutes(def: AppDescriptor): AppHttpRoute[] {
  const compiled = compileApp(def);

  return compiled.controllerRecords.flatMap((controllerRecord) =>
    controllerRecord.routes.map((routeRecord) => ({
      id: routeRecord.id,
      moduleId: controllerRecord.moduleId,
      moduleName: controllerRecord.moduleName,
      controllerId: controllerRecord.id,
      controllerName: controllerRecord.descriptor.name,
      routeName: routeRecord.name,
      method: routeRecord.descriptor.method,
      path: routeRecord.path,
      fullPath: routeRecord.fullPath,
      summary: routeRecord.summary,
      description: routeRecord.description,
      tags: routeRecord.tags,
      request: normalizeRequestSpec(routeRecord.descriptor.request),
      responses: normalizeResponses(routeRecord.descriptor.responses),
      errors: routeRecord.errorContract.publicErrors,
    })),
  );
}

function normalizeRequestSpec(
  request: HttpRequestSpec | undefined,
): AppHttpRoute["request"] {
  return {
    params: request?.params,
    query: request?.query,
    headers: request?.headers,
    cookies: request?.cookies,
    body: normalizeHttpRequestBodyDescriptor(request?.body),
  };
}

function normalizeResponses(
  responses: HttpSuccessResponses,
): Record<number, HttpResponseDescriptor<any, any>> {
  return Object.fromEntries(
    Object.entries(responses).map(([status, descriptor]) => [
      Number(status),
      normalizeHttpResponseDescriptor(descriptor as never),
    ]),
  );
}
