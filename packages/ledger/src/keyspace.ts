export type KeyFn = (...args: any[]) => string;
export type KeyspaceDef = Record<string, KeyFn>;

export interface Keyspace<N extends string, D extends KeyspaceDef> {
    namespace: N;
    keys: { [K in keyof D]: (...args: Parameters<D[K]>) => string };
    key: <K extends keyof D>(name: K, ...args: Parameters<D[K]>) => string;
}

export function defineKeyspace<N extends string, D extends KeyspaceDef>(
    namespace: N,
    def: D
): Keyspace<N, D> {
    const keys: any = {};
    for (const [name, fn] of Object.entries(def)) {
        keys[name] = (...args: any[]) => `${namespace}:${(fn as any)(...args)}`;
    }
    return {
        namespace,
        keys,
        key: (name: any, ...args: any[]) => keys[name](...args)
    };
}

export type KeyspaceRegistry = Record<string, Keyspace<string, any>>;
export function createKeyspaceRegistry<T extends KeyspaceRegistry>(spaces: T): T {
    return spaces;
}
