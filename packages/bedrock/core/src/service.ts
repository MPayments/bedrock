import {
  type BivariantCallback,
  type DomainErrorDescriptor,
  type DomainErrorInstance,
  type ErrorResult,
  type InferErrorDetails,
  type MaybePromise,
  type Phantom,
  type Result,
  type Simplify,
} from "@bedrock/common";
import { z } from "zod";

import {
  cloneReadonlyArray,
  cloneReadonlyRecord,
  freezeObject,
} from "./immutability";
import type {
  ReservedLoggerContextGuard,
  ReservedLoggerDepGuard,
  WithAmbientLogger,
} from "./descriptor-types";
import type { ResolveTokenMap, TokenMap } from "./kernel";

type InferDomainErrorUnion<
  TErrors extends readonly DomainErrorDescriptor[],
> = TErrors[number] extends infer TDescriptor
  ? TDescriptor extends DomainErrorDescriptor
    ? DomainErrorInstance<TDescriptor>
    : never
  : never;

type ServiceActionActionResult<
  TOutputSchema extends z.ZodTypeAny,
  TErrors extends readonly DomainErrorDescriptor[],
> = z.output<TOutputSchema> | ErrorResult<InferDomainErrorUnion<TErrors>>;

type ServiceActionError<
  TErrors extends readonly DomainErrorDescriptor[],
> = <TDescriptor extends TErrors[number]>(
  descriptor: TDescriptor,
  details?: InferErrorDetails<TDescriptor>,
) => ErrorResult<DomainErrorInstance<TDescriptor>>;

type ServiceActionHandlerTools<
  TErrors extends readonly DomainErrorDescriptor[],
> = {
  error: ServiceActionError<TErrors>;
};

type PublicServiceActionHandler = BivariantCallback<any, MaybePromise<unknown>>;

export type ServiceActionHandlerArgs<
  TCtx,
  TInput = never,
  TErrors extends readonly DomainErrorDescriptor[] = readonly [],
> = [TInput] extends [never]
  ? { ctx: WithAmbientLogger<TCtx> } & ServiceActionHandlerTools<TErrors>
  : { ctx: WithAmbientLogger<TCtx>; input: TInput } & ServiceActionHandlerTools<TErrors>;

export type ServiceHookArgs<TCtx> = {
  ctx: WithAmbientLogger<TCtx>;
};

type ServiceActionHandlerArgsForSchema<
  TCtx,
  TInputSchema extends z.ZodTypeAny,
  TErrors extends readonly DomainErrorDescriptor[],
> = TInputSchema extends z.ZodUndefined
  ? ServiceActionHandlerArgs<
      TCtx,
      never,
      TErrors
    >
  : ServiceActionHandlerArgs<
      TCtx,
      z.output<TInputSchema>,
      TErrors
    >;

const NO_INPUT_SCHEMA = z.undefined();
const VOID_OUTPUT_SCHEMA = z.void();
const EMPTY_ACTION_ERRORS = freezeObject(
  [] as readonly DomainErrorDescriptor[],
);

type NormalizedInputSchema<TInputSchema extends z.ZodTypeAny | undefined> =
  TInputSchema extends z.ZodTypeAny ? TInputSchema : z.ZodUndefined;

type NormalizedOutputSchema<TOutputSchema extends z.ZodTypeAny | undefined> =
  TOutputSchema extends z.ZodTypeAny ? TOutputSchema : z.ZodVoid;

export type ServiceActionDefinition<
  TCtx,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TErrors extends readonly DomainErrorDescriptor[] = readonly [],
> = {
  input: TInputSchema;
  output: TOutputSchema;
  errors?: readonly [...TErrors];
  handler: PublicServiceActionHandler;
} & Phantom<TCtx>;

type ServiceActionConfig<
  TCtx,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
  TOutputSchema extends z.ZodTypeAny | undefined = undefined,
  TErrors extends readonly DomainErrorDescriptor[] = readonly [],
> = {
  input?: TInputSchema;
  output?: TOutputSchema;
  errors?: readonly [...TErrors];
  handler: BivariantCallback<
    ServiceActionHandlerArgsForSchema<
      TCtx,
      NormalizedInputSchema<TInputSchema>,
      NoInfer<TErrors>
    >,
    MaybePromise<
      ServiceActionActionResult<
        NormalizedOutputSchema<TOutputSchema>,
        NoInfer<TErrors>
      >
    >
  >;
};

