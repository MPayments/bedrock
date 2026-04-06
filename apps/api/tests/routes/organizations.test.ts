import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationNotFoundError } from "@bedrock/parties";

import { organizationsRoutes } from "../../src/routes/organizations";

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

function createOrganization(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "legal_entity",
    legalEntity: null,
    sealKey: null,
    signatureKey: null,
    ...overrides,
  };
}

function createTestApp() {
  const organizationsQueries = {
    findById: vi.fn(),
    list: vi.fn(),
  };
  const organizationsCommands = {
    remove: vi.fn(),
    update: vi.fn(),
  };
  const legalEntitiesCommands = {
    replaceBundle: vi.fn(),
  };
  const requisitesQueries = {
    list: vi.fn().mockResolvedValue({
      data: [],
      limit: 1,
      offset: 0,
      total: 0,
    }),
  };
  const objectStorage = {
    download: vi.fn(),
    upload: vi.fn(),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });

  app.route(
    "/organizations",
    organizationsRoutes({
      objectStorage,
      partiesModule: {
        organizations: {
          commands: organizationsCommands,
          queries: organizationsQueries,
        },
        legalEntities: {
          commands: legalEntitiesCommands,
        },
        requisites: {
          queries: requisitesQueries,
        },
      },
    } as any),
  );

  return {
    app,
    objectStorage,
    organizationsCommands,
    organizationsQueries,
    legalEntitiesCommands,
    requisitesQueries,
  };
}

describe("organization file routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("checks the expected organization permissions on file reads and uploads", async () => {
    const {
      app,
      objectStorage,
      organizationsCommands,
      organizationsQueries,
      requisitesQueries,
    } = createTestApp();
    organizationsQueries.findById.mockResolvedValue(
      createOrganization({
        signatureKey: "organizations/11111111-1111-4111-8111-111111111111/signature.png",
      }),
    );
    organizationsCommands.update.mockResolvedValue(undefined);
    objectStorage.download.mockResolvedValue(Buffer.from([1, 2, 3]));
    requisitesQueries.list.mockResolvedValue({
      data: [],
      limit: 1,
      offset: 0,
      total: 2,
    });

    const filesResponse = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/files",
    );
    const signatureResponse = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/files/signature",
    );
    const formData = new FormData();
    formData.set(
      "signature",
      new File([Uint8Array.from([4, 5, 6])], "signature.png", {
        type: "image/png",
      }),
    );
    const uploadResponse = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/files",
      {
        body: formData,
        method: "POST",
      },
    );

    expect(filesResponse.status).toBe(200);
    await expect(filesResponse.json()).resolves.toEqual({
      banksCount: 2,
      hasFiles: true,
      sealUrl: null,
      signatureUrl:
        "/v1/organizations/11111111-1111-4111-8111-111111111111/files/signature",
    });
    expect(signatureResponse.status).toBe(200);
    expect(uploadResponse.status).toBe(200);
    expect(userHasPermission.mock.calls).toHaveLength(3);
    expect(userHasPermission.mock.calls.map(([input]) => input.body.permissions)).toEqual([
      { organizations: ["list"] },
      { organizations: ["list"] },
      { organizations: ["update"] },
    ]);
    expect(objectStorage.upload).toHaveBeenCalledWith(
      "organizations/11111111-1111-4111-8111-111111111111/signature.png",
      expect.any(Buffer),
      "image/png",
    );
    expect(organizationsCommands.update).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      {
        signatureKey:
          "organizations/11111111-1111-4111-8111-111111111111/signature.png",
      },
    );
  });

  it("returns 403 before reading or writing files when the caller lacks permission", async () => {
    const { app, objectStorage, organizationsQueries } = createTestApp();
    userHasPermission.mockResolvedValue({ success: false });

    const filesResponse = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/files",
    );
    const formData = new FormData();
    formData.set(
      "signature",
      new File([Uint8Array.from([4, 5, 6])], "signature.png", {
        type: "image/png",
      }),
    );
    const uploadResponse = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/files",
      {
        body: formData,
        method: "POST",
      },
    );

    expect(filesResponse.status).toBe(403);
    expect(uploadResponse.status).toBe(403);
    expect(organizationsQueries.findById).not.toHaveBeenCalled();
    expect(objectStorage.upload).not.toHaveBeenCalled();
  });

  it("returns 404 for missing organizations and skips object storage writes", async () => {
    const { app, objectStorage, organizationsCommands, organizationsQueries } =
      createTestApp();
    organizationsQueries.findById.mockRejectedValue(
      new OrganizationNotFoundError("missing"),
    );

    const filesResponse = await app.request(
      "http://localhost/organizations/missing/files",
    );
    const signatureResponse = await app.request(
      "http://localhost/organizations/missing/files/signature",
    );
    const formData = new FormData();
    formData.set(
      "signature",
      new File([Uint8Array.from([4, 5, 6])], "signature.png", {
        type: "image/png",
      }),
    );
    const uploadResponse = await app.request(
      "http://localhost/organizations/missing/files",
      {
        body: formData,
        method: "POST",
      },
    );

    expect(filesResponse.status).toBe(404);
    await expect(filesResponse.json()).resolves.toEqual({
      error: "Organization not found: missing",
    });
    expect(signatureResponse.status).toBe(404);
    expect(uploadResponse.status).toBe(404);
    await expect(uploadResponse.json()).resolves.toEqual({
      error: "Organization not found: missing",
    });
    expect(objectStorage.upload).not.toHaveBeenCalled();
    expect(organizationsCommands.update).not.toHaveBeenCalled();
  });

  it("replaces organization legal entity data through the aggregate route", async () => {
    const { app, legalEntitiesCommands, organizationsQueries } = createTestApp();
    organizationsQueries.findById.mockResolvedValue(createOrganization());
    legalEntitiesCommands.replaceBundle.mockResolvedValue({
      profile: {
        id: "22222222-2222-4222-8222-222222222222",
        organizationId: "11111111-1111-4111-8111-111111111111",
        counterpartyId: null,
        fullName: "Acme LLC",
        shortName: "Acme",
        fullNameI18n: null,
        shortNameI18n: null,
        legalFormCode: null,
        legalFormLabel: null,
        legalFormLabelI18n: null,
        countryCode: "US",
        jurisdictionCode: null,
        registrationAuthority: null,
        registeredAt: null,
        businessActivityCode: null,
        businessActivityText: null,
        status: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      identifiers: [],
      addresses: [],
      contacts: [],
      representatives: [],
      licenses: [],
    });

    const response = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/legal-entity",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            fullName: "Acme LLC",
            shortName: "Acme",
            countryCode: "us",
          },
          identifiers: [],
          addresses: [],
          contacts: [],
          representatives: [],
          licenses: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(legalEntitiesCommands.replaceBundle).toHaveBeenCalledWith({
      ownerId: "11111111-1111-4111-8111-111111111111",
      ownerType: "organization",
      bundle: {
        profile: {
          fullName: "Acme LLC",
          shortName: "Acme",
          fullNameI18n: null,
          shortNameI18n: null,
          legalFormCode: null,
          legalFormLabel: null,
          legalFormLabelI18n: null,
          countryCode: "US",
          jurisdictionCode: null,
          registrationAuthority: null,
          registeredAt: null,
          businessActivityCode: null,
          businessActivityText: null,
          status: null,
        },
        identifiers: [],
        addresses: [],
        contacts: [],
        representatives: [],
        licenses: [],
      },
    });
  });

  it("does not expose the legacy organization legal-profile route", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/organizations/11111111-1111-4111-8111-111111111111/legal-profile",
    );

    expect(response.status).toBe(404);
  });
});
