import { eq } from "drizzle-orm";

import type { ConnectorsService } from "@bedrock/core/connectors";
import { AccountBindingNotFoundError } from "@bedrock/core/counterparty-accounts";
import { schema as counterpartyAccountsSchema } from "@bedrock/core/counterparty-accounts/schema";
import type { DocumentWithOperationId } from "@bedrock/core/documents";
import type { OrchestrationService } from "@bedrock/core/orchestration";
import type { Logger } from "@bedrock/kernel";
import type { Database } from "@bedrock/kernel/db/types";

import { PaymentIntentPayloadSchema } from "../validation";

export interface PostPaymentIntentDeps {
  db: Database;
  connectors: Pick<
    ConnectorsService,
    "createIntentFromDocument" | "enqueueAttempt"
  >;
  orchestration: Pick<OrchestrationService, "selectNextProviderForIntent">;
  log: Logger;
}

export interface PaymentIntentPostResult {
  document: DocumentWithOperationId["document"];
  postingOperationId: string | null;
  connectorIntentId: string;
  firstAttemptId: string;
  firstProviderCode: string;
}

async function resolveSourceBookId(db: Database, sourceCounterpartyAccountId: string) {
  const [binding] = await db
    .select({
      bookId: counterpartyAccountsSchema.counterpartyAccountBindings.bookId,
    })
    .from(counterpartyAccountsSchema.counterpartyAccountBindings)
    .where(
      eq(
        counterpartyAccountsSchema.counterpartyAccountBindings.counterpartyAccountId,
        sourceCounterpartyAccountId,
      ),
    )
    .limit(1);

  if (!binding?.bookId) {
    throw new AccountBindingNotFoundError(sourceCounterpartyAccountId);
  }

  return binding.bookId;
}

export async function postPaymentIntentWithConnectorFlow(input: {
  deps: PostPaymentIntentDeps;
  posted: DocumentWithOperationId;
  actorUserId: string;
}): Promise<PaymentIntentPostResult> {
  const postScopeKey = `payment-intent-post:${input.posted.document.id}`;
  const payload = PaymentIntentPayloadSchema.parse(input.posted.document.payload);
  const bookId = await resolveSourceBookId(
    input.deps.db,
    payload.sourceCounterpartyAccountId,
  );

  const connectorIntent = await input.deps.connectors.createIntentFromDocument({
    documentId: input.posted.document.id,
    docType: input.posted.document.docType,
    direction: payload.direction,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    corridor: payload.corridor,
    providerConstraint: payload.providerConstraint ?? undefined,
    metadata: {
      bookId,
      sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
      destinationCounterpartyAccountId: payload.destinationCounterpartyAccountId,
    },
    idempotencyKey: `${postScopeKey}:connector-intent`,
    actorUserId: input.actorUserId,
  });

  const plan = await input.deps.orchestration.selectNextProviderForIntent({
    intentId: connectorIntent.id,
    bookId,
    riskScore: payload.riskScore,
    countryFrom: payload.countryFrom,
    countryTo: payload.countryTo,
  });

  const firstAttempt = await input.deps.connectors.enqueueAttempt({
    intentId: connectorIntent.id,
    providerCode: plan.selected.providerCode,
    providerRoute: plan.selected.degradationOrder[0] ?? payload.corridor,
    requestPayload: {
      paymentIntentDocumentId: input.posted.document.id,
      amountMinor: payload.amountMinor.toString(),
      currency: payload.currency,
      direction: payload.direction,
    },
    idempotencyKey: `${postScopeKey}:attempt:1`,
    actorUserId: input.actorUserId,
  });

  input.deps.log.info("Payment posted and routed", {
    documentId: input.posted.document.id,
    connectorIntentId: connectorIntent.id,
    providerCode: plan.selected.providerCode,
    attemptId: firstAttempt.id,
  });

  return {
    document: input.posted.document,
    postingOperationId: input.posted.postingOperationId,
    connectorIntentId: connectorIntent.id,
    firstAttemptId: firstAttempt.id,
    firstProviderCode: plan.selected.providerCode,
  };
}
