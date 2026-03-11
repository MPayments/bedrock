import type { z } from "zod";

import type {
  ControllerContextTools,
  ControllerDescriptor,
  ControllerRoute,
} from "../controller";
import type { ExecutionContext } from "../execution-context";
import type { HttpAdapter, HttpMountDescriptor } from "../http";
import type {
  AppGraph,
  AppGraphWorkerTriggerNode,
  AppGraphProviderNode,
  ResolveTokenMap,
  Token,
  TokenMap,
} from "../kernel";
import type { Logger } from "../logging";
import type { ConsoleLoggerOptions, LogLevel } from "../logging";
import type { ModuleDescriptor } from "../module";
import type { Provider, ProviderScope } from "../provider";
import type {
  NormalizedRouteErrorContract,
} from "../route-errors";
import type {
  InferActionInput,
  InferActionResult,
  ServiceActionHandle,
  ServiceDescriptor,
} from "../service";
import type {
  RegisteredWorkerTrigger,
  WorkerAdapter,
  WorkerTriggerDescriptor,
  WorkerDispatch,
  WorkerExecutionResult,
  WorkerTriggerKind,
} from "../worker-trigger";
import type { WorkerDescriptor } from "../worker";

export type AnyServiceDescriptor = ServiceDescriptor<string, TokenMap, any, any>;
export type AnyControllerDescriptor = ControllerDescriptor<string, TokenMap, any, any>;
export type AnyWorkerDescriptor = WorkerDescriptor<string, TokenMap, any, z.ZodTypeAny>;
export type AnyWorkerTriggerDescriptor = WorkerTriggerDescriptor<
  string,
  any,
  AnyWorkerDescriptor
>;
export type AnyRouteDescriptor = ControllerRoute<any>;

export type ProviderRecord = {
  slot: number;
  id: string;
  tokenKey: string;
  kind: AppGraphProviderNode["kind"];
  scope: ProviderScope;
  declaredScope?: ProviderScope;
  descriptor: Provider;
  depTokenKeys: string[];
  moduleId?: string;
  aliasToTokenKey?: string;
};

export type ModuleRecord = {
  id: string;
  descriptor: ModuleDescriptor;
  importIds: string[];
  providerIds: string[];
  serviceIds: string[];
  controllerIds: string[];
  httpMountIds: string[];
  workerIds: string[];
  workerTriggerIds: string[];
  exportKeys: string[];
};

export type ServiceRecord = {
  slot: number;
  id: string;
  moduleId: string;
  moduleName: string;
  key: string;
  descriptor: AnyServiceDescriptor;
  depTokenKeys: string[];
  depScope: ProviderScope;
};

export type RouteRecord = {
  id: string;
  name: string;
  controllerId: string;
  descriptor: AnyRouteDescriptor;
  path: string;
  fullPath: string;
  summary?: string;
  description?: string;
  tags: readonly string[];
  errorContract: NormalizedRouteErrorContract;
};

export type ControllerRecord = {
  slot: number;
  id: string;
  moduleId: string;
  moduleName: string;
  descriptor: AnyControllerDescriptor;
  depTokenKeys: string[];
  depScope: ProviderScope;
  routeIds: string[];
  routes: RouteRecord[];
};

export type HttpMountRecord = {
  id: string;
  moduleId: string;
  moduleName: string;
  descriptor: HttpMountDescriptor;
  fullPath: string;
};

export type WorkerRecord = {
  id: string;
  moduleId: string;
  moduleName: string;
  descriptor: AnyWorkerDescriptor;
  depTokenKeys: string[];
  depScope: ProviderScope;
};

export type WorkerTriggerRecord = {
  id: string;
  moduleId: string;
  moduleName: string;
  name: string;
  descriptor: AnyWorkerTriggerDescriptor;
  workerRecord: WorkerRecord;
  trigger: WorkerTriggerKind;
  adapterName: string;
  registeredTrigger: RegisteredWorkerTrigger;
  graphNode: AppGraphWorkerTriggerNode;
};

