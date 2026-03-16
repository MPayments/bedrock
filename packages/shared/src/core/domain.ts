import { isDeepStrictEqual } from "node:util";

import { ServiceError } from "./errors";

/**
 * Base error for domain rule violations.
 *
 * Why a dedicated domain error exists:
 * - application/service layers can distinguish business rule failures
 *   from infrastructure failures
 * - callers can branch on a stable machine-readable code
 * - `cause` can carry structured context for logging or mapping to API responses
 *
 * Example:
 *   throw new DomainError("order.status.invalid", "Order must be draft")
 */
export class DomainError extends ServiceError {
  constructor(
    /**
     * Stable machine-readable identifier for the failure.
     * Prefer codes over parsing error messages.
     */
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/**
 * Safely reads a string field from `error.cause`.
 *
 * This is useful when domain code throws structured metadata:
 *   throw new DomainError("customer.invalid", "Customer is invalid", {
 *     customerId: "cus_123",
 *     reason: "blocked",
 *   });
 *
 * Then callers can extract a known string field without unsafe casting.
 *
 * Returns:
 * - the string value when present
 * - null when the cause is absent, not an object, the key is missing,
 *   or the value is not a string
 */
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

/**
 * Domain-level assertion helper.
 *
 * Use this instead of raw `if (!condition) throw ...` to:
 * - standardize domain error construction
 * - guarantee every rule violation has a code and message
 * - improve narrowing in TypeScript via `asserts condition`
 *
 * Because of `asserts condition`, TypeScript understands that after this call,
 * `condition` must hold.
 *
 * Example:
 *   invariant(user !== null, "user.notFound", "User not found");
 *   // from here `user` is narrowed to non-null
 */
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

/**
 * Nominal typing helper built on top of TypeScript's structural type system.
 *
 * Without branding, every id is usually just `string`, which makes it easy to
 * pass the wrong id type into functions.
 *
 * Example:
 *   type OrderId = Brand<string, "OrderId">;
 *   type CustomerId = Brand<string, "CustomerId">;
 *
 * Even though both are strings at runtime, TypeScript will stop accidental mixing.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Trims required text input and enforces non-empty result.
 *
 * Typical usage:
 * - names
 * - titles
 * - codes
 * - any field that must contain meaningful text
 *
 * This function centralizes a very common domain rule:
 * "blank after trimming counts as missing"
 */
export function normalizeRequiredText(
  value: string,
  code: string,
  field: string,
): string {
  const normalized = value.trim();

  invariant(normalized.length > 0, code, `${field} is required`, {
    field,
    value,
  });

  return normalized;
}

export function trimToNull(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return value.length > 0 ? value : null;
}

/**
 * Trims optional text input and converts blank values to null.
 *
 * This is often preferable to storing empty strings in the domain model because:
 * - null clearly means "absent"
 * - downstream comparisons become simpler
 * - persistence/output models stay more consistent
 *
 * Examples:
 *   "  hello " -> "hello"
 *   "   "      -> null
 *   null       -> null
 *   undefined  -> null
 */
export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Removes falsy ids and duplicates while preserving first-seen order.
 *
 * Useful when the domain accepts a list of references from outside and you want
 * a normalized id collection before validating cardinality or constraints.
 *
 * Note:
 * - because it uses `filter(Boolean)`, empty strings are removed
 * - order is preserved because `Set` iteration keeps insertion order
 */
export function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

/**
 * Normalizes and brands an id-like string.
 *
 * This is a lightweight runtime guard plus compile-time branding step.
 *
 * Example:
 *   type OrderId = Brand<string, "OrderId">;
 *   const id = brandId(" ord_123 ", "OrderId");
 *
 * Result:
 * - runtime: trimmed non-empty string
 * - compile time: typed as Brand<string, "OrderId">
 *
 * Note:
 * `label` is used both in the error code and message, so pick a stable value.
 */
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

/**
 * Recursively freezes objects to support immutability-by-convention.
 *
 * Why this matters in domain code:
 * - value objects should not be mutated after creation
 * - recorded events should not be modified after publication/collection
 * - defensive freezing makes accidental state corruption much harder
 *
 * Behavior:
 * - primitives are returned as-is
 * - already frozen objects are returned as-is
 * - nested objects are recursively frozen first
 * - final object is frozen with `Object.freeze`
 *
 * Important caveat:
 * - this does not create deep clones
 * - nested object references are frozen in place
 * - some mutable built-ins with internal slots (notably `Date`) are not truly
 *   made immutable just by `Object.freeze`
 */
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

/**
 * Base class for value objects.
 *
 * Value objects:
 * - have no identity of their own
 * - are defined entirely by their attributes
 * - should be immutable
 *
 * Examples:
 * - Money
 * - EmailAddress
 * - Quantity
 * - DateRange
 *
 * Implementation choices here:
 * - props are copied at the top level and deep-frozen
 * - equality is structural, not referential
 * - equality also requires same runtime constructor, so two different value
 *   object classes with identical props are still not equal
 */
export abstract class ValueObject<TProps extends object> {
  /**
   * Immutable internal state of the value object.
   *
   * Exposed to subclasses, not to the outside world.
   */
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    /**
     * Copy the root object so later mutation of the original `props` object
     * does not affect this value object.
     *
     * Then freeze recursively to protect invariants after construction.
     */
    this.props = deepFreeze({ ...props });
  }

  /**
   * Structural equality for value objects.
   *
   * Two value objects are equal when:
   * - both exist
   * - both have the same concrete class
   * - their props are deeply equal
   *
   * This reflects the DDD rule that value objects are compared by value.
   */
  equals(other?: ValueObject<TProps>): boolean {
    return (
      Boolean(other) &&
      this.constructor === other!.constructor &&
      isDeepStrictEqual(this.props, other!.props)
    );
  }
}

/**
 * Base class for entities.
 *
 * Entities:
 * - have identity
 * - can change over time while remaining "the same thing"
 * - are compared primarily by id, not by full state
 *
 * Examples:
 * - Order
 * - Customer
 * - Invoice
 * - PurchaseOrderLine (when lines are referenced over time)
 */
export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  /**
   * Identity equality for entities.
   *
   * Two entities are equal when:
   * - both exist
   * - both have the same concrete class
   * - they share the same id
   *
   * We intentionally do not compare the rest of state.
   */
  equals(other?: Entity<TId>): boolean {
    return (
      Boolean(other) &&
      this.constructor === other!.constructor &&
      this.id === other!.id
    );
  }
}

