import { sha256Hex } from "@bedrock/platform/crypto";
import { canonicalJson, makePlanKey } from "@bedrock/shared/core/canon";

import {
  isCompiledCreateTemplate,
} from "./compilation";
import type {
  CompiledPack,
  CompiledPostingTemplate,
  CreateIntentLine,
  DocumentPostingPlanRequest,
  IntentLine,
  OperationIntent,
  PostPendingIntentLine,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
  ResolvedPostingTemplate,
  VoidPendingIntentLine,
} from "./types";
import {
  AccountingPostingPlanValidationError,
  AccountingTemplateAccessError,
  UnknownPostingTemplateError,
} from "../../errors";
import type { ValueBinding } from "../../packs/schema";

const OPERATION_TRANSFER_TYPE = {
  CREATE: "create",
  POST_PENDING: "post_pending",
  VOID_PENDING: "void_pending",
} as const;

const BOOK_REF_BOOK_ID = "bookId";

function resolveBindingValue(
  request: DocumentPostingPlanRequest,
  binding: ValueBinding,
): string {
  if (binding.kind === "literal") {
    return binding.value;
  }

  if (binding.kind === "dimension") {
    const value = request.dimensions[binding.key];
    if (!value) {
      throw new AccountingPostingPlanValidationError(
        `Missing dimension "${binding.key}" for template ${request.templateKey}`,
      );
    }
    return value;
  }

  if (binding.kind === "ref") {
    const value = request.refs?.[binding.key];
    if (!value) {
      throw new AccountingPostingPlanValidationError(
        `Missing ref "${binding.key}" for template ${request.templateKey}`,
      );
    }
    return value;
  }

  const value = request.bookRefs[binding.key];
  if (!value) {
    throw new AccountingPostingPlanValidationError(
      `Missing bookRef "${binding.key}" for template ${request.templateKey}`,
    );
  }
  return value;
}

function buildPlanRef(request: DocumentPostingPlanRequest): string {
  return makePlanKey(request.templateKey, {
    amountMinor: request.amountMinor,
    bookRefs: request.bookRefs,
    currency: request.currency,
    dimensions: request.dimensions,
    effectiveAt: request.effectiveAt,
    pending: request.pending ?? null,
    refs: request.refs ?? null,
  });
}

export function readRequiredBookId(request: DocumentPostingPlanRequest): string {
  const bookId = request.bookRefs[BOOK_REF_BOOK_ID];
  if (!bookId) {
    throw new AccountingPostingPlanValidationError(
      `Posting plan requires bookRefs.${BOOK_REF_BOOK_ID}`,
    );
  }

  return bookId;
}

export function resolveBookIdContext(input: ResolvePostingPlanInput): string {
  if (input.plan.requests.length === 0) {
    throw new AccountingPostingPlanValidationError(
      "Posting plan must include at least one request",
    );
  }

  const requestBookIds = input.plan.requests.map((request) =>
    readRequiredBookId(request),
  );

  if (input.bookIdContext) {
    if (!requestBookIds.includes(input.bookIdContext)) {
      throw new AccountingPostingPlanValidationError(
        `Posting plan ${BOOK_REF_BOOK_ID} set must include bookIdContext`,
      );
    }

    return input.bookIdContext;
  }

  return requestBookIds[0]!;
}

function validateRequestShape(
  request: DocumentPostingPlanRequest,
  template: CompiledPostingTemplate,
) {
  for (const key of template.requiredBookRefs) {
    if (!request.bookRefs[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires bookRef "${key}"`,
      );
    }
  }

  for (const key of template.requiredDimensions) {
    if (!request.dimensions[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires dimension "${key}"`,
      );
    }
  }

  for (const key of template.requiredRefs) {
    if (!request.refs?.[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires ref "${key}"`,
      );
    }
  }

  if (isCompiledCreateTemplate(template)) {
    if (request.amountMinor <= 0n) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires amountMinor > 0`,
      );
    }

    if (template.pendingMode === "required" && !request.pending?.timeoutSeconds) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires pending.timeoutSeconds`,
      );
    }

    if (template.pendingMode === "forbidden" && request.pending) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} does not allow pending config`,
      );
    }

    return;
  }

  if (!request.pending?.pendingId || request.pending.pendingId <= 0n) {
    throw new AccountingPostingPlanValidationError(
      `Template ${template.key} requires pending.pendingId`,
    );
  }
}

