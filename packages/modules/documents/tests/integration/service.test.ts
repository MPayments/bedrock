import { randomUUID } from "node:crypto";
import { z } from "zod";

import { noopLogger } from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";

import { db, pool } from "./setup";
import { createDocumentsModule } from "../../src";
import {
  DrizzleDocumentEventsRepository,
  DrizzleDocumentLinksRepository,
  DrizzleDocumentOperationsRepository,
  DrizzleDocumentSnapshotsRepository,
  DrizzleDocumentsModuleRuntime,
  DrizzleDocumentsQueries,
  DrizzleDocumentsUnitOfWork,
} from "../../src/adapters/drizzle";
import type {
  DocumentActionPolicyService,
  DocumentModuleContext,
  DocumentModule,
  DocumentRegistry,
} from "../../src/plugins";

const DOC_TYPE = "integration_document";
const DOC_PREFIX = "DIT";
const ACTOR_ID = "documents-it-actor";

const IntegrationPayloadSchema = z
  .object({
    memo: z.string().trim().min(1),
    parentDocumentId: z.string().uuid().optional(),
  })
  .strict();

function createIntegrationModule(): DocumentModule<
  z.infer<typeof IntegrationPayloadSchema>,
  z.infer<typeof IntegrationPayloadSchema>
> {
  function requireDraftMetadata(context: DocumentModuleContext) {
    if (!context.draft) {
      throw new Error("Draft metadata is required for integration drafts");
    }

    return context.draft;
  }

  function buildIntegrationSummary(input: {
    docNo: string;
    docType: string;
    payload: z.infer<typeof IntegrationPayloadSchema>;
  }) {
    const memo = input.payload.memo;
    const parentDocumentId =
      typeof input.payload.parentDocumentId === "string"
        ? input.payload.parentDocumentId
        : null;

    return {
      title: `Integration ${memo}`,
      memo,
      searchText: parentDocumentId
        ? `${input.docNo} ${input.docType} ${memo} ${parentDocumentId}`
        : `${input.docNo} ${input.docType} ${memo}`,
    };
  }

  return {
    docType: DOC_TYPE,
    docNoPrefix: DOC_PREFIX,
    payloadVersion: 1,
    createSchema: IntegrationPayloadSchema,
    updateSchema: IntegrationPayloadSchema,
    payloadSchema: IntegrationPayloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);

      return {
        occurredAt: new Date("2026-03-10T12:00:00.000Z"),
        payload: input,
        summary: buildIntegrationSummary({
          docNo: draft.docNo,
          docType: draft.docType,
          payload: input,
        }),
      };
    },
    async updateDraft(context, _document, input) {
      const draft = requireDraftMetadata(context);

      return {
        payload: input,
        summary: buildIntegrationSummary({
          docNo: draft.docNo,
          docType: draft.docType,
          payload: input,
        }),
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    buildPostIdempotencyKey(document) {
      return `post:${document.id}`;
    },
    async buildInitialLinks(_context, document) {
      const parentDocumentId =
        typeof document.payload.parentDocumentId === "string"
          ? document.payload.parentDocumentId
          : null;

      return parentDocumentId
        ? [{ toDocumentId: parentDocumentId, linkType: "parent" as const }]
        : [];
    },
    async buildDetails(_context, document) {
      const memo =
        typeof document.payload.memo === "string" ? document.payload.memo : "";
      const parentDocumentId =
        typeof document.payload.parentDocumentId === "string"
          ? document.payload.parentDocumentId
          : null;

      return {
        computed: { memoLength: memo.length },
        extra: { parentDocumentId },
      };
    },
  };
}

function createRegistry(modules: DocumentModule[]): DocumentRegistry {
  const byDocType = new Map(modules.map((module) => [module.docType, module]));

  return {
    getDocumentModules() {
      return [...byDocType.values()];
    },
    getDocumentModule(docType: string) {
      const module = byDocType.get(docType);
      if (!module) {
        throw new Error(`Unknown document module: ${docType}`);
      }

      return module;
    },
  };
}

function createPassThroughPolicy(): DocumentActionPolicyService | undefined {
  return undefined;
}