type ServiceActionConfigWithoutErrors<
  TCtx,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
  TOutputSchema extends z.ZodTypeAny | undefined = undefined,
> = Omit<
  ServiceActionConfig<TCtx, TInputSchema, TOutputSchema, readonly []>,
  "errors"
> & {
  errors?: undefined;
};

type ServiceActionConfigWithErrors<
  TCtx,
  TInputSchema extends z.ZodTypeAny | undefined = undefined,
  TOutputSchema extends z.ZodTypeAny | undefined = undefined,
  TErrors extends readonly DomainErrorDescriptor[] = readonly [],
> = ServiceActionConfig<TCtx, TInputSchema, TOutputSchema, TErrors> & {
  errors: readonly [...TErrors];
};

type AnyServiceActionDefinition<TCtx = any> = ServiceActionDefinition<
  TCtx,
  any,
  any,
  readonly DomainErrorDescriptor[]
>;

type MaterializedServiceActionHandle<
  TService,
  TName extends string,
  TCtx,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TErrors extends readonly DomainErrorDescriptor[],
> = {
  kind: "service-action";
  service: TService;
  name: TName;
  input: TInputSchema;
  output: TOutputSchema;
  errors: TErrors;
  handler: PublicServiceActionHandler;
} & Phantom<TCtx>;

export type ServiceActionHandle<
  TService = ServiceDescriptor<any, any, any, any>,
  TName extends string = string,
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TErrors extends readonly DomainErrorDescriptor[] = readonly DomainErrorDescriptor[],
> = MaterializedServiceActionHandle<
  TService,
  TName,
  any,
  TInputSchema,
  TOutputSchema,
  TErrors
>;

export type InferActionInput<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = z.input<TAction["input"]>;

export type InferActionOutput<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = z.output<TAction["output"]>;

export type InferActionError<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = TAction["errors"][number] extends infer TDescriptor
  ? TDescriptor extends DomainErrorDescriptor
    ? DomainErrorInstance<TDescriptor>
    : never
  : never;

export type InferActionResult<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = Result<InferActionOutput<TAction>, InferActionError<TAction>>;

export type ServiceCall = {
  <const TAction extends ServiceActionHandle<any, any, any, any, any>>(
    ...args: TAction["input"] extends z.ZodUndefined
      ? [action: TAction, input?: never]
      : [action: TAction, input: InferActionInput<TAction>]
  ): Promise<InferActionResult<TAction>>;
};

export type ActionHasNoInput<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = TAction["input"] extends z.ZodUndefined ? true : false;

export type ActionHasVoidOutput<
  TAction extends ServiceActionHandle<any, any, any, any, any>,
> = TAction["output"] extends z.ZodVoid | z.ZodUndefined ? true : false;

export type ServiceActionMap = Record<
  string,
  ServiceActionHandle<any, any, z.ZodTypeAny, z.ZodTypeAny, any>
>;

export type ServiceActionBuilder<TCtx> = {
  action<
    TInputSchema extends z.ZodTypeAny | undefined = undefined,
    TOutputSchema extends z.ZodTypeAny | undefined = undefined,
  >(
    def: ServiceActionConfigWithoutErrors<TCtx, TInputSchema, TOutputSchema>,
  ): ServiceActionDefinition<
    TCtx,
    NormalizedInputSchema<TInputSchema>,
    NormalizedOutputSchema<TOutputSchema>,
    readonly []
  >;
  action<
    TInputSchema extends z.ZodTypeAny | undefined = undefined,
    TOutputSchema extends z.ZodTypeAny | undefined = undefined,
    const TErrors extends readonly DomainErrorDescriptor[] = readonly [],
  >(
    def: ServiceActionConfigWithErrors<TCtx, TInputSchema, TOutputSchema, TErrors>,
  ): ServiceActionDefinition<
    TCtx,
    NormalizedInputSchema<TInputSchema>,
    NormalizedOutputSchema<TOutputSchema>,
    TErrors
  >;
};

