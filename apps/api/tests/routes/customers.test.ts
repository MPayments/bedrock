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

const FILE_DATES = {
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-01T00:00:00.000Z"),
} as const;

function createTestApp() {
  const documentGenerationWorkflow = {
    generateCustomerContract: vi.fn(async () => ({
      buffer: Buffer.from("contract-pdf"),
      fileName: "contract.pdf",
      mimeType: "application/pdf",
    })),
  };
  const uploadedAttachment = {
    id: "00000000-0000-4000-8000-000000000501",
    fileName: "kyc.pdf",
    fileSize: 7,
    mimeType: "application/pdf",
    uploadedBy: "user-1",
    description: "KYC",
    ...FILE_DATES,
  };
  const filesModule = {
    files: {
      commands: {
        persistGeneratedCounterpartyFile: vi.fn(async () => undefined),
        uploadCounterpartyAttachment: vi.fn(async () => uploadedAttachment),
      },
      queries: {
        listCounterpartyAttachments: vi.fn(async () => []),
      },
    },
  };
  const partiesModule = {
    counterparties: {
      queries: {
        findById: vi.fn(async () => ({
          id: IDS.counterparty,
          customerId: IDS.customer,
          relationshipKind: "customer_owned",
        })),
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
      partiesModule,
    } as any),
  );

  return {
    app,
    documentGenerationWorkflow,
    filesModule,
    partiesModule,
    uploadedAttachment,
  };
}

describe("customers routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
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

  it("returns DOCX contracts and persists the generated DOCX file", async () => {
    const { app, documentGenerationWorkflow, filesModule } = createTestApp();

    documentGenerationWorkflow.generateCustomerContract.mockResolvedValueOnce({
      buffer: Buffer.from("contract-docx"),
      fileName: "contract.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/contract?format=docx&lang=ru`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("contract-docx");
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="contract.docx"',
    );

    expect(
      documentGenerationWorkflow.generateCustomerContract,
    ).toHaveBeenCalledWith({
      counterpartyId: IDS.counterparty,
      customerId: IDS.customer,
      format: "docx",
      lang: "ru",
    });
    expect(
      filesModule.files.commands.persistGeneratedCounterpartyFile,
    ).toHaveBeenCalledWith({
      buffer: Buffer.from("contract-docx"),
      createdBy: "user-1",
      fileName: "contract.docx",
      fileSize: Buffer.byteLength("contract-docx"),
      generatedFormat: "docx",
      generatedLang: "ru",
      linkKind: "legal_entity_contract",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ownerId: IDS.counterparty,
    });
  });

  it("uploads customer counterparty documents through the files module", async () => {
    const { app, filesModule, partiesModule } = createTestApp();
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("pdf-body")], "kyc.pdf", {
        type: "application/pdf",
      }),
    );
    formData.set("description", " KYC ");

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/documents`,
      {
        body: formData,
        method: "POST",
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      createdAt: "2026-04-01T00:00:00.000Z",
      description: "KYC",
      fileName: "kyc.pdf",
      fileSize: 7,
      id: "00000000-0000-4000-8000-000000000501",
      mimeType: "application/pdf",
      updatedAt: "2026-04-01T00:00:00.000Z",
      uploadedBy: "user-1",
    });
    expect(partiesModule.counterparties.queries.findById).toHaveBeenCalledWith(
      IDS.counterparty,
    );
    expect(
      filesModule.files.commands.uploadCounterpartyAttachment,
    ).toHaveBeenCalledWith({
      buffer: Buffer.from("pdf-body"),
      description: " KYC ",
      fileName: "kyc.pdf",
      fileSize: 8,
      mimeType: "application/pdf",
      ownerId: IDS.counterparty,
      uploadedBy: "user-1",
    });
  });

  it("uses a generic MIME type when Chrome omits one for an uploaded file", async () => {
    const { app, filesModule } = createTestApp();
    const formData = new FormData();
    formData.set("file", new File([Buffer.from("pdf")], "kyc.pdf"));

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/documents`,
      {
        body: formData,
        method: "POST",
      },
    );

    expect(response.status).toBe(201);
    expect(
      filesModule.files.commands.uploadCounterpartyAttachment,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: "application/octet-stream",
      }),
    );
  });

  it("returns 400 for malformed multipart uploads", async () => {
    const { app, filesModule } = createTestApp();

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/documents`,
      {
        body: "not a valid multipart body",
        headers: {
          "content-type": "multipart/form-data; boundary=bedrock",
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid multipart form data",
    });
    expect(
      filesModule.files.commands.uploadCounterpartyAttachment,
    ).not.toHaveBeenCalled();
  });
});
