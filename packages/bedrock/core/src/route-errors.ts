import {
  bootError,
  bedrockError,
  isBedrockError,
  routeContractError,
  type DomainErrorDescriptor,
  type BedrockError,
  type HttpErrorDescriptor,
} from "@bedrock/common";
import { z } from "zod";

import { freezeObject } from "./immutability";

type RouteErrorHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteErrorsConfig = Readonly<Record<string, HttpErrorDescriptor>>;

export type AppHttpRouteError = {
  code: string;
  status: number;
  description?: string;
  details?: z.ZodTypeAny;
  source: "declared" | "implicit";
};

export type NormalizedRouteErrorContract = {
  publicErrors: readonly AppHttpRouteError[];
  internalErrors: ReadonlyMap<string, AppHttpRouteError>;
  publicErrorsByCode: ReadonlyMap<string, AppHttpRouteError>;
};

type ImplicitRouteErrorDefinition = {
  code: string;
  status: number;
  description: string;
  include(method: RouteErrorHttpMethod): boolean;
};

const ALWAYS_INCLUDE_ERROR = () => true;
const NON_GET_ONLY_ERROR = (method: RouteErrorHttpMethod) => method !== "GET";

const implicitRouteErrorDefinitions = freezeObject([
  freezeObject({
    code: "BEDROCK_VALIDATION_ERROR",
    status: 400,
    description: "Validation error",
    include: ALWAYS_INCLUDE_ERROR,
  }),
  freezeObject({
    code: "BEDROCK_HTTP_UNSUPPORTED_MEDIA_TYPE",
    status: 415,
    description: "Unsupported media type",
    include: NON_GET_ONLY_ERROR,
  }),
  freezeObject({
    code: "BEDROCK_HTTP_INTERNAL_ERROR",
    status: 500,
    description: "Internal server error",
    include: ALWAYS_INCLUDE_ERROR,
  }),
  freezeObject({
    code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
    status: 500,
    description: "Route error contract violated",
    include: ALWAYS_INCLUDE_ERROR,
  }),
] satisfies readonly ImplicitRouteErrorDefinition[]);

const reservedRouteErrorDefinitions = new Map(
  implicitRouteErrorDefinitions.map((entry) => [entry.code, entry] as const),
);

export function normalizeRouteErrors(args: {
  routeId: string;
  method: RouteErrorHttpMethod;
  routeErrors?: RouteErrorsConfig;
  middlewareErrors?: readonly (RouteErrorsConfig | undefined)[];
  domainErrors?: readonly DomainErrorDescriptor[];
  requireRouteLocalMappings: boolean;
}): NormalizedRouteErrorContract {
  const internalErrors = new Map<string, AppHttpRouteError>();
  const publicErrorsByCode = new Map<string, AppHttpRouteError>();
  const domainErrors = args.domainErrors ?? [];
  const routeErrors = args.routeErrors;

  if (args.requireRouteLocalMappings && domainErrors.length > 0 && routeErrors === undefined) {
    throw bootError(
      `Controller route "${args.routeId}" must declare errors for all action domain errors.`,
      {
        routeId: args.routeId,
      },
    );
  }

  if (args.requireRouteLocalMappings && routeErrors !== undefined) {
    const declaredCodes = new Set(Object.keys(routeErrors));

    for (const descriptor of domainErrors) {
      if (!declaredCodes.has(descriptor.code)) {
        throw bootError(
          `Controller route "${args.routeId}" is missing an HTTP mapping for domain error "${descriptor.code}".`,
          {
            routeId: args.routeId,
            code: descriptor.code,
          },
        );
      }
    }
  }

  mergeDeclaredErrors(args.routeId, routeErrors, internalErrors, publicErrorsByCode);

  for (const middlewareErrors of args.middlewareErrors ?? []) {
    mergeDeclaredErrors(
      args.routeId,
      middlewareErrors,
      internalErrors,
      publicErrorsByCode,
    );
  }

  for (const definition of implicitRouteErrorDefinitions) {
    if (!definition.include(args.method) || publicErrorsByCode.has(definition.code)) {
      continue;
    }

    publicErrorsByCode.set(
      definition.code,
      freezeObject({
        code: definition.code,
        status: definition.status,
        description: definition.description,
        source: "implicit" as const,
      }),
    );
  }

  return freezeObject({
    publicErrors: freezeObject([...publicErrorsByCode.values()]),
    internalErrors,
    publicErrorsByCode,
  });
}

