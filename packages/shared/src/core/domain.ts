import { isDeepStrictEqual } from "node:util";

import { ServiceError } from "./errors";

export class DomainError extends ServiceError {
  constructor(
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

export function readCauseString(
  error: DomainError,
  key: string,
): string | null {
  if (
    error.cause &&
    typeof error.cause === "object" &&
    key in error.cause &&
    typeof (error.cause as Record<string, unknown>)[key] === "string"
  ) {
    return (error.cause as Record<string, string | undefined>)[key] ?? null;
  }

  return null;
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  cause?: unknown,
): asserts condition {
  if (!condition) {
    throw new DomainError(code, message, cause);
  }
}

export const assertDomain = invariant;

export type Brand<T, B extends string> = T & { readonly __brand: B };

export function brandId<TBrand extends string>(
  value: string,
  label: TBrand,
): Brand<string, TBrand> {
  const normalized = value.trim();

  invariant(
    normalized.length > 0,
    `${label}.invalid`,
    `${label} cannot be empty`,
    { value, label },
  );

  return normalized as Brand<string, TBrand>;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }

  for (const key of Reflect.ownKeys(value as object)) {
    const nested = (value as Record<PropertyKey, unknown>)[key];
    if (nested && typeof nested === "object") {
      deepFreeze(nested);
    }
  }

  return Object.freeze(value);
}

export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = deepFreeze({ ...props });
  }

  equals(other?: ValueObject<TProps>): boolean {
    return Boolean(other) &&
      this.constructor === other!.constructor &&
      isDeepStrictEqual(this.props, other!.props);
  }
}

export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  equals(other?: Entity<TId>): boolean {
    return Boolean(other) &&
      this.constructor === other!.constructor &&
      this.id === other!.id;
  }
}

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private readonly events: DomainEvent[] = [];

  protected constructor(id: TId) {
    super(id);
  }

  protected record(event: DomainEvent): void {
    this.events.push(deepFreeze(event) as DomainEvent);
  }

  pullEvents(): DomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }
}
