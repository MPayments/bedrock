import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const CompanyLookupResultSchema = z.object({
  orgName: z.string(),
  orgType: z.string().nullable(),
  directorName: z.string().nullable(),
  position: z.string().nullable(),
  directorBasis: z.string().nullable(),
  address: z.string().nullable(),
  inn: z.string(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  oktmo: z.string().nullable(),
  okpo: z.string().nullable(),
});

const CounterpartySearchResultSchema = z.object({
  counterpartyId: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  id: z.string().uuid(),
  inn: z.string().nullable(),
  orgName: z.string(),
  shortName: z.string(),
});

const DADATA_INN_PATTERN = /^\d{10}$|^\d{12}$/;

interface DadataResponse {
  payload?: {
    suggestions?: {
      data?: {
        address?: {
          data?: { oktmo?: string | null };
          unrestricted_value?: string | null;
          value?: string | null;
        };
        inn?: string;
        kpp?: string | null;
        management?: { name?: string | null; post?: string | null } | null;
        name?: { full_with_opf?: string | null } | null;
        ogrn?: string | null;
        okpo?: string | null;
        oktmo?: string | null;
        opf?: { short?: string | null } | null;
      };
      value?: string;
    }[];
  };
  resultCode?: string;
}

interface JsonRequestResponse {
  body: unknown;
  status: number;
  statusText: string;
}

async function postJsonWithTimeout(input: {
  body: unknown;
  timeoutMs: number;
  url: string;
}): Promise<JsonRequestResponse> {
  const url = new URL(input.url);
  const requestBody = JSON.stringify(input.body);
  const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<JsonRequestResponse>((resolve, reject) => {
    const request = requestImpl(
      url,
      {
        headers: {
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(requestBody).toString(),
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          clearTimeout(timer);

          const rawBody = Buffer.concat(chunks).toString("utf8");
          const status = response.statusCode ?? 0;
          const statusText = response.statusMessage ?? "";

          if (rawBody.trim().length === 0) {
            resolve({
              body: null,
              status,
              statusText,
            });
            return;
          }

          try {
            resolve({
              body: JSON.parse(rawBody),
              status,
              statusText,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    const timer = setTimeout(() => {
      request.destroy(
        new Error(
          `DaData lookup timed out after ${input.timeoutMs}ms`,
        ),
      );
    }, input.timeoutMs);

    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    request.write(requestBody);
    request.end();
  });
}

export async function lookupCompanyByInn(
  apiUrl: string,
  inn: string,
  timeoutMs = 30000,
) {
  if (!DADATA_INN_PATTERN.test(inn)) {
    throw new Error("INN must be exactly 10 or 12 digits");
  }

  const response = await postJsonWithTimeout({
    body: {
      branch_type: "MAIN",
      count: 1,
      query: inn,
    },
    timeoutMs,
    url: `${apiUrl}/party`,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`DaData API error: ${response.status} ${response.statusText}`);
  }

  const data = response.body as DadataResponse;
  const suggestion = data.payload?.suggestions?.[0];
  const company = suggestion?.data;

  if (data.resultCode !== "OK" || !suggestion || !company?.inn) {
    return null;
  }

  return {
    address:
      company.address?.unrestricted_value ?? company.address?.value ?? null,
    directorBasis: company.opf?.short === "ИП" ? "ОГРНИП" : "Устав",
    directorName: company.management?.name ?? null,
    inn: company.inn,
    kpp: company.kpp ?? null,
    ogrn: company.ogrn ?? null,
    okpo: company.okpo ?? null,
    oktmo: company.address?.data?.oktmo ?? company.oktmo ?? null,
    orgName: company.name?.full_with_opf ?? suggestion.value ?? inn,
    orgType: company.opf?.short ?? null,
    position: company.management?.post ?? null,
  };
}

export function counterpartyDirectoryRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const searchRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/search",
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
        q: z.string().trim().min(1),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(CounterpartySearchResultSchema),
              limit: z.number().int(),
              offset: z.number().int(),
              total: z.number().int(),
            }),
          },
        },
        description: "Customer-owned counterparties",
      },
    },
    summary: "Search customer-owned counterparties",
    tags: ["Counterparties"],
  });

  const lookupByInnRoute = createRoute({
    middleware: [requirePermission({ customers: ["create", "update"] })],
    method: "get",
    path: "/lookup-by-inn",
    request: {
      query: z.object({
        inn: z.string().min(1),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CompanyLookupResultSchema.nullable(),
          },
        },
        description: "Lookup result",
      },
    },
    summary: "Lookup company by INN",
    tags: ["Counterparties"],
  });

  const parseCardRoute = createRoute({
    middleware: [requirePermission({ customers: ["create", "update"] })],
    method: "post",
    path: "/parse-card",
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Parsed card data",
      },
    },
    summary: "Parse a business card or uploaded document",
    tags: ["Counterparties"],
  });

  return app
    .openapi(searchRoute, async (c): Promise<any> => {
      const { limit, offset, q } = c.req.valid("query");
      const rows =
        await ctx.partiesReadRuntime.counterpartiesQueries.searchCustomerOwnedCounterparties(
          {
            limit,
            offset,
            q,
          },
        );

      return c.json(
        {
          data: rows.map((row) => ({
            counterpartyId: row.counterpartyId,
            customerId: row.customerId,
            id: row.counterpartyId,
            inn: row.inn,
            orgName: row.orgName,
            shortName: row.shortName,
          })),
          limit,
          offset,
          total: rows.length,
        },
        200,
      );
    })
    .openapi(lookupByInnRoute, async (c): Promise<any> => {
      const { inn } = c.req.valid("query");
      const result = await lookupCompanyByInn(
        ctx.env.DADATA_API_URL,
        inn,
        ctx.env.DADATA_TIMEOUT_MS,
      );
      return c.json(result, 200);
    })
    .openapi(parseCardRoute, async (c): Promise<any> => {
      if (!ctx.documentExtraction) {
        return c.json({ error: "AI extraction not configured" }, 503);
      }

      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type;
      const result =
        mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "application/msword"
          ? await ctx.documentExtraction.extractFromDocx(buffer)
          : mimeType ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
              mimeType === "application/vnd.ms-excel"
            ? await ctx.documentExtraction.extractFromXlsx(buffer)
            : await ctx.documentExtraction.extractFromPdf(buffer);

      return c.json(result, 200);
    });
}
