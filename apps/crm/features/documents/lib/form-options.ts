import { z } from "zod";

import {
  createEmptyDocumentFormOptions,
  type DocumentFormOptions,
} from "@bedrock/sdk-documents-form-ui/lib/form-options";

import { API_BASE_URL } from "@/lib/constants";

const OptionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const OptionsResponseSchema = z.object({
  data: z.array(OptionItemSchema),
});

const CurrencyOptionItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
});

const CurrencyOptionsResponseSchema = z.object({
  data: z.array(CurrencyOptionItemSchema),
});

const CustomerOptionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const CustomersResponseSchema = z.object({
  data: z.array(CustomerOptionItemSchema),
});

async function fetchJson<T>(
  url: string,
  schema: z.ZodSchema<T>,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return schema.parse(payload);
  } catch {
    return null;
  }
}

export async function fetchCrmDocumentFormOptions(): Promise<DocumentFormOptions> {
  const [counterparties, customers, organizations, currencies] =
    await Promise.all([
      fetchJson(
        `${API_BASE_URL}/counterparties/options`,
        OptionsResponseSchema,
      ),
      fetchJson(
        `${API_BASE_URL}/customers?limit=200&offset=0`,
        CustomersResponseSchema,
      ),
      fetchJson(
        `${API_BASE_URL}/organizations/options`,
        OptionsResponseSchema,
      ),
      fetchJson(
        `${API_BASE_URL}/currencies/options`,
        CurrencyOptionsResponseSchema,
      ),
    ]);

  const empty = createEmptyDocumentFormOptions();

  return {
    counterparties: counterparties?.data ?? empty.counterparties,
    customers:
      customers?.data.map((customer) => ({
        id: customer.id,
        label: customer.name,
      })) ?? empty.customers,
    organizations: organizations?.data ?? empty.organizations,
    currencies: currencies?.data ?? empty.currencies,
  };
}
