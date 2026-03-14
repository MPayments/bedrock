import type { DocumentAction } from "../../domain/state-machine";
import type { Document } from "../../domain/types";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentModuleContext,
  DocumentPolicyDecision,
} from "../../plugins";

export async function invokeDocumentModuleAction(input: {
  action: DocumentAction;
  module: DocumentModule;
  moduleContext: DocumentModuleContext;
  document: Document;
}): Promise<void> {
  switch (input.action) {
    case "edit":
      await input.module.canEdit(input.moduleContext, input.document);
      return;
    case "submit":
      await input.module.canSubmit(input.moduleContext, input.document);
      return;
    case "approve":
      await input.module.canApprove(input.moduleContext, input.document);
      return;
    case "reject":
      await input.module.canReject(input.moduleContext, input.document);
      return;
    case "post":
      if (
        input.module.allowDirectPostFromDraft &&
        input.document.submissionStatus === "draft"
      ) {
        await input.module.canSubmit(input.moduleContext, input.document);
      }
      await input.module.canPost(input.moduleContext, input.document);
      return;
    case "cancel":
      await input.module.canCancel(input.moduleContext, input.document);
      return;
    case "repost":
      return;
    default: {
      const exhaustiveAction: never = input.action;
      throw new Error(`Unknown document action: ${String(exhaustiveAction)}`);
    }
  }
}

export async function resolveDocumentPolicyDecision(input: {
  policy: DocumentActionPolicyService;
  action: DocumentAction | "create";
  module: DocumentModule;
  actorUserId: string;
  moduleContext: DocumentModuleContext;
  payload?: unknown;
  document?: Document;
}): Promise<DocumentPolicyDecision> {
  switch (input.action) {
    case "create":
      return input.policy.canCreate({
        module: input.module,
        actorUserId: input.actorUserId,
        payload: input.payload,
        moduleContext: input.moduleContext,
      });
    case "edit":
      return input.policy.canEdit({
        module: input.module,
        document: input.document!,
        actorUserId: input.actorUserId,
        moduleContext: input.moduleContext,
      });
    case "submit":
      return input.policy.canSubmit({
        module: input.module,
        document: input.document!,
        actorUserId: input.actorUserId,
        moduleContext: input.moduleContext,
      });
    case "approve":
      return input.policy.canApprove({
        module: input.module,
        document: input.document!,
        actorUserId: input.actorUserId,
        moduleContext: input.moduleContext,
      });
    case "reject":
      return input.policy.canReject({
        module: input.module,
        document: input.document!,
        actorUserId: input.actorUserId,
        moduleContext: input.moduleContext,
      });
    case "post":
      if (
        input.module.allowDirectPostFromDraft &&
        input.document!.submissionStatus === "draft"
      ) {
        const submitDecision = await input.policy.canSubmit({
          module: input.module,
          document: input.document!,
          actorUserId: input.actorUserId,
          moduleContext: input.moduleContext,
        });
        if (!submitDecision.allow) {
          return submitDecision;
        }
      }

      return input.policy.canPost({
        module: input.module,
        document: input.document!,
        actorUserId: input.actorUserId,
        moduleContext: input.moduleContext,
      });
    case "cancel":
      return input.policy.canCancel({
        module: input.module,
        document: input.document!,
        actorUserId: input.actorUserId,
        moduleContext: input.moduleContext,
      });
    case "repost":
      return {
        allow: true,
        reasonCode: "allowed",
        reasonMeta: null,
      };
    default: {
      const exhaustiveAction: never = input.action;
      throw new Error(`Unknown document action: ${String(exhaustiveAction)}`);
    }
  }
}
