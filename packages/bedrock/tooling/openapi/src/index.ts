import {
  bedrockError,
  inspectHttpRoutes,
  type AppDescriptor,
  type AppHttpRoute,
  type AppHttpRouteError,
} from "@bedrock/core";
import { z } from "zod";

type OpenApiOperationMethod = "get" | "post" | "put" | "patch" | "delete";
type OpenApiParameterLocation = "path" | "query" | "header" | "cookie";
type OpenApiSchemaObject = Record<string, unknown>;

type OpenApiMediaTypeObject = {
  schema: OpenApiSchemaObject;
  "x-bedrock-sse-schema"?: OpenApiSchemaObject;
};

export type OpenApiInfoObject = {
  title: string;
  version: string;
  description?: string;
};

export type OpenApiServerObject = {
  url: string;
  description?: string;
};

export type OpenApiTagObject = {
  name: string;
  description?: string;
};

export type OpenApiParameterObject = {
  name: string;
  in: OpenApiParameterLocation;
  required?: boolean;
  description?: string;
  schema: OpenApiSchemaObject;
};

export type OpenApiHeaderObject = {
  required?: boolean;
  description?: string;
  schema: OpenApiSchemaObject;
};

export type OpenApiRequestBodyObject = {
  required?: boolean;
  content: Record<string, OpenApiMediaTypeObject>;
};

export type OpenApiResponseObject = {
  description: string;
  headers?: Record<string, OpenApiHeaderObject>;
  content?: Record<string, OpenApiMediaTypeObject>;
};

export type OpenApiOperationObject = {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
  parameters?: readonly OpenApiParameterObject[];
  requestBody?: OpenApiRequestBodyObject;
  responses: Record<string, OpenApiResponseObject>;
};

export type OpenApiPathItemObject = Partial<
  Record<OpenApiOperationMethod, OpenApiOperationObject>
>;

export type OpenApiDocument = {
  openapi: string;
  info: OpenApiInfoObject;
  servers?: readonly OpenApiServerObject[];
  tags?: readonly OpenApiTagObject[];
  paths: Record<string, OpenApiPathItemObject>;
};

export type OpenApiDocumentOptions = {
  info: OpenApiInfoObject;
  openapi?: string;
  servers?: readonly OpenApiServerObject[];
  excludePaths?: readonly string[];
  excludeTags?: readonly string[];
};

export function generateOpenApiDocument(
  app: AppDescriptor,
  options: OpenApiDocumentOptions,
): OpenApiDocument {
  const routes = inspectHttpRoutes(app);
  const excludedPaths = new Set(options.excludePaths ?? []);
  const excludedTags = new Set(options.excludeTags ?? []);
  const paths: Record<string, OpenApiPathItemObject> = {};
  const tagNames = new Set<string>();

  for (const route of routes) {
    const pathKey = toOpenApiPath(route.fullPath);

    if (shouldExcludeRoute(route, pathKey, excludedPaths, excludedTags)) {
      continue;
    }

    const method = route.method.toLowerCase() as OpenApiOperationMethod;
    const pathItem = paths[pathKey] ?? {};
    pathItem[method] = buildOperation(route);
    paths[pathKey] = pathItem;

    for (const tag of route.tags) {
      tagNames.add(tag);
    }
  }

  const tags =
    tagNames.size === 0
      ? undefined
      : [...tagNames].sort().map((name) => ({
          name,
        }));

  return {
    openapi: options.openapi ?? "3.0.3",
    info: options.info,
    servers: options.servers,
    tags,
    paths,
  };
}

function shouldExcludeRoute(
  route: AppHttpRoute,
  pathKey: string,
  excludedPaths: ReadonlySet<string>,
  excludedTags: ReadonlySet<string>,
): boolean {
  if (excludedPaths.has(pathKey)) {
    return true;
  }

  return route.tags.some((tag) => excludedTags.has(tag));
}

function buildOperation(route: AppHttpRoute): OpenApiOperationObject {
  const parameters = [
    ...buildParameters(route, "path", route.request.params),
    ...buildParameters(route, "query", route.request.query),
    ...buildParameters(route, "header", route.request.headers),
    ...buildParameters(route, "cookie", route.request.cookies),
  ];

  return {
    operationId: route.id,
    summary: route.summary,
    description: route.description,
    tags: route.tags.length === 0 ? undefined : route.tags,
    parameters: parameters.length === 0 ? undefined : parameters,
    requestBody: buildRequestBody(route),
    responses: {
      ...buildSuccessResponses(route),
      ...buildErrorResponses(route),
    },
  };
}

function buildParameters(
  route: AppHttpRoute,
  location: OpenApiParameterLocation,
  schema: z.ZodTypeAny | undefined,
): OpenApiParameterObject[] {
  if (!schema) {
    return [];
  }

  if (!(schema instanceof z.ZodObject)) {
    throw openApiError(
      `Route "${route.id}" must use an object schema for ${location} parameters.`,
      {
        routeId: route.id,
        location,
      },
    );
  }

  return Object.entries(schema.shape).map(([name, valueSchema]) => {
    const parameterSchema = toOpenApiSchema(valueSchema, {
      routeId: route.id,
      stage: "input",
      section: location,
      name,
    });

    return {
      name,
      in: location,
      required: location === "path" ? true : !valueSchema.isOptional(),
      description:
        typeof parameterSchema.description === "string"
          ? parameterSchema.description
          : undefined,
      schema: parameterSchema,
    };
  });
}

function buildRequestBody(route: AppHttpRoute): OpenApiRequestBodyObject | undefined {
  const body = route.request.body;

  if (!body) {
    return undefined;
  }

  return {
    required: !body.schema.isOptional(),
    content: {
      [contentTypeForRequestKind(body.kind)]: {
        schema: toOpenApiSchema(body.schema, {
          routeId: route.id,
          stage: "input",
          section: "body",
          kind: body.kind,
        }),
      },
    },
  };
}

