export type MaybePromise<T> = T | Promise<T>;

export type BivariantCallback<TArgs, TReturn> = {
  bivarianceHack(args: TArgs): TReturn;
}["bivarianceHack"];

export type Phantom<T> = {
  [K in never]: T;
};

export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};
