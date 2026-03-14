import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import { serializeOccurredAt } from "@bedrock/plugin-documents-sdk/module-kit";

import type {
  IfrsModuleDeps,
  OrganizationRequisiteBinding,
  IfrsDocumentRuntime,
  RequisitesService,
} from "./types";
import {
  type TransferIntercompanyInput,
  type TransferIntercompanyPayload,
  type TransferIntraInput,
  type TransferIntraPayload,
} from "../../validation";

const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;

export { resolvePendingTransferBookId } from "@bedrock/plugin-documents-sdk/module-kit";

export function normalizeTransferIntraPayload(
  input: TransferIntraInput,
  bindings: {
    source: OrganizationRequisiteBinding;
    destination: OrganizationRequisiteBinding;
  }): TransferIntraPayload {
  return {
    ...serializeOccurredAt(input),
    organizationId: bindings.source.organizationId,
    sourceRequisiteId: input.sourceRequisiteId,
    destinationRequisiteId: input.destinationRequisiteId,
    timeoutSeconds: input.timeoutSeconds,
    currency: input.currency,
    amountMinor: input.amountMinor,
    memo: input.memo,
  };
}

export function normalizeTransferIntercompanyPayload(
  input: TransferIntercompanyInput,
  bindings: {
    source: OrganizationRequisiteBinding;
    destination: OrganizationRequisiteBinding;
  },
): TransferIntercompanyPayload {
  return {
    ...serializeOccurredAt(input),
    sourceOrganizationId: bindings.source.organizationId,
    sourceRequisiteId: input.sourceRequisiteId,
    destinationOrganizationId: bindings.destination.organizationId,
    destinationRequisiteId: input.destinationRequisiteId,
    timeoutSeconds: input.timeoutSeconds,
    currency: input.currency,
    amountMinor: input.amountMinor,
    memo: input.memo,
  };
}

export async function resolveTransferBindings(
  requisitesService: RequisitesService,
  input: {
    sourceRequisiteId: string;
    destinationRequisiteId: string;
  },
) {
  const [source, destination] =
    await requisitesService.resolveBindings({
      requisiteIds: [
        input.sourceRequisiteId,
        input.destinationRequisiteId,
      ],
    });

  if (!source || !destination) {
    throw new DocumentValidationError(
      "Organization requisite binding is missing",
    );
  }

  return { source, destination };
}

export function ensureTransferCurrencies(input: {
  payloadCurrency: string;
  sourceCurrency: string;
  destinationCurrency: string;
}) {
  if (
    input.payloadCurrency !== input.sourceCurrency ||
    input.payloadCurrency !== input.destinationCurrency
  ) {
    throw new DocumentValidationError(
      `Currency mismatch: payload=${input.payloadCurrency}, source=${input.sourceCurrency}, destination=${input.destinationCurrency}`,
    );
  }
}

export async function resolveTransferDependencyDocument(
  deps: Pick<IfrsModuleDeps, "transferLookup">,
  runtime: IfrsDocumentRuntime,
  transferDocumentId: string,
) {
  const dependency = await deps.transferLookup.resolveTransferDependencyDocument({
    runtime,
    transferDocumentId,
  });

  if (!TRANSFER_DOC_TYPES.includes(dependency.docType as (typeof TRANSFER_DOC_TYPES)[number])) {
    throw new DocumentValidationError(
      `Transfer document ${transferDocumentId} was not found`,
    );
  }

  return dependency;
}

export async function listPendingTransfers(
  deps: Pick<IfrsModuleDeps, "transferLookup">,
  runtime: IfrsDocumentRuntime,
  transferDocumentId: string,
) {
  const rows = await deps.transferLookup.listPendingTransfers({
    runtime,
    transferDocumentId,
  });

  if (rows.length === 0) {
    throw new DocumentValidationError(
      `Transfer document ${transferDocumentId} does not have pending transfers`,
    );
  }

  return rows;
}