function resolveCreateLine(
  request: DocumentPostingPlanRequest,
  template: Extract<CompiledPostingTemplate, { lineType: "create" }>,
): CreateIntentLine {
  return {
    type: OPERATION_TRANSFER_TYPE.CREATE,
    planRef: buildPlanRef(request),
    bookId: readRequiredBookId(request),
    postingCode: template.postingCode,
    debit: {
      accountNo: template.debit.accountNo,
      currency: request.currency,
      dimensions: Object.fromEntries(
        (
          Object.entries(template.debit.dimensions) as [string, ValueBinding][]
        ).map(([key, binding]) => [key, resolveBindingValue(request, binding)]),
      ),
    },
    credit: {
      accountNo: template.credit.accountNo,
      currency: request.currency,
      dimensions: Object.fromEntries(
        (
          Object.entries(template.credit.dimensions) as [string, ValueBinding][]
        ).map(([key, binding]) => [key, resolveBindingValue(request, binding)]),
      ),
    },
    amountMinor: request.amountMinor,
    code: template.transferCode,
    pending: request.pending
      ? {
          timeoutSeconds: request.pending.timeoutSeconds!,
          ref: request.pending.ref ?? null,
        }
      : undefined,
    chain: request.refs?.chainId ?? null,
    memo: request.memo ?? null,
  };
}

function resolvePendingLine(
  request: DocumentPostingPlanRequest,
  template: Extract<
    CompiledPostingTemplate,
    { lineType: "post_pending" | "void_pending" }
  >,
): PostPendingIntentLine | VoidPendingIntentLine {
  const base = {
    planRef: buildPlanRef(request),
    currency: request.currency,
    pendingId: request.pending!.pendingId!,
    code: undefined,
    chain: request.refs?.chainId ?? null,
    memo: request.memo ?? null,
  };

  if (template.lineType === OPERATION_TRANSFER_TYPE.POST_PENDING) {
    return {
      type: OPERATION_TRANSFER_TYPE.POST_PENDING,
      ...base,
      amount: request.pending?.amountMinor ?? 0n,
    };
  }

  return {
    type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
    ...base,
  };
}

export function resolvePostingPlan(
  input: ResolvePostingPlanInput,
  compiledPack: CompiledPack,
): ResolvePostingPlanResult {
  const { accountingSourceId, plan } = input;
  const lines: IntentLine[] = [];
  const appliedTemplates: ResolvedPostingTemplate[] = [];

  for (const [requestIndex, request] of plan.requests.entries()) {
    const template = compiledPack.templateLookup.get(request.templateKey);
    if (!template) {
      throw new UnknownPostingTemplateError(request.templateKey);
    }

    if (!template.allowSources.includes(accountingSourceId)) {
      throw new AccountingTemplateAccessError(accountingSourceId, template.key);
    }

    validateRequestShape(request, template);

    const line = isCompiledCreateTemplate(template)
      ? resolveCreateLine(request, template)
      : resolvePendingLine(request, template);

    lines.push(line);
    appliedTemplates.push({
      requestIndex,
      templateKey: template.key,
      lineType: template.lineType,
      postingCode: isCompiledCreateTemplate(template)
        ? template.postingCode
        : null,
    });
  }

  const intent: OperationIntent = {
    source: input.source,
    operationCode: plan.operationCode,
    operationVersion: plan.operationVersion ?? 1,
    payload: plan.payload,
    idempotencyKey: input.idempotencyKey,
    postingDate: input.postingDate,
    lines,
  };

  return {
    intent,
    packChecksum: compiledPack.checksum,
    postingPlanChecksum: sha256Hex(canonicalJson(plan)),
    journalIntentChecksum: sha256Hex(canonicalJson(intent)),
    appliedTemplates,
  };
}
