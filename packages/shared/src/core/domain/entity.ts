import type { IdempotencyId } from "./idempotency";

export interface EntityInit<TId, TProps extends object> {
  readonly id: TId;
  readonly props: TProps;
  readonly idempotencyId?: IdempotencyId | null | undefined;
}

function isEntityInit<TId, TProps extends object>(
  value: EntityInit<TId, TProps> | TId,
): value is EntityInit<TId, TProps> {
  return typeof value === "object" && value !== null && "id" in value;
}

export abstract class Entity<
  TId,
  TProps extends object = Record<string, never>,
> {
  protected readonly props: TProps;
  private readonly _id: TId;
  private _idempotencyId: IdempotencyId | null;

  protected constructor(init: EntityInit<TId, TProps>);
  protected constructor(id: TId, props?: TProps);
  protected constructor(
    initOrId: EntityInit<TId, TProps> | TId,
    props?: TProps,
  ) {
    if (isEntityInit(initOrId)) {
      this._id = initOrId.id;
      this.props = initOrId.props;
      this._idempotencyId = initOrId.idempotencyId ?? null;
      return;
    }

    this._id = initOrId;
    this.props = (props ?? ({} as TProps));
    this._idempotencyId = null;
  }

  get id(): TId {
    return this._id;
  }

  get idempotencyId(): IdempotencyId | null {
    return this._idempotencyId;
  }

  protected setIdempotencyId(idempotencyId: IdempotencyId | null): void {
    this._idempotencyId = idempotencyId;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof Entity &&
      other.constructor === this.constructor &&
      Object.is(other.id, this.id)
    );
  }
}
