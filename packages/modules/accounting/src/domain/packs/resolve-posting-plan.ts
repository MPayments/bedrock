import { canonicalJson, makePlanKey } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { DomainError } from "@bedrock/shared/core/domain";

import { isCompiledCreateTemplate } from "./compile-pack";
import type { CompiledPack, CompiledPostingTemplate } from "./compiled-pack";
import type {
  DocumentPostingPlanRequest,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
  ResolvedPostingTemplate,
} from "./document-posting-plan";
import type {
  CreateIntentLine,
  IntentLine,
  OperationIntent,
  PostPendingIntentLine,
  VoidPendingIntentLine,
} from "./operation-intent";
import type { ValueBinding } from "./pack-definition";

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
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Missing dimension "${binding.key}" for template ${request.templateKey}`,
        { templateKey: request.templateKey, dimensionKey: binding.key },
      );
    }
    return value;
  }

  if (binding.kind === "ref") {
    const value = request.refs?.[binding.key];
    if (!value) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Missing ref "${binding.key}" for template ${request.templateKey}`,
        { templateKey: request.templateKey, refKey: binding.key },
      );
    }
    return value;
  }

  const value = request.bookRefs[binding.key];
  if (!value) {
    throw new DomainError(
      "accounting_pack.posting_plan_invalid",
      `Missing bookRef "${binding.key}" for template ${request.templateKey}`,
      { templateKey: request.templateKey, bookRefKey: binding.key },
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
    throw new DomainError(
      "accounting_pack.posting_plan_invalid",
      `Posting plan requires bookRefs.${BOOK_REF_BOOK_ID}`,
      { bookRefKey: BOOK_REF_BOOK_ID },
    );
  }

  return bookId;
}

export function resolveBookIdContext(input: ResolvePostingPlanInput): string {
  if (input.plan.requests.length === 0) {
    throw new DomainError(
      "accounting_pack.posting_plan_invalid",
      "Posting plan must include at least one request",
    );
  }

  const requestBookIds = input.plan.requests.map((request) =>
    readRequiredBookId(request),
  );

  if (input.bookIdContext) {
    if (!requestBookIds.includes(input.bookIdContext)) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Posting plan ${BOOK_REF_BOOK_ID} set must include bookIdContext`,
        { bookIdContext: input.bookIdContext },
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
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Template ${template.key} requires bookRef "${key}"`,
        { templateKey: template.key, bookRefKey: key },
      );
    }
  }

  for (const key of template.requiredDimensions) {
    if (!request.dimensions[key]) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Template ${template.key} requires dimension "${key}"`,
        { templateKey: template.key, dimensionKey: key },
      );
    }
  }

  for (const key of template.requiredRefs) {
    if (!request.refs?.[key]) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Template ${template.key} requires ref "${key}"`,
        { templateKey: template.key, refKey: key },
      );
    }
  }

  if (isCompiledCreateTemplate(template)) {
    if (request.amountMinor <= 0n) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Template ${template.key} requires amountMinor > 0`,
        { templateKey: template.key },
      );
    }

    if (template.pendingMode === "required" && !request.pending?.timeoutSeconds) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Template ${template.key} requires pending.timeoutSeconds`,
        { templateKey: template.key },
      );
    }

    if (template.pendingMode === "forbidden" && request.pending) {
      throw new DomainError(
        "accounting_pack.posting_plan_invalid",
        `Template ${template.key} does not allow pending config`,
        { templateKey: template.key },
      );
    }

    return;
  }

  if (!request.pending?.pendingId || request.pending.pendingId <= 0n) {
    throw new DomainError(
      "accounting_pack.posting_plan_invalid",
      `Template ${template.key} requires pending.pendingId`,
      { templateKey: template.key },
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
      throw new DomainError(
        "accounting_pack.unknown_template",
        `Unknown posting template: ${request.templateKey}`,
        { templateKey: request.templateKey },
      );
    }

    if (!template.allowSources.includes(accountingSourceId)) {
      throw new DomainError(
        "accounting_pack.template_access_forbidden",
        `Accounting source ${accountingSourceId} is not allowed to use template ${request.templateKey}`,
        {
          accountingSourceId,
          templateKey: request.templateKey,
        },
      );
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
      postingCode: "postingCode" in template ? template.postingCode : null,
    });
  }

  const intent: OperationIntent = {
    source: input.source,
    operationCode: plan.operationCode,
    operationVersion: plan.operationVersion,
    payload: plan.payload,
    idempotencyKey: input.idempotencyKey,
    postingDate: input.postingDate,
    lines,
  };

  const postingPlanChecksum = sha256Hex(
    canonicalJson({
      operationCode: plan.operationCode,
      operationVersion: plan.operationVersion,
      payload: plan.payload,
      requests: plan.requests,
      packChecksum: compiledPack.checksum,
    }),
  );

  const journalIntentChecksum = sha256Hex(
    canonicalJson({
      source: intent.source,
      operationCode: intent.operationCode,
      operationVersion: intent.operationVersion,
      payload: intent.payload,
      postingDate: intent.postingDate,
      lines: intent.lines,
    }),
  );

  return {
    intent,
    packChecksum: compiledPack.checksum,
    postingPlanChecksum,
    journalIntentChecksum,
    appliedTemplates,
  };
}
