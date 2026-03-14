import { describe, expect, it } from "vitest";

import { createDefaultDocumentActionPolicyService } from "../src/domain/default-action-policy";
import type { DocumentModule } from "../src/types";

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
    deriveSummary() {
      return {
        title: "Test",
        searchText: "test",
      };
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
