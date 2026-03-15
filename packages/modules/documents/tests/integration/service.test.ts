import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import { db, pool } from "./setup";
import { createDocumentsService } from "../../src";
import { createDrizzleDocumentsReadModel } from "../../src/infra/drizzle/queries";
import {
  createDrizzleDocumentEventsRepository,
  createDrizzleDocumentLinksRepository,
  createDrizzleDocumentOperationsRepository,
  createDrizzleDocumentSnapshotsRepository,
  createDrizzleDocumentsCommandRepository,
  createDrizzleDocumentsQueryRepository,
} from "../../src/infra/drizzle/repository";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentModuleRuntime,
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
  return {
    docType: DOC_TYPE,
    docNoPrefix: DOC_PREFIX,
    payloadVersion: 1,
    createSchema: IntegrationPayloadSchema,
    updateSchema: IntegrationPayloadSchema,
    payloadSchema: IntegrationPayloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return {
        occurredAt: new Date("2026-03-10T12:00:00.000Z"),
        payload: input,
      };
    },
    async updateDraft(_context, _document, input) {
      return {
        payload: input,
      };
    },
    deriveSummary(document) {
      const memo =
        typeof document.payload.memo === "string" ? document.payload.memo : "";
      const parentDocumentId =
        typeof document.payload.parentDocumentId === "string"
          ? document.payload.parentDocumentId
          : null;

      return {
        title: `Integration ${memo}`,
        memo,
        searchText: parentDocumentId ? `${memo} ${parentDocumentId}` : memo,
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

function createModuleRuntime(
  database: Database | Transaction,
): DocumentModuleRuntime {
  return {
    documents: createDrizzleDocumentsReadModel({ db: database }),
    withQueryable: (run) => run(database),
  };
}

function createPassThroughPolicy(): DocumentActionPolicyService | undefined {
  return undefined;
}

function createDocumentsRuntime() {
  const registry = createRegistry([createIntegrationModule()]);

  return createDocumentsService({
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
    documentEvents: createDrizzleDocumentEventsRepository(db),
    documentLinks: createDrizzleDocumentLinksRepository(db),
    documentOperations: createDrizzleDocumentOperationsRepository(db),
    documentSnapshots: createDrizzleDocumentSnapshotsRepository(db),
    documentsQuery: createDrizzleDocumentsQueryRepository(db),
    ledgerReadService: {
      async listOperationDetails() {
        return new Map();
      },
      async getOperationDetails() {
        return null;
      },
    },
    moduleRuntime: createModuleRuntime(db),
    policy: createPassThroughPolicy(),
    registry,
    now: () => new Date("2026-03-12T08:30:00.000Z"),
    transactions: {
      async withTransaction(run) {
        return db.transaction(async (tx) =>
          run({
            moduleRuntime: createModuleRuntime(tx),
            documentEvents: createDrizzleDocumentEventsRepository(tx),
            documentLinks: createDrizzleDocumentLinksRepository(tx),
            documentOperations: createDrizzleDocumentOperationsRepository(tx),
            documentsCommand: createDrizzleDocumentsCommandRepository(tx),
            idempotency: {
              async withIdempotency(input) {
                return input.handler();
              },
            },
            ledger: {
              async commit() {
                throw new Error("Not used in documents integration tests");
              },
            },
          }),
        );
      },
    },
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
    const service = createDocumentsRuntime();
    const createIdempotencyKey = `create-${randomUUID()}`;

    const created = await service.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey,
      payload: { memo: "first draft" },
      actorUserId: ACTOR_ID,
    });

    const replayed = await service.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey,
      payload: { memo: "first draft" },
      actorUserId: ACTOR_ID,
    });

    expect(replayed.document.id).toBe(created.document.id);

    const details = await service.getDetails(DOC_TYPE, created.document.id, ACTOR_ID);
    expect(details.events.map((event) => event.eventType)).toEqual(["create"]);

    const listed = await service.list({ docType: [DOC_TYPE] });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.document.id).toBe(created.document.id);
  });

  it("updates drafts and exposes parent links plus module-built details", async () => {
    await ensureActorUser();
    const service = createDocumentsRuntime();

    const parent = await service.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey: `parent-${randomUUID()}`,
      payload: { memo: "parent draft" },
      actorUserId: ACTOR_ID,
    });

    const child = await service.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey: `child-${randomUUID()}`,
      payload: {
        memo: "child draft",
        parentDocumentId: parent.document.id,
      },
      actorUserId: ACTOR_ID,
    });

    await service.updateDraft({
      docType: DOC_TYPE,
      documentId: child.document.id,
      payload: {
        memo: "child draft updated",
        parentDocumentId: parent.document.id,
      },
      actorUserId: ACTOR_ID,
    });

    const details = await service.getDetails(DOC_TYPE, child.document.id, ACTOR_ID);

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
    const service = createDocumentsRuntime();

    const created = await service.createDraft({
      docType: DOC_TYPE,
      createIdempotencyKey: `submit-${randomUUID()}`,
      payload: { memo: "submit me" },
      actorUserId: ACTOR_ID,
    });

    const submitted = await service.transition({
      action: "submit",
      docType: DOC_TYPE,
      documentId: created.document.id,
      actorUserId: ACTOR_ID,
    });

    expect(submitted.document.submissionStatus).toBe("submitted");
    expect(submitted.document.submittedBy).toBe(ACTOR_ID);

    const listed = await service.list({
      docType: [DOC_TYPE],
      submissionStatus: ["submitted"],
    });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.document.id).toBe(created.document.id);

    const details = await service.getDetails(DOC_TYPE, created.document.id, ACTOR_ID);
    expect(details.events.map((event) => event.eventType)).toEqual([
      "create",
      "submit",
    ]);
  });
});
