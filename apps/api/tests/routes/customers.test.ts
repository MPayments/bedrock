import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  authByAudience: {
    crm: {
      api: {
        userHasPermission,
      },
    },
  },
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { customersRoutes } from "../../src/routes/customers";

const IDS = {
  counterparty: "00000000-0000-4000-8000-000000000401",
  customer: "00000000-0000-4000-8000-000000000402",
} as const;

function createTestApp() {
  const documentGenerationWorkflow = {
    generateCustomerContract: vi.fn(async () => ({
      buffer: Buffer.from("contract-pdf"),
      fileName: "contract.pdf",
      mimeType: "application/pdf",
    })),
  };
  const filesModule = {
    files: {
      commands: {
        persistGeneratedCounterpartyFile: vi.fn(async () => undefined),
      },
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("audience", "crm");
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

  app.route(
    "/customers",
    customersRoutes({
      documentGenerationWorkflow,
      filesModule,
    } as any),
  );

  return { app, documentGenerationWorkflow, filesModule };
}

describe("customers routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("does not expose legacy customer legal-entity compatibility routes", async () => {
    const { app } = createTestApp();

    const detailResponse = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}`,
    );
    const listResponse = await app.request(
      `http://localhost/customers/${IDS.customer}/party-profiles`,
    );
    const bankProvidersResponse = await app.request(
      "http://localhost/customers/bank-providers?query=bank",
    );

    expect(detailResponse.status).toBe(404);
    expect(listResponse.status).toBe(404);
    expect(bankProvidersResponse.status).toBe(400);
  });

  it("delegates legal entity contract generation to the workflow and persists the generated file", async () => {
    const { app, documentGenerationWorkflow, filesModule } = createTestApp();

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/contract?format=pdf&lang=en`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("contract-pdf");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="contract.pdf"',
    );

    expect(
      documentGenerationWorkflow.generateCustomerContract,
    ).toHaveBeenCalledWith({
      counterpartyId: IDS.counterparty,
      customerId: IDS.customer,
      format: "pdf",
      lang: "en",
    });
    expect(
      filesModule.files.commands.persistGeneratedCounterpartyFile,
    ).toHaveBeenCalledWith({
      buffer: Buffer.from("contract-pdf"),
      createdBy: "user-1",
      fileName: "contract.pdf",
      fileSize: Buffer.byteLength("contract-pdf"),
      generatedFormat: "pdf",
      generatedLang: "en",
      linkKind: "legal_entity_contract",
      mimeType: "application/pdf",
      ownerId: IDS.counterparty,
    });
  });
});
