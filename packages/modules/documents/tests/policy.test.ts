import { describe, expect, it } from "vitest";

import {
  createDefaultDocumentActionPolicyService,
  createRuleBasedDocumentActionPolicyService,
} from "../src";
import type { DocumentModule } from "../src/plugins";

function createModuleStub(approvalRequired: boolean): DocumentModule {
  return {
    docType: "test.doc",
    docNoPrefix: "TST",
    payloadVersion: 1,
    createSchema: {} as any,
    updateSchema: {} as any,
    payloadSchema: {} as any,
    postingRequired: false,
    approvalRequired: () => approvalRequired,
    async createDraft() {
      throw new Error("not implemented");
    },
    async updateDraft() {
      throw new Error("not implemented");
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    buildPostIdempotencyKey() {
      return "idem";
    },
  };
}

describe("createDefaultDocumentActionPolicyService", () => {
  it("uses maker-checker approval mode when approval is required", async () => {
    const service = createDefaultDocumentActionPolicyService();
    const module = createModuleStub(true);

    const mode = await service.approvalMode({
      module,
      document: {
        id: "doc-1",
      } as any,
      actorUserId: "user-2",
      moduleContext: {} as any,
    });

    expect(mode).toBe("maker_checker");
  });

  it("denies approve when maker-checker would approve own document", async () => {
    const service = createDefaultDocumentActionPolicyService();
    const module = createModuleStub(true);

    const decision = await service.canApprove({
      module,
      document: {
        id: "doc-1",
        createdBy: "user-1",
      } as any,
      actorUserId: "user-1",
      moduleContext: {} as any,
    });

    expect(decision.allow).toBe(false);
    expect(decision.reasonCode).toBe("maker_checker_denied");
  });
});

describe("createRuleBasedDocumentActionPolicyService", () => {
  it("uses the first matching approval rule", async () => {
    const service = createRuleBasedDocumentActionPolicyService({
      rules: [
        {
          docTypes: ["test.doc"],
          channels: ["wire"],
          approvalMode: "maker_checker",
        },
      ],
    });
    const module = createModuleStub(false);

    const mode = await service.approvalMode({
      module,
      document: {
        id: "doc-1",
        docType: "test.doc",
        payload: { channel: "wire" },
        amountMinor: 100n,
        currency: "USD",
      } as any,
      actorUserId: "user-2",
      moduleContext: {} as any,
    });

    expect(mode).toBe("maker_checker");
  });

  it("falls back to module approval behavior when no rule matches", async () => {
    const service = createRuleBasedDocumentActionPolicyService({
      rules: [],
    });
    const module = createModuleStub(true);

    const mode = await service.approvalMode({
      module,
      document: {
        id: "doc-1",
        docType: "test.doc",
        payload: {},
      } as any,
      actorUserId: "user-2",
      moduleContext: {} as any,
    });

    expect(mode).toBe("maker_checker");
  });

  it("treats admin actors as approval-exempt when configured", async () => {
    const service = createRuleBasedDocumentActionPolicyService({
      rules: [
        {
          docTypes: ["test.doc"],
          approvalMode: "maker_checker",
        },
      ],
      isActorExemptFromApproval: ({ actorUserId }) => actorUserId === "admin-1",
    });
    const module = createModuleStub(false);

    const mode = await service.approvalMode({
      module,
      document: {
        id: "doc-1",
        docType: "test.doc",
        payload: {},
      } as any,
      actorUserId: "admin-1",
      moduleContext: {} as any,
    });

    expect(mode).toBe("not_required");
  });
});
