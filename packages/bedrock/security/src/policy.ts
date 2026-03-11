import {
  error,
  type DomainErrorDescriptor,
  type DomainErrorInstance,
  type Err,
  type InferErrorDetails,
  type Result,
} from "@bedrock/core";

type MaybePromise<T> = T | Promise<T>;

type InferPolicyErrorUnion<
  TErrors extends readonly DomainErrorDescriptor[],
> = TErrors[number] extends infer TDescriptor
  ? TDescriptor extends DomainErrorDescriptor
    ? DomainErrorInstance<TDescriptor>
    : never
  : never;

export type PolicyDeny<TErrors extends readonly DomainErrorDescriptor[]> = <
  TDescriptor extends TErrors[number],
>(
  descriptor: TDescriptor,
  details?: InferErrorDetails<TDescriptor>,
) => Err<DomainErrorInstance<TDescriptor>>;

export type PolicyCheckArgs<
  TCtx,
  TInput,
  TErrors extends readonly DomainErrorDescriptor[],
> = {
  ctx: TCtx;
  input: TInput;
  deny: PolicyDeny<TErrors>;
};

export type PolicyDescriptor<
  TCtx = any,
  TInput = any,
  TErrors extends readonly DomainErrorDescriptor[] = readonly DomainErrorDescriptor[],
> = {
  kind: "policy";
  name: string;
  errors: readonly [...TErrors];
  check(
    args: PolicyCheckArgs<TCtx, TInput, TErrors>,
  ): MaybePromise<Result<void, InferPolicyErrorUnion<TErrors>>>;
};

export type InferPolicyError<
  TPolicy extends PolicyDescriptor<any, any, any>,
> = TPolicy extends PolicyDescriptor<any, any, infer TErrors>
  ? InferPolicyErrorUnion<TErrors>
  : never;

const EMPTY_POLICY_ERRORS = Object.freeze(
  [] as readonly DomainErrorDescriptor[],
);

export function definePolicy<
  TCtx,
  TInput,
  const TErrors extends readonly DomainErrorDescriptor[] = readonly [],
>(
  name: string,
  def: {
    errors?: readonly [...TErrors];
    check(
      args: PolicyCheckArgs<TCtx, TInput, TErrors>,
    ): MaybePromise<Result<void, InferPolicyErrorUnion<TErrors>>>;
  },
): PolicyDescriptor<TCtx, TInput, TErrors> {
  return Object.freeze({
    kind: "policy" as const,
    name,
    errors: Object.freeze([...(def.errors ?? EMPTY_POLICY_ERRORS)]) as readonly [
      ...TErrors,
    ],
    check: def.check,
  });
}

export function createPolicyDeny<
  TErrors extends readonly DomainErrorDescriptor[],
>(): PolicyDeny<TErrors> {
  return ((descriptor, details) => ({
    ok: false as const,
    error: error(descriptor, details).error,
  })) as PolicyDeny<TErrors>;
}