export type CompiledApp = {
  loggerConfig?: AppLoggerConfig;
  graph: AppGraph;
  moduleRecords: ModuleRecord[];
  providerRecords: ProviderRecord[];
  providerOrder: ProviderRecord[];
  providerByTokenKey: Map<string, ProviderRecord>;
  serviceRecords: ServiceRecord[];
  serviceRecordByDescriptor: WeakMap<object, ServiceRecord>;
  controllerRecords: ControllerRecord[];
  httpMountRecords: HttpMountRecord[];
  workerRecords: WorkerRecord[];
  workerTriggerRecords: WorkerTriggerRecord[];
  workerTriggerRecordByDescriptor: WeakMap<object, WorkerTriggerRecord>;
  workerTriggerRecordById: Map<string, WorkerTriggerRecord>;
  workerAdapterByName: Map<string, WorkerAdapter>;
  httpAdapter?: HttpAdapter;
};

export type ProviderDisposeRecord = {
  tokenKey: string;
  scope: ProviderScope;
  value: unknown;
  dispose: (value: unknown) => Promise<void> | void;
};

export type ServiceBinding = {
  record: ServiceRecord;
  context: unknown;
};

export type ExecutionScope = {
  compiled: CompiledApp;
  started: StartedApp;
  executionContext: ExecutionContext;
  requestProviderValues: unknown[];
  requestProviderResolved: boolean[];
  providerDisposeOrder: ProviderDisposeRecord[];
  serviceBindings: Array<ServiceBinding | undefined>;
  controllerContexts: unknown[];
};

export type StartedApp = {
  bedrockLogger: Logger;
  singletonProviderValues: unknown[];
  singletonProviderResolved: boolean[];
  singletonServiceBindings: Array<ServiceBinding | undefined>;
  singletonControllerContexts: unknown[];
  serviceInitOrder: ServiceBinding[];
  moduleInitOrder: ModuleRecord[];
  singletonProviderDisposeOrder: ProviderDisposeRecord[];
  httpRoutesRegistered: boolean;
  startedWorkerAdapters: WorkerAdapter[];
  inFlightWorkerExecutions: Set<Promise<WorkerExecutionResult>>;
};

export type AppLoggerSourceConfig =
  | {
      type: "console";
      options?: ConsoleLoggerOptions;
    }
  | {
      type: "instance";
      logger: Logger;
    }
  | {
      type: "provider";
      token?: Token<Logger>;
    };

export type AppLoggerConfig = {
  enabled?: boolean;
  levels?: readonly LogLevel[];
  source?: AppLoggerSourceConfig;
  http?:
    | false
    | {
        enabled?: boolean;
        includeQuery?: boolean;
        includeHeaders?: false | readonly string[];
      };
};

export type AppDescriptor = {
  modules: readonly ModuleDescriptor[];
  providers?: readonly Provider[];
  http?: HttpAdapter;
  workerAdapters?: readonly WorkerAdapter[];
  logger?: AppLoggerConfig;
};

export type AppRuntime = {
  start(): Promise<void>;
  stop(): Promise<void>;
  get<T>(token: Token<T>): T;
  call: {
    <const TAction extends ServiceActionHandle<any, any, any, any, any>>(
      ...args: TAction["input"] extends z.ZodUndefined
        ? [action: TAction, input?: never]
        : [action: TAction, input: InferActionInput<TAction>]
    ): Promise<InferActionResult<TAction>>;
  };
  dispatch: WorkerDispatch;
  resolveWorkerTrigger<TTrigger extends WorkerTriggerDescriptor<any, any, any>>(
    trigger: TTrigger,
  ): RegisteredWorkerTrigger<TTrigger["source"], TTrigger["worker"]>;
  fetch(request: Request): Promise<Response>;
  inspect(): AppGraph;
};

export type { ResolveTokenMap };
export type { ControllerContextTools };
