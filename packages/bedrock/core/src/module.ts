import type { AppGraph, Token } from "./kernel";
import type { DefinedController } from "./controller";
import type { HttpMountDescriptor } from "./http";
import {
  cloneReadonlyArray,
  cloneReadonlyRecord,
  freezeObject,
} from "./immutability";
import type { Provider } from "./provider";
import type { ServiceDescriptor } from "./service";
import type { WorkerTriggerDescriptor } from "./worker-trigger";
import type { WorkerDescriptor } from "./worker";

export type AppInitContext = {
  get<T>(token: Token<T>): T;
  inspect(): AppGraph;
};

type AnyServiceDescriptor = ServiceDescriptor<string, any, any, any>;

export type ModuleServiceMap = Record<string, AnyServiceDescriptor>;

type ValidatedModuleServices<TServices extends ModuleServiceMap> = {
  [K in keyof TServices]: TServices[K] extends ServiceDescriptor<
    Extract<K, string>,
    any,
    any,
    any
  >
    ? TServices[K]
    : never;
};

export type ModuleDescriptor<
  TName extends string = string,
  TServices extends ModuleServiceMap = ModuleServiceMap,
  TControllers extends readonly DefinedController[] = readonly DefinedController[],
  TImports extends readonly ModuleDescriptor<any, any, any, any>[] = readonly ModuleDescriptor<
    any,
    any,
    any,
    any
  >[],
> = {
  kind: "module";
  name: TName;
  imports?: TImports;
  providers?: readonly Provider[];
  services?: ValidatedModuleServices<TServices>;
  controllers?: TControllers;
  httpMounts?: readonly HttpMountDescriptor[];
  workers?: readonly WorkerDescriptor<any, any, any, any>[];
  workerTriggers?: readonly WorkerTriggerDescriptor<any, any, any>[];
  exports?: Record<string, unknown>;
  hooks?: {
    onInit?: (ctx: AppInitContext) => Promise<void> | void;
    onDispose?: (ctx: AppInitContext) => Promise<void> | void;
  };
};

export type DefinedModule<
  TName extends string = string,
  TServices extends ModuleServiceMap = ModuleServiceMap,
  TControllers extends readonly DefinedController[] = readonly DefinedController[],
  TImports extends readonly ModuleDescriptor<any, any, any, any>[] = readonly ModuleDescriptor<
    any,
    any,
    any,
    any
  >[],
> = ModuleDescriptor<TName, TServices, TControllers, TImports>;

export type ModuleDefinition<
  TServices extends ModuleServiceMap = ModuleServiceMap,
  TControllers extends readonly DefinedController[] = readonly DefinedController[],
  TImports extends readonly ModuleDescriptor<any, any, any, any>[] = readonly ModuleDescriptor<
    any,
    any,
    any,
    any
  >[],
> = Omit<ModuleDescriptor<string, TServices, TControllers, TImports>, "kind" | "name">;

export type ModuleOptions<
  TServices extends ModuleServiceMap = ModuleServiceMap,
  TControllers extends readonly DefinedController[] = readonly DefinedController[],
  TImports extends readonly ModuleDescriptor<any, any, any, any>[] = readonly ModuleDescriptor<
    any,
    any,
    any,
    any
  >[],
> = ModuleDefinition<TServices, TControllers, TImports>;

type NormalizeModuleServices<TServices> =
  TServices extends ModuleServiceMap ? TServices : {};

type InferModuleServices<TDefinition> = TDefinition extends {
  services?: infer TServices;
}
  ? NormalizeModuleServices<TServices>
  : {};

type NormalizeModuleControllers<TControllers> = TControllers extends readonly DefinedController[]
  ? TControllers
  : readonly DefinedController[];

type InferModuleControllers<TDefinition> = TDefinition extends {
  controllers?: infer TControllers;
}
  ? NormalizeModuleControllers<TControllers>
  : readonly DefinedController[];

type NormalizeModuleImports<TImports> = TImports extends readonly ModuleDescriptor[]
  ? TImports
  : readonly ModuleDescriptor<any, any, any, any>[];

type InferModuleImports<TDefinition> = TDefinition extends {
  imports?: infer TImports;
}
  ? NormalizeModuleImports<TImports>
  : readonly ModuleDescriptor<any, any, any, any>[];

type ValidateModuleDefinition<TDefinition> = TDefinition extends {
  services?: infer TServices;
}
  ? Omit<TDefinition, "services"> & {
      services?: TServices extends ModuleServiceMap
        ? ValidatedModuleServices<TServices>
        : TServices;
    }
  : TDefinition;

export function defineModule<
  TName extends string,
  const TDefinition extends ModuleOptions<any, any, any> = ModuleOptions<{}>,
>(
  name: TName,
  def: ValidateModuleDefinition<TDefinition>,
): DefinedModule<
  TName,
  InferModuleServices<TDefinition>,
  InferModuleControllers<TDefinition>,
  InferModuleImports<TDefinition>
> {
  return freezeObject({
    kind: "module",
    name,
    imports: cloneReadonlyArray(def.imports),
    providers: cloneReadonlyArray(def.providers),
    services: cloneReadonlyRecord(def.services),
    controllers: cloneReadonlyArray(def.controllers),
    httpMounts: cloneReadonlyArray(def.httpMounts),
    workers: cloneReadonlyArray(def.workers),
    workerTriggers: cloneReadonlyArray(def.workerTriggers),
    exports: cloneReadonlyRecord(def.exports),
    hooks: cloneReadonlyRecord(def.hooks),
  } as DefinedModule<
    TName,
    InferModuleServices<TDefinition>,
    InferModuleControllers<TDefinition>,
    InferModuleImports<TDefinition>
  >);
}
