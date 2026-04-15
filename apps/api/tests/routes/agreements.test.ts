import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { AgreementNotFoundError } from "@bedrock/agreements";

import { agreementsRoutes } from "../../src/routes/agreements";

function createAgreementDetail() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000010",
    customerId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentVersion: {
      id: "00000000-0000-4000-8000-000000000011",
      versionNumber: 1,
      contractNumber: "AG-2026-001",
      contractDate: now,
      createdAt: now,
      updatedAt: now,
      feeRules: [
        {
          id: "00000000-0000-4000-8000-000000000012",
          kind: "agent_fee" as const,
          unit: "bps" as const,
          value: "125",
          currencyId: null,
          currencyCode: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      parties: [
        {
          id: "00000000-0000-4000-8000-000000000013",
          partyRole: "customer" as const,
          partyId: "00000000-0000-4000-8000-000000000001",
          customerId: "00000000-0000-4000-8000-000000000001",
          organizationId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "00000000-0000-4000-8000-000000000014",
          partyRole: "organization" as const,
          partyId: "00000000-0000-4000-8000-000000000002",
          customerId: null,
          organizationId: "00000000-0000-4000-8000-000000000002",
          createdAt: now,
          updatedAt: now,
        },
      ],
      routePolicies: [],
    },
  };
}

