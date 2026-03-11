import {
  actionContractError,
  dependencyResolutionError,
  error as createHandlerErrorResult,
  isErrorResult,
  isBedrockError,
  type DomainErrorDescriptor,
  type DomainErrorInstance,
  type Ok,
  type Err,
} from "@bedrock/common";
import { z } from "zod";

import type {
  InferActionInput,
  InferActionResult,
  ServiceCall,
  ServiceActionHandle,
} from "../service";
import { isNoInputSchema } from "../service";
import { resolveServiceBinding } from "./scope";
import { parseWithSchema } from "./support";
import type { CompiledApp, ExecutionScope, StartedApp } from "./types";

export async function executeServiceAction<
  TAction extends ServiceActionHandle<any, any, z.ZodUndefined, any, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  scope: ExecutionScope | undefined,
  action: TAction,
): Promise<InferActionResult<TAction>>;

export async function executeServiceAction<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  scope: ExecutionScope | undefined,
  action: TAction,
  input: InferActionInput<TAction>,
): Promise<InferActionResult<TAction>>;

export async function executeServiceAction<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
>(
  compiled: CompiledApp,
  started: StartedApp,
  scope: ExecutionScope | undefined,
  action: TAction,
  input?: InferActionInput<TAction>,
): Promise<InferActionResult<TAction>> {
  const record = compiled.serviceRecordByDescriptor.get(action.service as object);

  if (!record) {
    throw dependencyResolutionError(
      `Service "${action.service.name}" is not registered in this app.`,
      { serviceName: action.service.name },
    );
  }

  const binding = await resolveServiceBinding(compiled, started, record, scope);
  const actionDef = binding.record.descriptor.actions[action.name];

  if (!actionDef) {
    throw actionContractError(
      `Action "${action.name}" is not defined on service "${binding.record.id}".`,
      { actionName: action.name, serviceId: binding.record.id },
    );
  }

  const actionId = `${binding.record.id}/${action.name}`;
  const parsedInput = await parseWithSchema(
    actionDef.input,
    input,
    `Invalid input for "${actionId}".`,
    {
      actionId,
      stage: "input",
    },
  );

  let result: unknown;

  try {
    result = await actionDef.handler(
      (isNoInputSchema(actionDef.input)
        ? {
            ctx: binding.context,
            error: createHandlerErrorResult,
          }
        : {
            ctx: binding.context,
            input: parsedInput,
            error: createHandlerErrorResult,
          }) as never,
    );
  } catch (error) {
    if (isThrownDeclaredDomainFailure(error, actionDef.errors)) {
      throw actionContractError(
        `Action "${actionId}" threw a declared domain error instead of returning Result.Err.`,
        {
          actionId,
          code: getThrownErrorCode(error),
        },
      );
    }

    throw error;
  }

  return normalizeActionResult(actionDef, result, actionId) as Promise<
    InferActionResult<TAction>
  >;
}

export function createServiceCall(
  compiled: CompiledApp,
  started: StartedApp,
  scope: ExecutionScope,
): ServiceCall {
  return ((
    action: ServiceActionHandle<any, any, any, any, any>,
    input?: unknown,
  ) => {
    if (action.input instanceof z.ZodUndefined) {
      return executeServiceAction(
        compiled,
        started,
        scope,
        action as ServiceActionHandle<any, any, z.ZodUndefined, any, any>,
      );
    }

    return executeServiceAction(compiled, started, scope, action, input as never);
  }) as ServiceCall;
}

async function normalizeActionResult(
  action: ServiceActionHandle<any, string, z.ZodTypeAny, z.ZodTypeAny, any>,
  result: unknown,
  actionId: string,
): Promise<InferActionResult<typeof action>> {
  if (!isErrorResult(result)) {
    const value = await parseWithSchema(
      action.output,
      result,
      `Invalid output for "${actionId}".`,
      {
        actionId,
        stage: "output",
      },
    );

    return createResultSuccess(value) as InferActionResult<typeof action>;
  }

  const error = await normalizeDomainErrorInstance(actionId, action.errors, result.error);
  const descriptor = action.errors.find(
    (entry: DomainErrorDescriptor) => entry.code === error.code,
  );

  if (!descriptor) {
    throw actionContractError(
      `Action "${actionId}" returned undeclared domain error "${error.code}".`,
      {
        actionId,
        code: error.code,
      },
    );
  }

  return createResultFailure(descriptor, error.details) as InferActionResult<
    typeof action
  >;
}

async function normalizeDomainErrorInstance(
  actionId: string,
  descriptors: readonly DomainErrorDescriptor[],
  value: unknown,
): Promise<{
  code: string;
  details: unknown;
}> {
  if (!isRecord(value) || value.kind !== "domain-error" || typeof value.code !== "string") {
    throw actionContractError(
      `Action "${actionId}" returned an invalid domain error payload.`,
      {
        actionId,
        error: value,
      },
    );
  }

  const descriptor = descriptors.find((entry) => entry.code === value.code);

  if (!descriptor) {
    throw actionContractError(
      `Action "${actionId}" returned undeclared domain error "${value.code}".`,
      {
        actionId,
        code: value.code,
      },
    );
  }

  const details = await parseErrorDetails({
    ownerId: actionId,
    code: descriptor.code,
    schema: descriptor.details,
    value: value.details,
    message: `Action "${actionId}" returned invalid details for domain error "${descriptor.code}".`,
  });

  return {
    code: descriptor.code,
    details,
  };
}

function createResultSuccess<T>(value: T): Ok<T> {
  return {
    ok: true,
    value,
  };
}

function createResultFailure<TDescriptor extends DomainErrorDescriptor>(
  descriptor: TDescriptor,
  details?: DomainErrorInstance<TDescriptor>["details"],
): Err<DomainErrorInstance<TDescriptor>> {
  return {
    ok: false,
    error: {
      kind: "domain-error",
      code: descriptor.code,
      details,
    } as DomainErrorInstance<TDescriptor>,
  };
}

async function parseErrorDetails(args: {
  ownerId: string;
  code: string;
  schema: z.ZodTypeAny | undefined;
  value: unknown;
  message: string;
}): Promise<unknown> {
  if (!args.schema) {
    if (args.value !== undefined) {
      throw actionContractError(args.message, {
        ownerId: args.ownerId,
        code: args.code,
      });
    }

    return undefined;
  }

  const parsed = await args.schema.safeParseAsync(args.value);

  if (!parsed.success) {
    throw actionContractError(args.message, {
      ownerId: args.ownerId,
      code: args.code,
      issues: parsed.error.issues,
    });
  }

  return parsed.data;
}

function isThrownDeclaredDomainFailure(
  error: unknown,
  descriptors: readonly DomainErrorDescriptor[],
): boolean {
  if (descriptors.length === 0) {
    return false;
  }

  const code = getThrownErrorCode(error);
  return code !== undefined && descriptors.some((descriptor) => descriptor.code === code);
}

function getThrownErrorCode(error: unknown): string | undefined {
  if (isBedrockError(error)) {
    return error.code;
  }

  if (isRecord(error) && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
