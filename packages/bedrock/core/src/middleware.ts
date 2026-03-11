import {
  type BivariantCallback,
  type ErrorResult,
  type HttpErrorDescriptor,
  type HttpErrorInstance,
  type InferErrorDetails,
  type MaybePromise,
} from "@bedrock/common";

import { freezeObject } from "./immutability";
import type {
  ControllerRouteMiddlewareArgs,
} from "./controller";
import type { HttpRequestSpec, HttpRouteOutput, HttpSuccessResponses } from "./http";
import type { RouteErrorsConfig } from "./route-errors";

type HttpErrorDescriptorUnion<TErrors extends RouteErrorsConfig> =
  TErrors[Extract<keyof TErrors, string>] extends infer TDescriptor
    ? TDescriptor extends HttpErrorDescriptor
      ? TDescriptor
      : never
    : never;

type InferHttpErrorUnion<TErrors extends RouteErrorsConfig> =
  HttpErrorDescriptorUnion<TErrors> extends infer TDescriptor
    ? TDescriptor extends HttpErrorDescriptor
      ? HttpErrorInstance<TDescriptor>
      : never
    : never;

type MiddlewareError<TErrors extends RouteErrorsConfig> = <
  TDescriptor extends HttpErrorDescriptorUnion<TErrors>,
>(
  descriptor: TDescriptor,
  details?: InferErrorDetails<TDescriptor>,
) => ErrorResult<HttpErrorInstance<TDescriptor>>;

export type ControllerMiddlewareDescriptor<
  TCtx = any,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
  TErrors extends RouteErrorsConfig = {},
> = {
  kind: "middleware";
  name: string;
  errors?: TErrors;
  run: BivariantCallback<
    ControllerRouteMiddlewareArgs<TCtx, TRequest, TResponses, TErrors>,
    MaybePromise<
      | HttpRouteOutput<TResponses>
      | ErrorResult<InferHttpErrorUnion<TErrors>>
      | unknown
    >
  >;
};

export function defineMiddleware<
  TCtx,
  TRequest extends HttpRequestSpec | undefined = HttpRequestSpec | undefined,
  TResponses extends HttpSuccessResponses = HttpSuccessResponses,
  const TErrors extends RouteErrorsConfig = {},
>(
  name: string,
  def: {
    errors?: TErrors;
    run: BivariantCallback<
      ControllerRouteMiddlewareArgs<TCtx, TRequest, TResponses, TErrors>,
      MaybePromise<
        | HttpRouteOutput<TResponses>
        | ErrorResult<InferHttpErrorUnion<TErrors>>
        | unknown
      >
    >;
  },
): ControllerMiddlewareDescriptor<TCtx, TRequest, TResponses, TErrors> {
  return freezeObject({
    kind: "middleware",
    name,
    errors: def.errors ? freezeObject({ ...def.errors }) : undefined,
    run: def.run,
  });
}

export type { MiddlewareError };
