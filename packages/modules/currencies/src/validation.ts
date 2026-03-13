import z from "zod";

import { KNOWN_CURRENCY_CODES } from "@bedrock/currencies/catalog";
import {
    createListQuerySchemaFromContract,
    type ListQueryContract,
} from "@bedrock/core/pagination";

export const CurrencySchema = z.object({
    id: z.uuid(),
    name: z.string(),
    code: z.string(),
    symbol: z.string(),
    precision: z.number().int().nonnegative(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type Currency = z.infer<typeof CurrencySchema>;

const CURRENCIES_SORTABLE_COLUMNS = [
    "code",
    "name",
    "symbol",
    "precision",
    "createdAt",
    "updatedAt",
] as const;

interface CurrenciesListFilters {
    name: { kind: "string"; cardinality: "single" };
    code: { kind: "string"; cardinality: "single" };
    symbol: { kind: "string"; cardinality: "single" };
    precision: { kind: "number"; cardinality: "single"; int: true; min: 0 };
};

export const CURRENCIES_LIST_CONTRACT: ListQueryContract<
    typeof CURRENCIES_SORTABLE_COLUMNS,
    CurrenciesListFilters
> = {
    sortableColumns: CURRENCIES_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
    filters: {
        name: { kind: "string", cardinality: "single" },
        code: { kind: "string", cardinality: "single" },
        symbol: { kind: "string", cardinality: "single" },
        precision: { kind: "number", cardinality: "single", int: true, min: 0 },
    },
};

export const ListCurrenciesQuerySchema = createListQuerySchemaFromContract(
    CURRENCIES_LIST_CONTRACT,
);

export type ListCurrenciesQuery = z.infer<typeof ListCurrenciesQuerySchema>;

export const CreateCurrencyInputSchema = z.object({
    name: z.string().min(1, "name is required"),
    code: z.string()
        .min(1, "code is required")
        .transform((value) => value.trim().toUpperCase())
        .refine((code) => KNOWN_CURRENCY_CODES.has(code), "Unknown currency code"),
    symbol: z.string().min(1, "symbol is required"),
    precision: z.number().int().min(0, "precision can't be less than 0"),
});

export type CreateCurrencyInput = z.infer<typeof CreateCurrencyInputSchema>;

export const UpdateCurrencyInputSchema = z.object({
    name: z.string().optional(),
    code: z.string()
        .transform((value) => value.trim().toUpperCase())
        .refine((code) => KNOWN_CURRENCY_CODES.has(code), "Unknown currency code")
        .optional(),
    symbol: z.string().optional(),
    precision: z.number().int().min(0, "precision can't be less than 0").optional(),
});

export type UpdateCurrencyInput = z.infer<typeof UpdateCurrencyInputSchema>;
