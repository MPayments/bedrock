export interface CorrelationContext {
  requestId?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  causationId?: string | null;
  actorId?: string | null;
}
