import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  ACCOUNT_NO,
  OPERATION_CODE,
  POSTING_CODE,
  type Dimensions,
} from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";
import type { DocumentModule } from "@bedrock/documents";
import { DocumentValidationError } from "@bedrock/documents";
import { SYSTEM_LEDGER_ORG_ID, TransferCodes } from "@bedrock/kernel/constants";
import { OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";

import {
  amountMinorSchema,
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "./internal/document-utils";

const ExternalFundingPayloadSchema = z.object({
  kind: z.enum([
    "founder_equity",
    "investor_equity",
    "shareholder_loan",
    "opening_balance",
  ]),
  operationalAccountId: z.uuid(),
  currency: z
    .string()
    .min(2)
    .max(16)
    .transform((value) => value.trim().toUpperCase()),
  amountMinor: amountMinorSchema,
  entryRef: z.string().min(1).max(255),
  occurredAt: z.coerce.date(),
  memo: z.string().max(1000).optional(),
  counterpartyId: z.uuid().optional(),
  customerId: z.uuid().optional(),
});

type ExternalFundingPayload = z.infer<typeof ExternalFundingPayloadSchema>;

function normalizeExternalFundingPayload(payload: ExternalFundingPayload) {
  return {
    ...serializeOccurredAt(payload),
    memo: payload.memo ?? null,
    counterpartyId: payload.counterpartyId ?? null,
    customerId: payload.customerId ?? null,
  };
}

const EXTERNAL_FUNDING_BY_KIND: Record<
  ExternalFundingPayload["kind"],
  {
    postingCode: string;
    creditAccountNo: string;
    transferCode: number;
  }
> = {
  founder_equity: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
    creditAccountNo: ACCOUNT_NO.FOUNDER_EQUITY,
    transferCode: TransferCodes.EXTERNAL_FUNDING_FOUNDER_EQUITY,
  },
  investor_equity: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY,
    creditAccountNo: ACCOUNT_NO.INVESTOR_EQUITY,
    transferCode: TransferCodes.EXTERNAL_FUNDING_INVESTOR_EQUITY,
  },
  shareholder_loan: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
    creditAccountNo: ACCOUNT_NO.SHAREHOLDER_LOAN,
    transferCode: TransferCodes.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
  },
  opening_balance: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
    creditAccountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
    transferCode: TransferCodes.EXTERNAL_FUNDING_OPENING_BALANCE,
  },
};

function buildCreditDimensions(payload: ExternalFundingPayload): Dimensions {
  if (
    payload.kind === "founder_equity" ||
    payload.kind === "investor_equity" ||
    payload.kind === "shareholder_loan"
  ) {
    return { counterpartyId: payload.counterpartyId! };
  }

  return {};
}

async function ensureCounterpartyExists(
  counterpartyId: string,
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
) {
  const [counterparty] = await db
    .select({ id: schema.counterparties.id })
    .from(schema.counterparties)
    .where(eq(schema.counterparties.id, counterpartyId))
    .limit(1);

  if (!counterparty) {
    throw new DocumentValidationError(
      `Counterparty not found: ${counterpartyId}`,
    );
  }
}

async function ensureCustomerExists(
  customerId: string,
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
) {
  const [customer] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(eq(schema.customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new DocumentValidationError(`Customer not found: ${customerId}`);
  }
}

export function createExternalFundingDocumentModule(deps: {
  currenciesService: {
    findById: (id: string) => Promise<{ code: string }>;
  };
}): DocumentModule<ExternalFundingPayload, ExternalFundingPayload> {
  const { currenciesService } = deps;

  return {
    docType: "external_funding",
    docNoPrefix: "FUN",
    payloadVersion: 1,
    createSchema: ExternalFundingPayloadSchema,
    updateSchema: ExternalFundingPayloadSchema,
    payloadSchema: ExternalFundingPayloadSchema.transform(
      normalizeExternalFundingPayload,
    ),
    postingRequired: true,
    approvalRequired() {
      return false;
    },
    async createDraft(_context, input) {
      return buildDocumentDraft(input, normalizeExternalFundingPayload(input));
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, normalizeExternalFundingPayload(input));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(ExternalFundingPayloadSchema, document);
      return {
        title: `External funding: ${payload.kind}`,
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId ?? null,
        customerId: payload.customerId ?? null,
        operationalAccountId: payload.operationalAccountId,
        searchText: [
          document.docNo,
          payload.kind,
          payload.currency,
          payload.entryRef,
          payload.memo ?? "",
          payload.counterpartyId ?? "",
          payload.customerId ?? "",
          payload.operationalAccountId,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(ExternalFundingPayloadSchema, document);

      const [operationalAccount] = await context.db
        .select({
          id: schema.operationalAccounts.id,
          currencyId: schema.operationalAccounts.currencyId,
        })
        .from(schema.operationalAccounts)
        .where(eq(schema.operationalAccounts.id, payload.operationalAccountId))
        .for("update")
        .limit(1);

      if (!operationalAccount) {
        throw new DocumentValidationError(
          `Operational account not found: ${payload.operationalAccountId}`,
        );
      }

      const accountCurrency = await currenciesService.findById(
        operationalAccount.currencyId,
      );
      if (accountCurrency.code !== payload.currency) {
        throw new DocumentValidationError(
          `currency mismatch: expected ${accountCurrency.code}, got ${payload.currency}`,
        );
      }

      if (payload.counterpartyId) {
        await ensureCounterpartyExists(payload.counterpartyId, context.db);
      }
      if (payload.customerId) {
        await ensureCustomerExists(payload.customerId, context.db);
      }
    },
    async buildIntent(_context, document) {
      const payload = parseDocumentPayload(ExternalFundingPayloadSchema, document);
      const config = EXTERNAL_FUNDING_BY_KIND[payload.kind];

      return {
        operationCode: OPERATION_CODE.TREASURY_EXTERNAL_FUNDING,
        operationVersion: 1,
        bookOrgId: SYSTEM_LEDGER_ORG_ID,
        payload: {
          kind: payload.kind,
          entryRef: payload.entryRef,
          operationalAccountId: payload.operationalAccountId,
          currency: payload.currency,
          amountMinor: payload.amountMinor,
          counterpartyId: payload.counterpartyId ?? null,
          customerId: payload.customerId ?? null,
          memo: payload.memo ?? null,
        },
        lines: [
          {
            type: OPERATION_TRANSFER_TYPE.CREATE,
            planRef: `external_funding:${document.id}`,
            postingCode: config.postingCode,
            debit: {
              accountNo: ACCOUNT_NO.BANK,
              currency: payload.currency,
              dimensions: {
                operationalAccountId: payload.operationalAccountId,
              },
            },
            credit: {
              accountNo: config.creditAccountNo,
              currency: payload.currency,
              dimensions: buildCreditDimensions(payload),
            },
            amountMinor: BigInt(payload.amountMinor),
            code: config.transferCode,
            memo: payload.memo ?? `External funding: ${payload.kind}`,
          },
        ],
      };
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}