function createAgreementsModuleStub() {
  return {
    agreements: {
      queries: {
        list: vi.fn(),
        findById: vi.fn(),
        resolveRouteDefaults: vi.fn(),
      },
      commands: {
        archive: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}

function createTestApp() {
  const agreementsModule = createAgreementsModuleStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route("/agreements", agreementsRoutes({ agreementsModule } as any));

  return { app, agreementsModule };
}

describe("agreements routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists, fetches, and creates agreements", async () => {
    const { app, agreementsModule } = createTestApp();
    const detail = createAgreementDetail();
    agreementsModule.agreements.queries.list.mockResolvedValue({
      data: [
        {
          id: detail.id,
          customerId: detail.customerId,
          organizationId: detail.organizationId,
          organizationRequisiteId: detail.organizationRequisiteId,
          isActive: detail.isActive,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
          currentVersion: {
            id: detail.currentVersion.id,
            versionNumber: detail.currentVersion.versionNumber,
            contractNumber: detail.currentVersion.contractNumber,
            contractDate: detail.currentVersion.contractDate,
            createdAt: detail.currentVersion.createdAt,
            updatedAt: detail.currentVersion.updatedAt,
          },
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    agreementsModule.agreements.queries.findById.mockResolvedValue(detail);
    agreementsModule.agreements.commands.create.mockResolvedValue(detail);

    const listResponse = await app.request("http://localhost/agreements");
    const getResponse = await app.request(
      `http://localhost/agreements/${detail.id}`,
    );
    const createResponse = await app.request("http://localhost/agreements", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "agreement-create-1",
      },
      body: JSON.stringify({
        customerId: detail.customerId,
        organizationId: detail.organizationId,
        organizationRequisiteId: detail.organizationRequisiteId,
        contractNumber: detail.currentVersion.contractNumber,
        contractDate: detail.currentVersion.contractDate.toISOString(),
        feeRules: [
          {
            kind: "agent_fee",
            unit: "bps",
            value: "125",
          },
        ],
      }),
    });

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      data: [
        {
          id: detail.id,
          customerId: detail.customerId,
          organizationId: detail.organizationId,
          organizationRequisiteId: detail.organizationRequisiteId,
          isActive: true,
          createdAt: detail.createdAt.toISOString(),
          updatedAt: detail.updatedAt.toISOString(),
          currentVersion: {
            id: detail.currentVersion.id,
            versionNumber: 1,
            contractNumber: "AG-2026-001",
            contractDate: detail.currentVersion.contractDate.toISOString(),
            createdAt: detail.currentVersion.createdAt.toISOString(),
            updatedAt: detail.currentVersion.updatedAt.toISOString(),
          },
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    expect(getResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      id: detail.id,
      customerId: detail.customerId,
      organizationId: detail.organizationId,
      organizationRequisiteId: detail.organizationRequisiteId,
      isActive: true,
    });

    expect(agreementsModule.agreements.queries.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(agreementsModule.agreements.queries.findById).toHaveBeenCalledWith(
      detail.id,
    );
    expect(agreementsModule.agreements.commands.create).toHaveBeenCalledWith({
      customerId: detail.customerId,
      organizationId: detail.organizationId,
      organizationRequisiteId: detail.organizationRequisiteId,
      contractNumber: "AG-2026-001",
      contractDate: detail.currentVersion.contractDate,
      feeRules: [
        {
          kind: "agent_fee",
          unit: "bps",
          value: "125",
        },
      ],
      routePolicies: [],
      actorUserId: "user-1",
      idempotencyKey: "agreement-create-1",
    });
  });

  it("requires Idempotency-Key for create", async () => {
    const { app, agreementsModule } = createTestApp();
    const response = await app.request("http://localhost/agreements", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: "00000000-0000-4000-8000-000000000002",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Idempotency-Key header",
    });
    expect(agreementsModule.agreements.commands.create).not.toHaveBeenCalled();
  });

  it("updates and archives agreements", async () => {
    const { app, agreementsModule } = createTestApp();
    const detail = createAgreementDetail();
    const updated = {
      ...detail,
      currentVersion: {
        ...detail.currentVersion,
        versionNumber: 2,
        contractNumber: "AG-2026-002",
      },
    };
    agreementsModule.agreements.commands.update.mockResolvedValue(updated);
    agreementsModule.agreements.commands.archive.mockResolvedValue(true);

    const patchResponse = await app.request(
      `http://localhost/agreements/${detail.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "agreement-update-1",
        },
        body: JSON.stringify({
          contractNumber: "AG-2026-002",
        }),
      },
    );
    const deleteResponse = await app.request(
      `http://localhost/agreements/${detail.id}`,
      {
        method: "DELETE",
      },
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      id: detail.id,
      isActive: true,
      currentVersion: {
        versionNumber: 2,
        contractNumber: "AG-2026-002",
      },
    });
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ deleted: true });

    expect(agreementsModule.agreements.commands.update).toHaveBeenCalledWith({
      contractNumber: "AG-2026-002",
      actorUserId: "user-1",
      id: detail.id,
      idempotencyKey: "agreement-update-1",
    });
    expect(agreementsModule.agreements.commands.archive).toHaveBeenCalledWith(
      detail.id,
    );
  });

  it("maps not-found errors on detail fetch", async () => {
    const { app, agreementsModule } = createTestApp();
    agreementsModule.agreements.queries.findById.mockRejectedValue(
      new AgreementNotFoundError("00000000-0000-4000-8000-000000000099"),
    );

    const response = await app.request(
      "http://localhost/agreements/00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(404);
  });

  it("resolves effective route defaults", async () => {
    const { app, agreementsModule } = createTestApp();
    agreementsModule.agreements.queries.resolveRouteDefaults.mockResolvedValue({
      agreementId: "00000000-0000-4000-8000-000000000010",
      agreementVersionId: "00000000-0000-4000-8000-000000000011",
      policy: null,
    });

    const response = await app.request(
      "http://localhost/agreements/00000000-0000-4000-8000-000000000010/route-defaults?dealType=payment",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      agreementId: "00000000-0000-4000-8000-000000000010",
      agreementVersionId: "00000000-0000-4000-8000-000000000011",
      policy: null,
    });
    expect(
      agreementsModule.agreements.queries.resolveRouteDefaults,
    ).toHaveBeenCalledWith({
      agreementId: "00000000-0000-4000-8000-000000000010",
      dealType: "payment",
      sourceCurrencyId: null,
      targetCurrencyId: null,
    });
  });
});