export type ServiceHooks<TCtx> = {
  onInit?: BivariantCallback<ServiceHookArgs<TCtx>, Promise<void> | void>;
  onDispose?: BivariantCallback<ServiceHookArgs<TCtx>, Promise<void> | void>;
};

type MaterializeServiceActions<
  TService,
  TCtx,
  TActions extends Record<string, AnyServiceActionDefinition<TCtx>>,
> = {
  [K in keyof TActions]: TActions[K] extends ServiceActionDefinition<
    TCtx,
    infer TInputSchema,
    infer TOutputSchema,
    infer TErrors
  >
    ? MaterializedServiceActionHandle<
        TService,
        Extract<K, string>,
        TCtx,
        TInputSchema,
        TOutputSchema,
        TErrors
      >
    : never;
};

export type ServiceDescriptor<
  TName extends string,
  TDeps extends TokenMap,
  TCtx,
  TActions extends Record<string, AnyServiceActionDefinition<TCtx>>,
> = {
  kind: "service";
  name: TName;
  deps?: TDeps;
  ctx?: (deps: ResolveTokenMap<TDeps>) => TCtx & ReservedLoggerContextGuard;
  actions: MaterializeServiceActions<
    ServiceDescriptor<TName, TDeps, TCtx, TActions>,
    TCtx,
    TActions
  >;
  hooks?: ServiceHooks<TCtx>;
};

export type ServiceDefinition<
  TDeps extends TokenMap,
  TCtx,
  TActions extends Record<string, AnyServiceActionDefinition<TCtx>>,
> = {
  deps?: TDeps & ReservedLoggerDepGuard;
  ctx?: (deps: ResolveTokenMap<TDeps>) => TCtx & ReservedLoggerContextGuard;
  actions: (builder: ServiceActionBuilder<TCtx>) => TActions;
  hooks?: ServiceHooks<TCtx>;
};

type ServiceDefinitionWithContext<
  TDeps extends TokenMap,
  TCtx,
  TActions extends Record<
    string,
    AnyServiceActionDefinition<TCtx>
  >,
> = {
  deps?: TDeps & ReservedLoggerDepGuard;
  ctx: (deps: ResolveTokenMap<TDeps>) => TCtx & ReservedLoggerContextGuard;
  actions: (builder: ServiceActionBuilder<TCtx>) => TActions;
  hooks?: ServiceHooks<TCtx>;
};

type ServiceDefinitionWithoutContext<
  TDeps extends TokenMap,
  TActions extends Record<
    string,
    AnyServiceActionDefinition<ResolveTokenMap<TDeps>>
  >,
> = {
  deps?: TDeps & ReservedLoggerDepGuard;
  ctx?: undefined;
  actions: (builder: ServiceActionBuilder<ResolveTokenMap<TDeps>>) => TActions;
  hooks?: ServiceHooks<ResolveTokenMap<TDeps>>;
};

export function defineService<
  TName extends string,
  TDeps extends TokenMap = {},
  TCtx = ResolveTokenMap<TDeps>,
  const TActions extends Record<
    string,
    AnyServiceActionDefinition<TCtx>
  > = Record<string, AnyServiceActionDefinition<TCtx>>,
>(
  name: TName,
  def: ServiceDefinitionWithContext<TDeps, TCtx, TActions>,
): ServiceDescriptor<TName, TDeps, TCtx, TActions>;

export function defineService<
  TName extends string,
  TDeps extends TokenMap = {},
  const TActions extends Record<
    string,
    AnyServiceActionDefinition<ResolveTokenMap<TDeps>>
  > = Record<string, AnyServiceActionDefinition<ResolveTokenMap<TDeps>>>,
>(
  name: TName,
  def: ServiceDefinitionWithoutContext<TDeps, TActions>,
): ServiceDescriptor<TName, TDeps, ResolveTokenMap<TDeps>, TActions>;

export function defineService<
  TName extends string,
  TDeps extends TokenMap = {},
  TCtx = ResolveTokenMap<TDeps>,
  const TActions extends Record<string, AnyServiceActionDefinition<TCtx>> = Record<
    string,
    AnyServiceActionDefinition<TCtx>
  >,
