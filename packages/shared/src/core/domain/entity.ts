import type { IdempotencyId } from "./idempotency";

export interface EntityInit<TId, TProps extends object> {
  readonly id: TId;
  readonly props: TProps;
  readonly idempotencyId?: IdempotencyId | null | undefined;
}

export abstract class Entity<
  TId,
  TProps extends object = Record<string, never>,
> {
  protected readonly props: TProps;
  private readonly _id: TId;
  private _idempotencyId: IdempotencyId | null;

  protected constructor(init: EntityInit<TId, TProps>) {
    this._id = init.id;
    this.props = init.props;
    this._idempotencyId = init.idempotencyId ?? null;
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
}
