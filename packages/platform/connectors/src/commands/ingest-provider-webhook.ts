import { ConnectorProviderNotConfiguredError } from "../errors";
import type { ConnectorsServiceContext } from "../internal/context";
import type { HandleWebhookEventInput } from "../validation";

export function createIngestProviderWebhookHandler(
  context: ConnectorsServiceContext,
  deps: {
    handleWebhookEvent: (input: HandleWebhookEventInput) => Promise<unknown>;
  },
) {
  const { providers } = context;

  return async function ingestProviderWebhook(input: {
    providerCode: string;
    rawPayload: Record<string, unknown>;
    headers?: Record<string, string | undefined>;
    actorUserId?: string;
    idempotencyKey?: string;
  }) {
    const provider = providers[input.providerCode];
    if (!provider) {
      throw new ConnectorProviderNotConfiguredError(input.providerCode);
    }

    const parsed = await provider.verifyAndParseWebhook({
      rawPayload: input.rawPayload,
      headers: input.headers,
    });

    const event = await deps.handleWebhookEvent({
      providerCode: input.providerCode,
      eventType: parsed.eventType,
      webhookIdempotencyKey: parsed.webhookIdempotencyKey,
      signatureValid: parsed.signatureValid,
      rawPayload: input.rawPayload,
      parsedPayload: parsed.parsedPayload ?? undefined,
      intentId: parsed.intentId,
      attemptId: parsed.attemptId,
      status: parsed.status,
      externalAttemptRef: parsed.externalAttemptRef ?? undefined,
      error: parsed.error ?? undefined,
      idempotencyKey:
        input.idempotencyKey ??
        `${input.providerCode}:${parsed.webhookIdempotencyKey}`,
      actorUserId: input.actorUserId,
    });

    return {
      parsed,
      event,
    };
  };
}