>(name: TName, def: ServiceDefinition<TDeps, TCtx, TActions>) {
  const actionDefinitions = def.actions(createServiceActionBuilder<TCtx>());

  const service = {
    kind: "service",
    name,
    deps: cloneReadonlyRecord(def.deps),
    ctx: def.ctx,
    hooks: cloneReadonlyRecord(def.hooks),
    actions: {} as MaterializeServiceActions<
      ServiceDescriptor<TName, TDeps, TCtx, TActions>,
      TCtx,
      TActions
    >,
  } as ServiceDescriptor<TName, TDeps, TCtx, TActions>;

  service.actions = materializeServiceActions(service, actionDefinitions);

  return freezeObject(service);
}

function createServiceActionBuilder<TCtx>(): ServiceActionBuilder<TCtx> {
  const action = <
    TInputSchema extends z.ZodTypeAny | undefined = undefined,
    TOutputSchema extends z.ZodTypeAny | undefined = undefined,
    const TErrors extends readonly DomainErrorDescriptor[] = readonly [],
  >(
    def: ServiceActionConfig<TCtx, TInputSchema, TOutputSchema, TErrors>,
  ): ServiceActionDefinition<
    TCtx,
    NormalizedInputSchema<TInputSchema>,
    NormalizedOutputSchema<TOutputSchema>,
    TErrors
  > => {
    const hasInput = "input" in def && def.input !== undefined;
    const hasOutput = "output" in def && def.output !== undefined;

    return freezeObject({
      input: (hasInput ? def.input : NO_INPUT_SCHEMA) as NormalizedInputSchema<TInputSchema>,
      output: (hasOutput
        ? def.output
        : VOID_OUTPUT_SCHEMA) as NormalizedOutputSchema<TOutputSchema>,
      errors: (cloneReadonlyArray(def.errors) ?? EMPTY_ACTION_ERRORS) as TErrors,
      handler: def.handler,
    }) as ServiceActionDefinition<
      TCtx,
      NormalizedInputSchema<TInputSchema>,
      NormalizedOutputSchema<TOutputSchema>,
      TErrors
    >;
  };

  return {
    action: action as ServiceActionBuilder<TCtx>["action"],
  };
}

function materializeServiceActions<
  TName extends string,
  TDeps extends TokenMap,
  TCtx,
  TActions extends Record<string, AnyServiceActionDefinition<TCtx>>,
>(
  service: ServiceDescriptor<TName, TDeps, TCtx, TActions>,
  actionDefinitions: TActions,
): MaterializeServiceActions<
  ServiceDescriptor<TName, TDeps, TCtx, TActions>,
  TCtx,
  TActions
> {
  const actions = {} as MaterializeServiceActions<
    ServiceDescriptor<TName, TDeps, TCtx, TActions>,
    TCtx,
    TActions
  >;

  for (const actionName of Object.keys(actionDefinitions) as Array<keyof TActions>) {
    actions[actionName] = materializeServiceAction(
      service,
      actionName,
      actionDefinitions[actionName],
    );
  }

  return freezeObject(actions);
}

function materializeServiceAction<
  TName extends string,
  TDeps extends TokenMap,
  TCtx,
  TActions extends Record<string, AnyServiceActionDefinition<TCtx>>,
  K extends keyof TActions,
>(
  service: ServiceDescriptor<TName, TDeps, TCtx, TActions>,
  actionName: K,
  actionDefinition: TActions[K],
): MaterializeServiceActions<
  ServiceDescriptor<TName, TDeps, TCtx, TActions>,
  TCtx,
  TActions
>[K] {
  return freezeObject({
    kind: "service-action",
    service,
    name: actionName,
    input: actionDefinition.input,
    output: actionDefinition.output,
    errors: (actionDefinition.errors ?? EMPTY_ACTION_ERRORS) as TActions[K]["errors"],
    handler: actionDefinition.handler,
  }) as MaterializeServiceActions<
    ServiceDescriptor<TName, TDeps, TCtx, TActions>,
    TCtx,
    TActions
  >[K];
}

export function isNoInputSchema(
  schema: z.ZodTypeAny,
): schema is z.ZodUndefined {
  return schema instanceof z.ZodUndefined;
}

export function isVoidOutputSchema(
  schema: z.ZodTypeAny,
): schema is z.ZodVoid | z.ZodUndefined {
  return schema instanceof z.ZodVoid || schema instanceof z.ZodUndefined;
}
