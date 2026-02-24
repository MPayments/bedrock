import { z } from "zod";

import { COUNTRY_ALPHA2_SET } from "@bedrock/countries";
import {
    createListQuerySchemaFromContract,
    type ListQueryContract,
} from "@bedrock/kernel/pagination";

import { ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

export const AccountProviderTypeSchema = z.enum([
    "bank",
    "exchange",
    "blockchain",
    "custodian",
]);
export type AccountProviderType = z.infer<typeof AccountProviderTypeSchema>;

export const CountryAlpha2Schema = z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine(
        (v) => COUNTRY_ALPHA2_SET.has(v),
        "country must be a valid ISO 3166-1 alpha-2 code",
    );

// ---------------------------------------------------------------------------
// AccountProvider — response schema (OpenAPI)
// ---------------------------------------------------------------------------

export const AccountProviderSchema = z.object({
    id: z.uuid(),
    type: AccountProviderTypeSchema,
    name: z.string(),
    address: z.string().nullable(),
    contact: z.string().nullable(),
    bic: z.string().nullable(),
    swift: z.string().nullable(),
    country: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// Account — response schema (OpenAPI)
// ---------------------------------------------------------------------------

export const AccountSchema = z.object({
    id: z.uuid(),
    counterpartyId: z.uuid(),
    currencyId: z.uuid(),
    accountProviderId: z.uuid(),
    label: z.string(),
    accountNo: z.string().nullable(),
    corrAccount: z.string().nullable(),
    address: z.string().nullable(),
    iban: z.string().nullable(),
    stableKey: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// AccountProvider — create
// ---------------------------------------------------------------------------

const providerFieldsSchema = z.object({
    type: AccountProviderTypeSchema,
    name: z.string().min(1, "name is required").max(255),
    country: CountryAlpha2Schema,
    address: z.string().max(500).nullish(),
    contact: z.string().max(500).nullish(),
    bic: z.string().max(20).nullish(),
    swift: z.string().max(20).nullish(),
});

function refineProviderBicSwift(
    data: { type: string; country?: string; bic?: string | null; swift?: string | null },
    ctx: z.RefinementCtx,
) {
    if (data.type === "bank") {
        if (data.country === "RU") {
            if (!data.bic) {
                ctx.addIssue({ code: "custom", path: ["bic"], message: "BIC is required for Russian banks" });
            }
        } else {
            if (!data.swift) {
                ctx.addIssue({ code: "custom", path: ["swift"], message: "SWIFT is required for non-Russian banks" });
            }
            if (data.bic) {
                ctx.addIssue({ code: "custom", path: ["bic"], message: "BIC must not be set for non-Russian banks" });
            }
        }
    } else {
        if (data.bic) {
            ctx.addIssue({ code: "custom", path: ["bic"], message: "BIC is only applicable for banks" });
        }
        if (data.swift) {
            ctx.addIssue({ code: "custom", path: ["swift"], message: "SWIFT is only applicable for banks" });
        }
    }
}

export const CreateProviderInputSchema = providerFieldsSchema.superRefine(refineProviderBicSwift);
export type CreateProviderInput = z.infer<typeof CreateProviderInputSchema>;

// ---------------------------------------------------------------------------
// AccountProvider — update (patch)
// ---------------------------------------------------------------------------

export const UpdateProviderInputSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    country: CountryAlpha2Schema.optional(),
    address: z.string().max(500).nullable().optional(),
    contact: z.string().max(500).nullable().optional(),
    bic: z.string().max(20).nullable().optional(),
    swift: z.string().max(20).nullable().optional(),
});
export type UpdateProviderInput = z.infer<typeof UpdateProviderInputSchema>;

/**
 * After merging the patch with existing provider data, validate the
 * BIC/SWIFT business rules on the resulting state.
 */
export function validateMergedProviderState(merged: {
    type: string;
    country: string;
    bic?: string | null;
    swift?: string | null;
}): void {
    const issues: string[] = [];

    if (merged.type === "bank") {
        if (merged.country === "RU") {
            if (!merged.bic) issues.push("BIC is required for Russian banks");
        } else {
            if (!merged.swift) issues.push("SWIFT is required for non-Russian banks");
            if (merged.bic) issues.push("BIC must not be set for non-Russian banks");
        }
    } else {
        if (merged.bic) issues.push("BIC is only applicable for banks");
        if (merged.swift) issues.push("SWIFT is only applicable for banks");
    }

    if (issues.length > 0) {
        throw new ValidationError(issues.join("; "));
    }
}

// ---------------------------------------------------------------------------
// AccountProvider — list
// ---------------------------------------------------------------------------

const PROVIDERS_SORTABLE_COLUMNS = ["name", "type", "country", "createdAt"] as const;

interface ProvidersListFilters {
    type: { kind: "string"; cardinality: "multi"; enumValues: readonly ["bank", "exchange", "blockchain", "custodian"] };
    country: { kind: "string"; cardinality: "multi" };
    name: { kind: "string"; cardinality: "single" };
}

export const PROVIDERS_LIST_CONTRACT: ListQueryContract<
    typeof PROVIDERS_SORTABLE_COLUMNS,
    ProvidersListFilters
> = {
    sortableColumns: PROVIDERS_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
    filters: {
        type: {
            kind: "string",
            cardinality: "multi",
            enumValues: ["bank", "exchange", "blockchain", "custodian"],
        },
        country: { kind: "string", cardinality: "multi" },
        name: { kind: "string", cardinality: "single" },
    },
};

export const ListProvidersQuerySchema = createListQuerySchemaFromContract(
    PROVIDERS_LIST_CONTRACT,
);
export type ListProvidersQuery = z.infer<typeof ListProvidersQuerySchema>;

// ---------------------------------------------------------------------------
// Account — create
// ---------------------------------------------------------------------------

export const CreateAccountInputSchema = z.object({
    counterpartyId: z.uuid(),
    currencyId: z.uuid(),
    accountProviderId: z.uuid(),
    label: z.string().min(1, "label is required").max(255),
    stableKey: z.string().min(1, "stableKey is required").max(255),
    accountNo: z.string().max(64).nullish(),
    corrAccount: z.string().max(64).nullish(),
    address: z.string().max(500).nullish(),
    iban: z.string().max(64).nullish(),
});
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

// ---------------------------------------------------------------------------
// Account — update (patch)
// ---------------------------------------------------------------------------

export const UpdateAccountInputSchema = z.object({
    label: z.string().min(1).max(255).optional(),
    accountNo: z.string().max(64).nullable().optional(),
    corrAccount: z.string().max(64).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    iban: z.string().max(64).nullable().optional(),
});
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

// ---------------------------------------------------------------------------
// Account — provider-dependent field validation (stage 2)
// ---------------------------------------------------------------------------

interface ProviderInfo {
    type: string;
    country: string;
}

interface AccountFields {
    accountNo?: string | null;
    corrAccount?: string | null;
    address?: string | null;
}

/**
 * Validates account fields against the provider's type and country.
 * Call after Zod parsing, using the provider fetched from DB.
 */
export function validateAccountFieldsForProvider(
    data: AccountFields,
    provider: ProviderInfo,
): void {
    const issues: string[] = [];

    if (provider.type === "bank") {
        if (!data.accountNo) {
            issues.push("accountNo is required for bank accounts");
        }
        if (provider.country === "RU" && !data.corrAccount) {
            issues.push("corrAccount is required for Russian bank accounts");
        }
    }

    if (provider.type === "blockchain") {
        if (!data.address) {
            issues.push("address is required for blockchain accounts");
        }
    }

    if (issues.length > 0) {
        throw new ValidationError(issues.join("; "));
    }
}

// ---------------------------------------------------------------------------
// Account — list
// ---------------------------------------------------------------------------

const ACCOUNTS_SORTABLE_COLUMNS = ["label", "createdAt"] as const;

interface AccountsListFilters {
    counterpartyId: { kind: "string"; cardinality: "single" };
    currencyId: { kind: "string"; cardinality: "single" };
    accountProviderId: { kind: "string"; cardinality: "single" };
}

export const ACCOUNTS_LIST_CONTRACT: ListQueryContract<
    typeof ACCOUNTS_SORTABLE_COLUMNS,
    AccountsListFilters
> = {
    sortableColumns: ACCOUNTS_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
    filters: {
        counterpartyId: { kind: "string", cardinality: "single" },
        currencyId: { kind: "string", cardinality: "single" },
        accountProviderId: { kind: "string", cardinality: "single" },
    },
};

export const ListAccountsQuerySchema = createListQuerySchemaFromContract(
    ACCOUNTS_LIST_CONTRACT,
);
export type ListAccountsQuery = z.infer<typeof ListAccountsQuerySchema>;

// ---------------------------------------------------------------------------
// Generic validate helper (reuse across commands)
// ---------------------------------------------------------------------------

export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, context?: string): T {
    const result = schema.safeParse(input);

    if (!result.success) {
        const errors = result.error.issues;
        if (!errors || errors.length === 0) {
            throw new ValidationError(
                `Validation failed${context ? ` for ${context}` : ""}: ${result.error.message || "Unknown error"}`,
            );
        }

        const firstError = errors[0]!;
        const path = firstError.path.join(".");
        const message = path ? `${path}: ${firstError.message}` : firstError.message;

        throw new ValidationError(`${context ? `${context}: ` : ""}${message}`);
    }

    return result.data;
}