function createDocumentsRuntime() {
  const registry = createRegistry([createIntegrationModule()]);
  const idempotency = {
    async withIdempotencyTx<T>(input: { handler: () => Promise<T> }) {
      return input.handler();
    },
  };

  return createDocumentsModule({
    logger: noopLogger,
    generateUuid: randomUUID,
    now: () => new Date("2026-03-12T08:30:00.000Z"),
    accounting: {
      getDefaultCompiledPack() {
        throw new Error("Not used in documents integration tests");
      },
      async loadActiveCompiledPackForBook() {
        throw new Error("Not used in documents integration tests");
      },
      async resolvePostingPlan() {
        throw new Error("Not used in documents integration tests");
      },
    },
    accountingPeriods: {
      async assertOrganizationPeriodsOpen() {},
      async closePeriod() {},
      async isOrganizationPeriodClosed() {
        return false;
      },
      async listClosedOrganizationIdsForPeriod() {
        return [];
      },
      async reopenPeriod() {},
    },
    documentEvents: new DrizzleDocumentEventsRepository(db),
    documentLinks: new DrizzleDocumentLinksRepository(db),
    documentOperations: new DrizzleDocumentOperationsRepository(db),
    documentSnapshots: new DrizzleDocumentSnapshotsRepository(db),
    documentsQuery: new DrizzleDocumentsQueries(db),
    ledgerReadService: {
      async listOperationDetails() {
        return new Map();
      },
      async getOperationDetails() {
        return null;
      },
    },
    moduleRuntime: new DrizzleDocumentsModuleRuntime(db),
    policy: createPassThroughPolicy(),
    registry,
    unitOfWork: new DrizzleDocumentsUnitOfWork({
      persistence: createPersistenceContext(db),
      idempotency,
    }),
  });
}

async function ensureActorUser() {
  await pool.query(
    `
      INSERT INTO "user" (id, name, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `,
    [ACTOR_ID, "Documents Integration Actor", "documents-it-actor@example.com"],
  );
}

describe("documents integration", () => {
  it("creates drafts idempotently and persists a single create event", async () => {
    await ensureActorUser();
    const documentsModule = createDocumentsRuntime();
    const createIdempotencyKey = `create-${randomUUID()}`;

    const created = await documentsModule.documents.commands.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey,
      payload: { memo: "first draft" },
      actorUserId: ACTOR_ID,
    });

    const replayed = await documentsModule.documents.commands.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey,
      payload: { memo: "first draft" },
      actorUserId: ACTOR_ID,
    });

    expect(replayed.document.id).toBe(created.document.id);

    const details = await documentsModule.documents.queries.getDetails(
      DOC_TYPE,
      created.document.id,
      ACTOR_ID,
    );
    expect(details.events.map((event) => event.eventType)).toEqual(["create"]);

    const listed = await documentsModule.documents.queries.list({
      docType: [DOC_TYPE],
    });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.document.id).toBe(created.document.id);
  });

  it("updates drafts and exposes parent links plus module-built details", async () => {
    await ensureActorUser();
    const documentsModule = createDocumentsRuntime();

    const parent = await documentsModule.documents.commands.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey: `parent-${randomUUID()}`,
      payload: { memo: "parent draft" },
      actorUserId: ACTOR_ID,
    });

    const child = await documentsModule.documents.commands.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey: `child-${randomUUID()}`,
      payload: {
        memo: "child draft",
        parentDocumentId: parent.document.id,
      },
      actorUserId: ACTOR_ID,
    });

    await documentsModule.documents.commands.updateDraft({
      docType: DOC_TYPE,
      documentId: child.document.id,
      payload: {
        memo: "child draft updated",
        parentDocumentId: parent.document.id,
      },
      actorUserId: ACTOR_ID,
    });

    const details = await documentsModule.documents.queries.getDetails(
      DOC_TYPE,
      child.document.id,
      ACTOR_ID,
    );

    expect(details.document.memo).toBe("child draft updated");
    expect(details.parent?.id).toBe(parent.document.id);
    expect(details.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromDocumentId: child.document.id,
          toDocumentId: parent.document.id,
          linkType: "parent",
        }),
      ]),
    );
    expect(details.events.map((event) => event.eventType)).toEqual([
      "create",
      "update",
    ]);
    expect(details.computed).toEqual({ memoLength: "child draft updated".length });
    expect(details.extra).toEqual({ parentDocumentId: parent.document.id });
  });

  it("submits drafts and returns submitted rows from the query surface", async () => {
    await ensureActorUser();
    const documentsModule = createDocumentsRuntime();

    const created = await documentsModule.documents.commands.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey: `submit-${randomUUID()}`,
      payload: { memo: "submit me" },
      actorUserId: ACTOR_ID,
    });

    const submitted = await documentsModule.lifecycle.commands.execute({
      action: "submit",
      docType: DOC_TYPE,
      documentId: created.document.id,
      actorUserId: ACTOR_ID,
    });

    expect(submitted.document.submissionStatus).toBe("submitted");
    expect(submitted.document.submittedBy).toBe(ACTOR_ID);

    const listed = await documentsModule.documents.queries.list({
      docType: [DOC_TYPE],
      submissionStatus: ["submitted"],
    });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.document.id).toBe(created.document.id);

    const details = await documentsModule.documents.queries.getDetails(
      DOC_TYPE,
      created.document.id,
      ACTOR_ID,
    );
    expect(details.events.map((event) => event.eventType)).toEqual([
      "create",
      "submit",
    ]);
  });
});
