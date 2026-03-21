import { Version } from "./version";

export interface DomainEventMetadata {
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
  readonly actorId?: string | undefined;
  readonly tenantId?: string | undefined;
}

export interface DomainEvent<
  TName extends string = string,
  TPayload = unknown,
  TAggregateId = string,
> {
  readonly eventId: string;
  readonly name: TName;
  readonly occurredAt: Date;
  readonly aggregateId?: TAggregateId | undefined;
  readonly aggregateVersion?: number | undefined;
  readonly payload: Readonly<TPayload>;
  readonly metadata?: Readonly<DomainEventMetadata> | undefined;
}

export interface CreateDomainEventInput<
  TName extends string,
  TPayload,
  TAggregateId,
> {
  readonly name: TName;
  readonly payload: TPayload;
  readonly aggregateId?: TAggregateId | undefined;
  readonly aggregateVersion?: Version | number | undefined;
  readonly eventId?: string | undefined;
  readonly occurredAt?: Date | undefined;
  readonly metadata?: DomainEventMetadata | undefined;
  readonly eventIdFactory?: (() => string) | undefined;
}

export function createDomainEvent<
  TName extends string,
  TPayload,
  TAggregateId = string,
>(
  input: CreateDomainEventInput<TName, TPayload, TAggregateId>,
): DomainEvent<TName, TPayload, TAggregateId> {
  const eventIdFactory = input.eventIdFactory ?? (() => crypto.randomUUID());
  const aggregateVersion =
    input.aggregateVersion instanceof Version
      ? input.aggregateVersion.toNumber()
      : input.aggregateVersion;

  return {
    eventId: input.eventId ?? eventIdFactory(),
    name: input.name,
    occurredAt: input.occurredAt ?? new Date(),
    aggregateId: input.aggregateId,
    aggregateVersion,
    payload: input.payload,
    metadata: input.metadata ?? undefined,
  };
}