/**
 * Minimal domain event contract.
 *
 * Domain events represent facts that already happened inside the domain model.
 *
 * Example:
 *   {
 *     type: "order.placed",
 *     occurredAt: new Date(),
 *     payload: { orderId, customerId }
 *   }
 *
 * Notes:
 * - `type` should be stable and machine-readable
 * - `occurredAt` should represent when the business fact occurred
 * - `payload` carries the event-specific data
 */
export interface DomainEvent<
  TType extends string = string,
  TPayload = unknown,
> {
  readonly type: TType;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

/**
 * Base class for aggregate roots.
 *
 * An aggregate root is:
 * - an entity
 * - the entry point for modifying an aggregate
 * - the boundary that protects invariants requiring strong consistency
 *
 * This base class additionally provides domain event collection.
 *
 * Important design idea:
 * - aggregates record events during behavior execution
 * - application layer later pulls them out and publishes/persists them
 * - the aggregate itself stays unaware of message buses/outboxes
 */
export abstract class AggregateRoot<TId> extends Entity<TId> {
  /**
   * Unpublished/unflushed events recorded during this aggregate's lifecycle.
   */
  private readonly events: DomainEvent[] = [];

  protected constructor(id: TId) {
    super(id);
  }

  /**
   * Records a domain event produced by aggregate behavior.
   *
   * The event is frozen defensively so no later code can mutate what was
   * originally recorded.
   *
   * Typical usage inside aggregate methods:
   *   this.record({
   *     type: "order.confirmed",
   *     occurredAt: new Date(),
   *     payload: { orderId: this.id }
   *   });
   */
  protected record(event: DomainEvent): void {
    this.events.push(deepFreeze(event) as DomainEvent);
  }

  /**
   * Returns recorded events and clears the internal buffer.
   *
   * This is usually called by the application layer after saving the aggregate,
   * often to write to an outbox or publish integration messages.
   *
   * Semantics:
   * - "pull" means one-time consumption
   * - after calling this, the aggregate no longer retains those events
   */
  pullEvents(): DomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }
}
