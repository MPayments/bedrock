import { createDefaultDocumentActionPolicyService } from "./default-action-policy";
import type { DocumentSnapshot } from "../../../documents/domain/document";
import { collectDocumentOrganizationIds } from "../../../documents/domain/document-period-scope";
import type {
  DocumentActionPolicyService,
  DocumentApprovalMode,
  DocumentModule,
  DocumentModuleContext,
  DocumentPolicyDecision,
} from "../../../plugins";

export interface DocumentApprovalRule {
  docTypes: string[];
  organizationIds?: string[];
  currencies?: string[];
  channels?: string[];
  minAmountMinor?: bigint | null;
  maxAmountMinor?: bigint | null;
  approvalMode: DocumentApprovalMode;
}

function allow(reasonCode = "allowed"): DocumentPolicyDecision {
  return {
    allow: true,
    reasonCode,
    reasonMeta: null,
  };
}

function makerCheckerDenied(
  document: DocumentSnapshot,
  actorUserId: string,
) {
  return {
    allow: false,
    reasonCode: "maker_checker_denied",
    reasonMeta: {
      documentId: document.id,
      createdBy: document.createdBy,
      actorUserId,
    },
  } satisfies DocumentPolicyDecision;
}

function resolveDocumentChannel(document: DocumentSnapshot): string {
  const channel = document.payload.channel;
  if (typeof channel === "string" && channel.trim().length > 0) {
    return channel.trim();
  }

  return document.docType;
}

function matchesRule(
  rule: DocumentApprovalRule,
  document: DocumentSnapshot,
): boolean {
  if (!rule.docTypes.includes(document.docType)) {
    return false;
  }

  if (
    rule.organizationIds &&
    rule.organizationIds.length > 0 &&
    !collectDocumentOrganizationIds({ payload: document.payload }).some((id) =>
      rule.organizationIds!.includes(id),
    )
  ) {
    return false;
  }

  if (
    rule.currencies &&
    rule.currencies.length > 0 &&
    (!document.currency || !rule.currencies.includes(document.currency))
  ) {
    return false;
  }

  if (
    rule.channels &&
    rule.channels.length > 0 &&
    !rule.channels.includes(resolveDocumentChannel(document))
  ) {
    return false;
  }

  if (
    rule.minAmountMinor !== undefined &&
    rule.minAmountMinor !== null &&
    (!document.amountMinor || document.amountMinor < rule.minAmountMinor)
  ) {
    return false;
  }

  if (
    rule.maxAmountMinor !== undefined &&
    rule.maxAmountMinor !== null &&
    (!document.amountMinor || document.amountMinor > rule.maxAmountMinor)
  ) {
    return false;
  }

  return true;
}

export function createRuleBasedDocumentActionPolicyService(input: {
  rules: DocumentApprovalRule[];
  fallback?: DocumentActionPolicyService;
  isActorExemptFromApproval?(args: {
    actorUserId: string;
    module: DocumentModule;
    document: DocumentSnapshot;
    moduleContext: DocumentModuleContext;
  }): Promise<boolean> | boolean;
}): DocumentActionPolicyService {
  const fallback =
    input.fallback ?? createDefaultDocumentActionPolicyService();

  async function approvalMode(args: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentApprovalMode> {
    if (
      (await input.isActorExemptFromApproval?.(args)) === true
    ) {
      return "not_required";
    }

    const matchedRule = input.rules.find((rule) =>
      matchesRule(rule, args.document),
    );

    if (matchedRule) {
      return matchedRule.approvalMode;
    }

    return fallback.approvalMode(args);
  }

  return {
    approvalMode,
    canCreate(inputArgs) {
      return fallback.canCreate(inputArgs);
    },
    canEdit(inputArgs) {
      return fallback.canEdit(inputArgs);
    },
    canSubmit(inputArgs) {
      return fallback.canSubmit(inputArgs);
    },
    async canApprove(inputArgs) {
      const fallbackDecision = await fallback.canApprove(inputArgs);
      if (!fallbackDecision.allow) {
        return fallbackDecision;
      }

      const mode = await approvalMode(inputArgs);
      if (
        mode === "maker_checker" &&
        inputArgs.document.createdBy === inputArgs.actorUserId
      ) {
        return makerCheckerDenied(inputArgs.document, inputArgs.actorUserId);
      }

      return allow();
    },
    canReject(inputArgs) {
      return fallback.canReject(inputArgs);
    },
    canPost(inputArgs) {
      return fallback.canPost(inputArgs);
    },
    canCancel(inputArgs) {
      return fallback.canCancel(inputArgs);
    },
  };
}
