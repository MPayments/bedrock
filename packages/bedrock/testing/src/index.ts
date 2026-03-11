import {
  createApp,
  defineProvider,
  getTokenKey,
  type AppDescriptor,
  type AppRuntime,
  type ModuleDescriptor,
  type Provider,
  type Token,
} from "@bedrock/core";
import {
  AuthContextToken,
  OptionalActorToken,
  createAuthContext,
  type Actor,
} from "@bedrock/security";

export {
  createInMemoryWorkerAdapter,
  type InMemoryWorkerAdapter,
  type InMemoryWorkerAdapterOptions,
  type InMemoryWorkerDeliveryResult,
} from "./worker";

export type TestAppDescriptor = AppDescriptor & {
  overrides?: readonly Provider[];
};

export function createTestApp(def: TestAppDescriptor): AppRuntime {
  const overrideTokenKeys = new Set(
    (def.overrides ?? []).map((provider) => getTokenKey(provider.provide)),
  );

  if (overrideTokenKeys.size === 0) {
    return createApp(def);
  }

  const memo = new Map<ModuleDescriptor, ModuleDescriptor>();
  const modules = def.modules.map((moduleDescriptor) =>
    cloneModule(moduleDescriptor, overrideTokenKeys, memo),
  );
  const providers = [
    ...(def.providers ?? []).filter(
      (provider) => !overrideTokenKeys.has(getTokenKey(provider.provide)),
    ),
    ...(def.overrides ?? []),
  ];

  return createApp({
    modules,
    providers,
    http: def.http,
    workerAdapters: def.workerAdapters,
  });
}

export function value<T>(provide: Token<T>, useValue: T): Provider<T> {
  return defineProvider({
    provide,
    useValue,
  });
}

export function asActor(actor: Actor | null): readonly Provider[] {
  return [
    defineProvider({
      provide: OptionalActorToken,
      scope: "request",
      useValue: actor,
    }),
    defineProvider({
      provide: AuthContextToken,
      scope: "request",
      deps: {
        actor: OptionalActorToken,
      },
      useFactory: ({ actor }) => createAuthContext(actor),
    }),
  ];
}

function cloneModule(
  moduleDescriptor: ModuleDescriptor,
  overrideTokenKeys: ReadonlySet<string>,
  memo: Map<ModuleDescriptor, ModuleDescriptor>,
): ModuleDescriptor {
  const existing = memo.get(moduleDescriptor);
  if (existing) {
    return existing;
  }

  const clone: ModuleDescriptor = {
    ...moduleDescriptor,
    providers: (moduleDescriptor.providers ?? []).filter(
      (provider) => !overrideTokenKeys.has(getTokenKey(provider.provide)),
    ),
    imports: [],
  };

  memo.set(moduleDescriptor, clone);

  clone.imports = (moduleDescriptor.imports ?? []).map((importedModule) =>
    cloneModule(importedModule, overrideTokenKeys, memo),
  );

  return clone;
}
