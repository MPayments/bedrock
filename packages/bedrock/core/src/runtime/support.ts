import {
  adapterError,
  bootError,
  dependencyResolutionError,
  isBedrockError,
  scopeError,
  validationError,
  type BedrockError,
} from "@bedrock/common";
import { ZodError } from "zod";
import type { z } from "zod";

import { isBuiltInExecutionTokenKey } from "../execution-context";
import { getTokenKey, type AppGraph, type Token, type TokenMap } from "../kernel";
import type { Logger } from "../logging";
import type { AppInitContext } from "../module";
import type { ControllerMiddlewareDescriptor } from "../middleware";
import type { ProviderRecord } from "./types";
import type { ResolveTokenMap } from "./types";

export function getDepTokenKeys(deps?: TokenMap): string[] {
  return Object.values(deps ?? {}).map((tokenValue) => getTokenKey(tokenValue));
}

export function validateDepTokenKeys(
  depTokenKeys: readonly string[],
  providerByTokenKey: Map<string, ProviderRecord>,
  owner: string,
): void {
  for (const depTokenKey of depTokenKeys) {
    if (!providerByTokenKey.has(depTokenKey) && !isBuiltInExecutionTokenKey(depTokenKey)) {
      throw dependencyResolutionError(
        `${owner} depends on missing token "${depTokenKey}".`,
        {
          owner,
          depTokenKey,
        },
      );
    }
  }
}

export function deriveDescriptorContext<TCtx, TDeps extends TokenMap>(
  buildContext: ((deps: ResolveTokenMap<TDeps>, ...extras: any[]) => TCtx) | undefined,
  deps: ResolveTokenMap<TDeps>,
  ownerId: string,
  logger: Logger,
  ...extras: any[]
): (TCtx extends undefined ? ResolveTokenMap<TDeps> : TCtx) & { logger: Logger } {
  let context: unknown;

  try {
    context = buildContext ? buildContext(deps, ...extras) : deps;
  } catch (error) {
    throw wrapBootFailure(error, `Failed to derive execution context for "${ownerId}".`);
  }

  if (context === undefined) {
    return { logger } as (TCtx extends undefined ? ResolveTokenMap<TDeps> : TCtx) & {
      logger: Logger;
    };
  }

  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    throw bootError(`Execution context for "${ownerId}" must resolve to an object or undefined.`, {
      ownerId,
    });
  }

  if ("logger" in context) {
    throw bootError(
      `Execution context for "${ownerId}" cannot define reserved field "logger".`,
      {
        ownerId,
      },
    );
  }

  return {
    ...(context as Record<string, unknown>),
    logger,
  } as (TCtx extends undefined ? ResolveTokenMap<TDeps> : TCtx) & { logger: Logger };
}

export function validateReservedLoggerDepName(
  deps: TokenMap | undefined,
  owner: string,
): void {
  if (deps && Object.prototype.hasOwnProperty.call(deps, "logger")) {
    throw bootError(`${owner} cannot declare dependency key "logger"; use ctx.logger instead.`, {
      owner,
    });
  }
}

export function createAppInitContext(
  graph: AppGraph,
  providerValues: readonly unknown[],
  providerResolved: readonly boolean[],
  providerByTokenKey: ReadonlyMap<string, ProviderRecord>,
): AppInitContext {
  return {
    get<T>(tokenValue: Token<T>): T {
      const tokenKey = getTokenKey(tokenValue);
      const providerRecord = providerByTokenKey.get(tokenKey);

      if (!providerRecord) {
        throw dependencyResolutionError(
          `No provider is registered for token "${tokenKey}".`,
          { tokenKey },
        );
      }

      if (providerRecord.scope !== "singleton") {
        throw scopeError(
          `Token "${tokenKey}" cannot be resolved from app init context because it uses "${providerRecord.scope}" scope.`,
          {
            tokenKey,
            scope: providerRecord.scope,
          },
        );
      }

      if (!providerResolved[providerRecord.slot]) {
        throw dependencyResolutionError(
          `No singleton value is available for token "${tokenKey}".`,
          { tokenKey },
        );
      }

      return providerValues[providerRecord.slot] as T;
    },
    inspect() {
      return graph;
    },
  };
}

export async function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  message: string,
  details: Record<string, unknown>,
): Promise<z.output<TSchema>> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (isZodAsyncParseError(error)) {
      try {
        return await schema.parseAsync(value);
      } catch (asyncError) {
        if (asyncError instanceof ZodError) {
          throw validationError(message, {
            ...details,
            issues: asyncError.issues,
          });
        }

        throw asyncError;
      }
    }

    if (error instanceof ZodError) {
      throw validationError(message, {
        ...details,
        issues: error.issues,
      });
    }

    throw error;
  }
}

function isZodAsyncParseError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.constructor.name === "$ZodAsyncError" &&
    error.message === "Encountered Promise during synchronous parse. Use .parseAsync() instead."
  );
}

export async function runMiddleware<
  TArgs extends object,
  TMiddleware extends {
    run(args: object): Promise<TOutput> | TOutput;
  },
  TOutput,
>(
  args: TArgs,
  middleware: readonly TMiddleware[],
  handler: (args: TArgs) => Promise<TOutput> | TOutput,
  withNext: (
    middleware: TMiddleware,
    args: TArgs,
    next: () => Promise<TOutput>,
  ) => object,
): Promise<TOutput> {
  const dispatch = async (index: number): Promise<TOutput> => {
    const current = middleware[index];

    if (!current) {
      return Promise.resolve(handler(args));
    }

    return current.run(withNext(current, args, () => dispatch(index + 1)) as never) as Promise<
      TOutput
    >;
  };

  return dispatch(0);
}

export function joinHttpPath(...segments: Array<string | undefined>): string {
  const parts = segments.flatMap((segment) =>
    segment ? segment.split("/").filter(Boolean) : [],
  );

  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

export function wrapBootFailure(error: unknown, message: string): BedrockError {
  if (isBedrockError(error)) {
    return error;
  }

  return bootError(message, {
    cause: error,
  });
}

export function wrapAdapterFailure(error: unknown, message: string): BedrockError {
  if (isBedrockError(error)) {
    return error;
  }

  return adapterError(message, {
    cause: error,
  });
}
