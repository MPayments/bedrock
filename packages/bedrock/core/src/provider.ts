import {
  getTokenKey,
  type ResolveTokenMap,
  type Token,
  type TokenMap,
} from "./kernel";
import { cloneReadonlyRecord, freezeObject } from "./immutability";

export type ProviderScope = "singleton" | "request" | "transient";

export type ProviderFactoryCtx<TDeps extends TokenMap = {}> =
  ResolveTokenMap<TDeps>;

export type ValueProvider<T> = {
  provide: Token<T>;
  useValue: T;
  scope?: ProviderScope;
};

export type FactoryProvider<T, TDeps extends TokenMap = {}> = {
  provide: Token<T>;
  deps?: TDeps;
  useFactory: (ctx: ProviderFactoryCtx<TDeps>) => T | Promise<T>;
  scope?: ProviderScope;
  dispose?: (value: T) => Promise<void> | void;
};

export type ExistingProvider<T> = {
  provide: Token<T>;
  useExisting: Token<T>;
  scope?: ProviderScope;
};

export type Provider<T = any, TDeps extends TokenMap = any> =
  | ValueProvider<T>
  | FactoryProvider<T, TDeps>
  | ExistingProvider<T>;

export function defineProvider<T>(provider: ValueProvider<T>): ValueProvider<T>;
export function defineProvider<T, TDeps extends TokenMap>(
  provider: FactoryProvider<T, TDeps>,
): FactoryProvider<T, TDeps>;
export function defineProvider<T>(
  provider: ExistingProvider<T>,
): ExistingProvider<T>;
export function defineProvider<TProvider extends Provider<any, any>>(
  provider: TProvider,
): TProvider {
  return freezeObject({
    ...provider,
    deps: "deps" in provider ? cloneReadonlyRecord(provider.deps) : undefined,
  }) as TProvider;
}

export function isValueProvider<T>(
  provider: Provider<T>,
): provider is ValueProvider<T> {
  return "useValue" in provider;
}

export function isFactoryProvider<T>(
  provider: Provider<T>,
): provider is FactoryProvider<T, any> {
  return "useFactory" in provider;
}

export function isExistingProvider<T>(
  provider: Provider<T>,
): provider is ExistingProvider<T> {
  return "useExisting" in provider;
}

export function getProviderKind(
  provider: Provider,
): "value" | "factory" | "existing" {
  if (isValueProvider(provider)) {
    return "value";
  }

  if (isFactoryProvider(provider)) {
    return "factory";
  }

  return "existing";
}

export function getProviderScope(provider: Provider): ProviderScope {
  return provider.scope ?? "singleton";
}

export function getProviderDepTokenKeys(provider: Provider): string[] {
  if (isValueProvider(provider)) {
    return [];
  }

  if (isExistingProvider(provider)) {
    return [getTokenKey(provider.useExisting)];
  }

  return Object.values((provider.deps ?? {}) as TokenMap).map((dep) =>
    getTokenKey(dep),
  );
}