export function mapDomainErrorToBedrockError(args: {
  routeId: string;
  contract: NormalizedRouteErrorContract;
  error: unknown;
  allowedInternalCodes?: ReadonlySet<string>;
}): BedrockError {
  if (
    !isRecord(args.error) ||
    args.error.kind !== "domain-error" ||
    typeof args.error.code !== "string"
  ) {
    return routeContractError();
  }

  if (
    args.allowedInternalCodes !== undefined &&
    !args.allowedInternalCodes.has(args.error.code)
  ) {
    return routeContractError();
  }

  const routeError = args.contract.internalErrors.get(args.error.code);

  if (!routeError) {
    return routeContractError();
  }

  const details = parseRouteErrorDetails({
    routeId: args.routeId,
    code: routeError.code,
    schema: routeError.details,
    value: args.error.details,
    allowUndeclaredDetails: isReservedBedrockRouteError(routeError.code),
  });

  if (!details.ok) {
    return routeContractError();
  }

  return bedrockError({
    message: routeError.description ?? "Error",
    code: routeError.code,
    status: routeError.status,
    details: details.value,
  });
}

export function mapPublicHttpErrorToBedrockError(args: {
  routeId: string;
  contract: NormalizedRouteErrorContract;
  error: unknown;
  allowedPublicCodes?: ReadonlySet<string>;
}): BedrockError {
  if (
    !isRecord(args.error) ||
    args.error.kind !== "http-error" ||
    typeof args.error.code !== "string" ||
    !Number.isInteger(args.error.status)
  ) {
    return routeContractError();
  }

  if (
    args.allowedPublicCodes !== undefined &&
    !args.allowedPublicCodes.has(args.error.code)
  ) {
    return routeContractError();
  }

  const routeError = args.contract.publicErrorsByCode.get(args.error.code);

  if (!routeError || routeError.status !== args.error.status) {
    return routeContractError();
  }

  const details = parseRouteErrorDetails({
    routeId: args.routeId,
    code: routeError.code,
    schema: routeError.details,
    value: args.error.details,
    allowUndeclaredDetails: isReservedBedrockRouteError(routeError.code),
  });

  if (!details.ok) {
    return routeContractError();
  }

  return bedrockError({
    message: routeError.description ?? "Error",
    code: routeError.code,
    status: routeError.status,
    details: details.value,
  });
}

export function enforceRouteErrorContract(args: {
  error: unknown;
  contract: NormalizedRouteErrorContract;
}): unknown {
  if (!isBedrockError(args.error)) {
    return args.error;
  }

  const error = args.error;

  if (error.code === "BEDROCK_ACTION_CONTRACT_ERROR" || isOutputValidationError(error)) {
    return routeContractError();
  }

  if (error.code === "BEDROCK_VALIDATION_ERROR") {
    return error;
  }

  const matchedError = args.contract.publicErrorsByCode.get(error.code);

  if (!matchedError) {
    return routeContractError();
  }

  if (getEffectiveErrorStatus(error) !== matchedError.status) {
    return routeContractError();
  }

  if (isReservedBedrockRouteError(matchedError.code)) {
    return error;
  }

  const details = parseRouteErrorDetails({
    routeId: "unknown",
    code: matchedError.code,
    schema: matchedError.details,
    value: error.details,
    allowUndeclaredDetails: false,
  });

  if (!details.ok) {
    return routeContractError();
  }

  if (details.value === error.details) {
    return error;
  }

  return bedrockError({
    message: error.message,
    code: error.code,
    status: error.status,
    details: details.value,
  });
}