function buildSuccessResponses(
  route: AppHttpRoute,
): Record<string, OpenApiResponseObject> {
  return Object.fromEntries(
    Object.entries(route.responses).map(([status, descriptor]) => [
      status,
      buildSuccessResponse(route, Number(status), descriptor),
    ]),
  );
}

function buildSuccessResponse(
  route: AppHttpRoute,
  status: number,
  descriptor: AppHttpRoute["responses"][number],
): OpenApiResponseObject {
  switch (descriptor.kind) {
    case "json":
      return {
        description: "Success",
        content: {
          "application/json": {
            schema: toOpenApiSchema(descriptor.schema, {
              routeId: route.id,
              stage: "output",
              section: "response",
              status,
            }),
          },
        },
      };
    case "text":
      return {
        description: "Success",
        content: {
          "text/plain": {
            schema: toOpenApiSchema(descriptor.schema, {
              routeId: route.id,
              stage: "output",
              section: "response",
              status,
            }),
          },
        },
      };
    case "binary":
      return {
        description: "Success",
        content: {
          "application/octet-stream": {
            schema: toOpenApiSchema(descriptor.schema, {
              routeId: route.id,
              stage: "output",
              section: "response",
              status,
            }),
          },
        },
      };
    case "empty":
      return {
        description: "Success",
      };
    case "sse":
      return {
        description: "Success",
        content: {
          "text/event-stream": {
            schema: {
              type: "string",
            },
            "x-bedrock-sse-schema": toOpenApiSchema(descriptor.schema, {
              routeId: route.id,
              stage: "output",
              section: "sse",
              status,
            }),
          },
        },
      };
    case "redirect":
      return {
        description: "Redirect",
        headers: {
          Location: {
            required: true,
            schema: {
              type: "string",
            },
          },
        },
      };
    case "raw":
      return {
        description: "Success",
        content: {
          [descriptor.contentType ?? "application/octet-stream"]: {
            schema: {
              type: "string",
              format: "binary",
            },
          },
        },
      };
    default:
      throw openApiError("Unsupported response descriptor.", {
        routeId: route.id,
        status,
      });
  }
}

function buildErrorResponses(route: AppHttpRoute): Record<string, OpenApiResponseObject> {
  const groupedErrors = new Map<string, AppHttpRouteError[]>();

  for (const error of route.errors) {
    const status = String(error.status);
    const existing = groupedErrors.get(status);

    if (existing) {
      existing.push(error);
      continue;
    }

    groupedErrors.set(status, [error]);
  }

  return Object.fromEntries(
    [...groupedErrors.entries()].map(([status, errors]) => [
      status,
      buildErrorResponse(route, errors),
    ]),
  );
}

function buildErrorResponse(
  route: AppHttpRoute,
  errors: readonly AppHttpRouteError[],
): OpenApiResponseObject {
  if (errors.length === 1) {
    const error = errors[0]!;

    return {
      description: error.description ?? "Error",
      content: {
        "application/json": {
          schema: buildErrorSchema(route, error),
        },
      },
    };
  }

  return {
    description: `Possible error codes: ${errors.map((error) => error.code).join(", ")}`,
    content: {
      "application/json": {
        schema: {
          oneOf: errors.map((error) => buildErrorSchema(route, error)),
        },
      },
    },
  };
}

function buildErrorSchema(
  route: AppHttpRoute,
  error: AppHttpRouteError,
): OpenApiSchemaObject {
  const errorProperties: Record<string, unknown> = {
    code: {
      type: "string",
      enum: [error.code],
    },
    message: {
      type: "string",
    },
  };

  if (error.details) {
    errorProperties.details = toOpenApiSchema(error.details, {
      routeId: route.id,
      stage: "output",
      section: "error-details",
      code: error.code,
    });
  }

  return {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: errorProperties,
      },
    },
  };
}

function toOpenApiSchema(
  schema: z.ZodTypeAny,
  details: Record<string, unknown>,
): OpenApiSchemaObject {
  try {
    return sanitizeOpenApiSchema(
      z.toJSONSchema(schema, {
        target: "openapi-3.0",
        io: details.stage === "input" ? "input" : "output",
        reused: "inline",
        cycles: "throw",
        unrepresentable: "any",
      }) as Record<string, unknown>,
    );
  } catch (error) {
    throw openApiError("Failed to convert a route schema to OpenAPI.", {
      ...details,
      cause: error,
    });
  }
}

function sanitizeOpenApiSchema(schema: Record<string, unknown>): OpenApiSchemaObject {
  const normalized = stripSchemaMetadata(schema);

  if (!isRecord(normalized)) {
    throw openApiError("OpenAPI schema conversion produced a non-object result.");
  }

  return normalized;
}

function stripSchemaMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSchemaMetadata(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (key === "~standard" || key === "$schema") {
      continue;
    }

    result[key] = stripSchemaMetadata(entry);
  }

  return result;
}

function contentTypeForRequestKind(kind: string): string {
  switch (kind) {
    case "json":
      return "application/json";
    case "formData":
      return "multipart/form-data";
    case "urlEncoded":
      return "application/x-www-form-urlencoded";
    case "text":
      return "text/plain";
    case "binary":
      return "application/octet-stream";
    default:
      throw openApiError("Unsupported request body descriptor.", {
        kind,
      });
  }
}

function toOpenApiPath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      segment.startsWith(":") && segment.length > 1 ? `{${segment.slice(1)}}` : segment,
    )
    .join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function openApiError(message: string, details?: unknown) {
  return bedrockError({
    message,
    code: "BEDROCK_OPENAPI_ERROR",
    details,
  });
}
