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

import { requisitesRoutes } from "../../src/routes/requisites";

const requisite = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerType: "organization" as const,
  ownerId: "22222222-2222-4222-8222-222222222222",
  providerId: "33333333-3333-4333-8333-333333333333",
  currencyId: "44444444-4444-4444-8444-444444444444",
  kind: "bank" as const,
  label: "Multihansa Russia USD",
  description: null,
  beneficiaryName: "Multihansa Russia",
  institutionName: "AO Bank",
  institutionCountry: "RU",
  accountNo: "40702810000000000001",
  corrAccount: null,
  iban: null,
  bic: null,
  swift: null,
  bankAddress: null,
  network: null,
  assetCode: null,
  address: null,
  memoTag: null,
  accountRef: null,
  subaccountRef: null,
  contact: null,
  notes: null,
  isDefault: true,
  createdAt: new Date("2026-03-28T09:00:00.000Z"),
  updatedAt: new Date("2026-03-28T09:00:00.000Z"),
  archivedAt: null,
};

function createTestApp() {
  const partiesModule = {
    requisites: {
      queries: {
        list: vi.fn(),
        listOptions: vi.fn(),
        findById: vi.fn(async () => requisite),
        getBinding: vi.fn(),
      },
      commands: {
        remove: vi.fn(async () => undefined),
      },
    },
  };
  const requisiteAccountingWorkflow = {
    create: vi.fn(async () => requisite),
    update: vi.fn(async () => requisite),
    upsertBinding: vi.fn(),
  };
  const requisiteTreasurySyncService = {
    sync: vi.fn(async () => undefined),
    archive: vi.fn(async () => undefined),
  };

  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {} as any);
    await next();
  });
  app.route(
    "/",
    requisitesRoutes({
      partiesModule,
      requisiteAccountingWorkflow,
      requisiteTreasurySyncService,
    } as any),
  );

  return {
    app,
    partiesModule,
    requisiteAccountingWorkflow,
    requisiteTreasurySyncService,
  };
}

describe("requisitesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("syncs treasury resources after create", async () => {
    const { app, requisiteAccountingWorkflow, requisiteTreasurySyncService } =
      createTestApp();

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ownerType: "organization",
        ownerId: requisite.ownerId,
        providerId: requisite.providerId,
        currencyId: requisite.currencyId,
        kind: "bank",
        label: requisite.label,
        description: null,
        beneficiaryName: requisite.beneficiaryName,
        institutionName: requisite.institutionName,
        institutionCountry: requisite.institutionCountry,
        accountNo: requisite.accountNo,
        corrAccount: null,
        iban: null,
        bic: null,
        swift: null,
        bankAddress: null,
        network: null,
        assetCode: null,
        address: null,
        memoTag: null,
        accountRef: null,
        subaccountRef: null,
        contact: null,
        notes: null,
        isDefault: true,
      }),
    });

    expect(response.status).toBe(201);
    expect(requisiteAccountingWorkflow.create).toHaveBeenCalled();
    expect(requisiteTreasurySyncService.sync).toHaveBeenCalledWith(requisite);
  });

  it("syncs treasury resources after update", async () => {
    const { app, requisiteAccountingWorkflow, requisiteTreasurySyncService } =
      createTestApp();

    const response = await app.request(`http://localhost/${requisite.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Updated label",
      }),
    });

    expect(response.status).toBe(200);
    expect(requisiteAccountingWorkflow.update).toHaveBeenCalledWith(
      requisite.id,
      { label: "Updated label" },
    );
    expect(requisiteTreasurySyncService.sync).toHaveBeenCalledWith(requisite);
  });

  it("archives treasury resources after delete", async () => {
    const { app, partiesModule, requisiteTreasurySyncService } = createTestApp();

    const response = await app.request(`http://localhost/${requisite.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(partiesModule.requisites.commands.remove).toHaveBeenCalledWith(
      requisite.id,
    );
    expect(requisiteTreasurySyncService.archive).toHaveBeenCalledWith(
      expect.objectContaining({
        id: requisite.id,
      }),
    );
  });
});
