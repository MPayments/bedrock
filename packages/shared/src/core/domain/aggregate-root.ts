import type { DomainEvent, DomainEventMetadata } from "./domain-event";
import { createDomainEvent } from "./domain-event";
import { Entity } from "./entity";
import type { EntityInit } from "./entity";
import { Version } from "./version";

export interface AggregateRootInit<
  TId,
  TProps extends object,
> extends EntityInit<TId, TProps> {
  readonly version?: Version | number | undefined;
}

export interface RaiseDomainEventInput<
  TName extends string,
  TPayload,
  TAggregateId,
> {
  readonly name: TName;
  readonly payload: TPayload;
  readonly aggregateId?: TAggregateId | undefined;
  readonly serializeAggregateId?: ((id: unknown) => TAggregateId) | undefined;
  readonly metadata?: DomainEventMetadata | undefined;
  readonly eventId?: string | undefined;
  readonly occurredAt?: Date | undefined;
  readonly eventIdFactory?: (() => string) | undefined;
}

function isAggregateRootInit<TId, TProps extends object>(
  value: AggregateRootInit<TId, TProps> | TId,
): value is AggregateRootInit<TId, TProps> {
  return typeof value === "object" && value !== null && "id" in value;
}

export abstract class AggregateRoot<
  TId,
  TProps extends object = Record<string, never>,
> extends Entity<TId, TProps> {
  private readonly domainEvents: DomainEvent<string, unknown, unknown>[] = [];
  private _version: Version;

  protected constructor(init: AggregateRootInit<TId, TProps>);
  protected constructor(id: TId, props?: TProps, version?: Version | number);
  protected constructor(
    initOrId: AggregateRootInit<TId, TProps> | TId,
    props?: TProps,
    version?: Version | number,
  ) {
    const init = isAggregateRootInit(initOrId)
      ? initOrId
      : {
          id: initOrId,
          props: props ?? ({} as TProps),
          version,
        };

    super(init);
    this._version =
      init.version instanceof Version
        ? init.version
        : Version.from(init.version ?? 0);
  }

  get version(): Version {
    return this._version;
  }

  protected setVersion(version: Version | number): void {
    this._version =
      version instanceof Version ? version : Version.from(version);
  }

  protected incrementVersion(): Version {
    this._version = this._version.next();
    return this._version;
  }

  protected record(event: DomainEvent<string, unknown, unknown>): void {
    this.domainEvents.push(event);
  }

  protected raiseDomainEvent<
    TName extends string,
    TPayload,
    TAggregateEventId = TId,
  >(
    input: RaiseDomainEventInput<TName, TPayload, TAggregateEventId>,
  ): DomainEvent<TName, TPayload, TAggregateEventId> {
    const aggregateId =
      input.aggregateId ??
      (input.serializeAggregateId
        ? input.serializeAggregateId(this.id)
        : (this.id as unknown as TAggregateEventId));

    const event = createDomainEvent({
      name: input.name,
      payload: input.payload,
      aggregateId,
      aggregateVersion: this._version,
      metadata: input.metadata,
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      eventIdFactory: input.eventIdFactory,
    });

    this.record(event as DomainEvent<string, unknown, unknown>);
    return event;
  }

  peekDomainEvents(): readonly DomainEvent<string, unknown, unknown>[] {
    return [...this.domainEvents];
  }

  pullDomainEvents(): readonly DomainEvent<string, unknown, unknown>[] {
    const snapshot = [...this.domainEvents];
    this.domainEvents.length = 0;
    return snapshot;
  }

  pullEvents(): readonly DomainEvent<string, unknown, unknown>[] {
    return this.pullDomainEvents();
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }
}