function mergeDeclaredErrors(
  routeId: string,
  errors: RouteErrorsConfig | undefined,
  internalErrors: Map<string, AppHttpRouteError>,
  publicErrorsByCode: Map<string, AppHttpRouteError>,
): void {
  for (const [internalCode, httpError] of Object.entries(errors ?? {})) {
    const normalized = normalizeDeclaredRouteError(routeId, httpError);
    const existingInternal = internalErrors.get(internalCode);

    if (existingInternal) {
      assertSamePublicError(routeId, internalCode, existingInternal, normalized);
    } else {
      internalErrors.set(internalCode, normalized);
    }

    const existingPublic = publicErrorsByCode.get(normalized.code);

    if (existingPublic) {
      assertSamePublicError(routeId, normalized.code, existingPublic, normalized);
      continue;
    }

    publicErrorsByCode.set(normalized.code, normalized);
  }
}

function normalizeDeclaredRouteError(
  routeId: string,
  error: HttpErrorDescriptor,
): AppHttpRouteError {
  if (!isHttpErrorDescriptor(error)) {
    throw bootError(
      `Controller route "${routeId}" declares a non-HTTP error descriptor.`,
      {
        routeId,
      },
    );
  }

  const reservedDefinition = reservedRouteErrorDefinitions.get(error.code);
  if (reservedDefinition) {
    if (error.status !== reservedDefinition.status) {
      throw bootError(
        `Controller route "${routeId}" must use status ${reservedDefinition.status} for reserved error "${error.code}".`,
        {
          routeId,
          code: error.code,
          status: error.status,
          expectedStatus: reservedDefinition.status,
        },
      );
    }

    if (error.details !== undefined) {
      throw bootError(
        `Controller route "${routeId}" must not declare details for reserved error "${error.code}".`,
        {
          routeId,
          code: error.code,
        },
      );
    }
  }

  return freezeObject({
    code: error.code,
    status: error.status,
    description: error.description,
    details: error.details,
    source: "declared" as const,
  });
}

function assertSamePublicError(
  routeId: string,
  code: string,
  existing: AppHttpRouteError,
  next: AppHttpRouteError,
): void {
  if (
    existing.code !== next.code ||
    existing.status !== next.status ||
    existing.description !== next.description ||
    existing.details !== next.details
  ) {
    throw bootError(
      `Controller route "${routeId}" declares conflicting HTTP error mapping for "${code}".`,
      {
        routeId,
        code,
      },
    );
  }
}

function parseRouteErrorDetails(args: {
  routeId: string;
  code: string;
  schema: z.ZodTypeAny | undefined;
  value: unknown;
  allowUndeclaredDetails: boolean;
}):
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    } {
  if (!args.schema) {
    if (args.allowUndeclaredDetails) {
      return { ok: true, value: args.value };
    }

    return args.value === undefined ? { ok: true, value: undefined } : { ok: false };
  }

  const parsed = args.schema.safeParse(args.value);
  if (!parsed.success) {
    return { ok: false };
  }

  return {
    ok: true,
    value: parsed.data,
  };
}

function isHttpErrorDescriptor(value: unknown): value is HttpErrorDescriptor {
  return (
    isRecord(value) &&
    value.kind === "http-error" &&
    typeof value.code === "string" &&
    Number.isInteger(value.status) &&
    (value.details === undefined || value.details instanceof z.ZodType)
  );
}

function isReservedBedrockRouteError(code: string): boolean {
  return reservedRouteErrorDefinitions.has(code);
}

function getEffectiveErrorStatus(error: BedrockError): number {
  return error.status ?? 500;
}

function isOutputValidationError(error: BedrockError): boolean {
  return (
    error.code === "BEDROCK_VALIDATION_ERROR" &&
    isRecord(error.details) &&
    error.details.stage === "output"
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
