"use client";

import { ZodError } from "zod";

import { cn } from "@bedrock/sdk-ui/lib/utils";

import type { DocumentFormDefinition } from "../../lib/document-form-registry";
import type {
  DocumentFormBreakpoint,
  DocumentFormField,
  DocumentFormResponsiveCount,
  DocumentFormSection,
  DocumentFormValues,
} from "../../lib/document-form-registry";
import { isUuid } from "../../lib/validation";

export type DocumentFormMode = "create" | "edit";

export type DocumentFormFieldError = {
  name: string;
  message: string;
};

export type DocumentFormZodErrorState = {
  formError: string;
  fieldErrors: DocumentFormFieldError[];
};

export type DocumentFormOwnerRequest = {
  currencyId?: string;
  ownerId: string;
  ownerKey: string;
  ownerType: "counterparty" | "organization";
};

export function isAccountField(
  field: DocumentFormField,
): field is Extract<DocumentFormField, { kind: "account" }> {
  return field.kind === "account";
}

export function readValueAsString(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" || typeof input === "bigint") {
    return String(input);
  }

  return "";
}

export function fieldErrorMessage(
  errors: unknown,
  fieldPath: string,
): string | null {
  const segments = fieldPath.split(".");
  let current = errors as Record<string, unknown> | undefined;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = current[segment] as Record<string, unknown> | undefined;
  }

  const raw =
    current && typeof current === "object"
      ? (current as { message?: unknown }).message
      : undefined;

  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }

  return null;
}

export function findSelectedLabel(
  value: unknown,
  options: Array<{ value: string; label: string }>,
): string | undefined {
  const normalizedValue = readValueAsString(value).trim();
  if (!normalizedValue) {
    return undefined;
  }

  return options.find((option) => option.value === normalizedValue)?.label;
}

export function isFieldVisible(
  field: DocumentFormField,
  values: DocumentFormValues | undefined,
): boolean {
  if (!field.visibleWhen) {
    return true;
  }

  const actual = readValueAsString(values?.[field.visibleWhen.fieldName]).trim();
  return field.visibleWhen.equals.includes(actual);
}

export function resolveOwnerFieldSource(
  field: Extract<DocumentFormField, { kind: "counterparty" }>,
) {
  return field.optionsSource ?? "counterparties";
}

export function resolveRequisiteFieldSource(
  field: Extract<DocumentFormField, { kind: "account" }>,
) {
  return field.optionsSource ?? "counterpartyRequisites";
}

function resolveOwnerKey(input: {
  currencyId?: string | null;
  ownerId: string;
  requisiteSource: "counterpartyRequisites" | "organizationRequisites";
}) {
  const key = `${input.requisiteSource}:${input.ownerId}`;

  if (!input.currencyId) {
    return key;
  }

  return `${key}:${input.currencyId}`;
}

function resolveAccountFieldCurrencyId(input: {
  currencyIdByCode: Map<string, string>;
  field: Extract<DocumentFormField, { kind: "account" }>;
  values: DocumentFormValues;
}): string | null {
  if (!input.field.currencyFieldName) {
    return null;
  }

  const currencyCode = readValueAsString(
    input.values[input.field.currencyFieldName],
  ).trim();

  if (!currencyCode) {
    return null;
  }

  return input.currencyIdByCode.get(currencyCode) ?? null;
}

export function resolveAccountFieldOwnerKey(input: {
  currencyIdByCode: Map<string, string>;
  field: Extract<DocumentFormField, { kind: "account" }>;
  values: DocumentFormValues;
}): string | null {
  const ownerId = readValueAsString(
    input.values[input.field.counterpartyField],
  ).trim();

  if (!isUuid(ownerId)) {
    return null;
  }

  return resolveOwnerKey({
    currencyId: resolveAccountFieldCurrencyId(input),
    ownerId,
    requisiteSource: resolveRequisiteFieldSource(input.field),
  });
}

export function collectAccountDependencyNames(
  accountFields: Array<Extract<DocumentFormField, { kind: "account" }>>,
): string[] {
  return Array.from(
    new Set(
      accountFields.flatMap((field) =>
        field.currencyFieldName
          ? [field.name, field.counterpartyField, field.currencyFieldName]
          : [field.name, field.counterpartyField],
      ),
    ),
  );
}

export function resolveDocumentFormDefaultValues(input: {
  definition: DocumentFormDefinition | null;
  mode: DocumentFormMode;
  initialPayload?: Record<string, unknown>;
}): DocumentFormValues {
  if (!input.definition) {
    return {};
  }

  if (input.initialPayload) {
    if (input.mode === "create") {
      return {
        ...input.definition.defaultValues(),
        ...input.initialPayload,
      };
    }

    return input.definition.fromPayload(input.initialPayload);
  }

  return input.definition.defaultValues();
}

export function mapDocumentFormZodError(
  error: ZodError,
): DocumentFormZodErrorState {
  return {
    formError:
      error.issues[0]?.message ?? "Валидация формы завершилась с ошибкой",
    fieldErrors: error.issues
      .map((issue) => ({
        name: issue.path.map(String).join("."),
        message: issue.message,
      }))
      .filter((issue) => issue.name.length > 0),
  };
}

export function findDependentAccountFieldNames(
  accountFields: Array<Extract<DocumentFormField, { kind: "account" }>>,
  ownerFieldName: string,
): string[] {
  return accountFields
    .filter((field) => field.counterpartyField === ownerFieldName)
    .map((field) => field.name);
}

export function collectVisibilityDependencyNames(
  fields: Pick<DocumentFormField, "visibleWhen">[],
): string[] {
  return Array.from(
    new Set(
      fields
        .map((field) => field.visibleWhen?.fieldName)
        .filter((fieldName): fieldName is string => Boolean(fieldName)),
    ),
  );
}

export function buildWatchedValueMap(
  fieldNames: string[],
  watchedValues: unknown,
): DocumentFormValues {
  const values = Array.isArray(watchedValues) ? watchedValues : [watchedValues];

  return Object.fromEntries(
    fieldNames.map((fieldName, index) => [fieldName, values[index]]),
  );
}

export function resolveAccountRequisiteRequests(input: {
  accountFields: Array<Extract<DocumentFormField, { kind: "account" }>>;
  ownerValuesByField: DocumentFormValues;
  cachedOwnerKeys: Iterable<string>;
  currencyIdByCode: Map<string, string>;
  loadingOwnerKeys: Iterable<string>;
}): DocumentFormOwnerRequest[] {
  const cachedOwnerKeySet = new Set(input.cachedOwnerKeys);
  const loadingOwnerKeySet = new Set(input.loadingOwnerKeys);
  const seenOwnerKeys = new Set<string>();
  const requests: DocumentFormOwnerRequest[] = [];

  for (const field of input.accountFields) {
    const ownerId = readValueAsString(
      input.ownerValuesByField[field.counterpartyField],
    ).trim();
    const requisiteSource = resolveRequisiteFieldSource(field);
    const currencyId = resolveAccountFieldCurrencyId({
      currencyIdByCode: input.currencyIdByCode,
      field,
      values: input.ownerValuesByField,
    });
    const ownerKey = resolveOwnerKey({
      currencyId,
      ownerId,
      requisiteSource,
    });

    if (!isUuid(ownerId)) {
      continue;
    }

    if (
      seenOwnerKeys.has(ownerKey) ||
      cachedOwnerKeySet.has(ownerKey) ||
      loadingOwnerKeySet.has(ownerKey)
    ) {
      continue;
    }

    seenOwnerKeys.add(ownerKey);
    requests.push({
      currencyId: currencyId ?? undefined,
      ownerId,
      ownerKey,
      ownerType:
        requisiteSource === "organizationRequisites"
          ? "organization"
          : "counterparty",
    });
  }

  return requests;
}

export function findInvalidAccountFieldUpdates(input: {
  accountFields: Array<Extract<DocumentFormField, { kind: "account" }>>;
  currencyIdByCode: Map<string, string>;
  loadingOwnerKeys: Iterable<string>;
  requisitesByOwnerKey: ReadonlyMap<string, Array<{ id: string }>>;
  values: DocumentFormValues;
}): Array<{ name: string; value: string }> {
  const loadingOwnerKeySet = new Set(input.loadingOwnerKeys);
  const updates: Array<{ name: string; value: string }> = [];

  for (const field of input.accountFields) {
    const selectedAccountId = readValueAsString(input.values[field.name]).trim();

    if (!selectedAccountId) {
      continue;
    }

    const ownerKey = resolveAccountFieldOwnerKey({
      currencyIdByCode: input.currencyIdByCode,
      field,
      values: input.values,
    });

    if (!ownerKey) {
      updates.push({ name: field.name, value: "" });
      continue;
    }

    if (loadingOwnerKeySet.has(ownerKey)) {
      continue;
    }

    const options = input.requisitesByOwnerKey.get(ownerKey);
    if (!options) {
      continue;
    }

    if (!options.some((option) => option.id === selectedAccountId)) {
      updates.push({ name: field.name, value: "" });
    }
  }

  return updates;
}

export function deriveAccountCurrencyFieldUpdates(input: {
  derivedFields: DocumentFormField[];
  values: DocumentFormValues;
  accountCurrencyCodeById: Map<string, string>;
}): Array<{ name: string; value: string }> {
  const updates: Array<{ name: string; value: string }> = [];

  for (const field of input.derivedFields) {
    if (field.deriveFrom?.kind !== "accountCurrency") {
      continue;
    }

    const selectedAccountIds = field.deriveFrom.accountFieldNames
      .map((accountFieldName) =>
        readValueAsString(input.values[accountFieldName]).trim(),
      )
      .filter((accountId) => accountId.length > 0);

    if (selectedAccountIds.length === 0) {
      if (readValueAsString(input.values[field.name]).trim().length > 0) {
        updates.push({
          name: field.name,
          value: "",
        });
      }
      continue;
    }

    const resolvedCurrencyCodes = selectedAccountIds
      .map((accountId) => input.accountCurrencyCodeById.get(accountId))
      .filter((currencyCode): currencyCode is string => Boolean(currencyCode));

    if (resolvedCurrencyCodes.length !== selectedAccountIds.length) {
      continue;
    }

    const derivedCurrencyCode = resolvedCurrencyCodes[0] ?? "";
    if (
      derivedCurrencyCode.length > 0 &&
      readValueAsString(input.values[field.name]).trim() !== derivedCurrencyCode
    ) {
      updates.push({
        name: field.name,
        value: derivedCurrencyCode,
      });
    }
  }

  return updates;
}

export function findHiddenSectionCurrencyField(
  section: DocumentFormSection,
): Extract<DocumentFormField, { kind: "currency" }> | null {
  for (const field of section.fields) {
    if (field.kind === "currency" && field.hidden) {
      return field;
    }
  }

  return null;
}

const RESPONSIVE_BREAKPOINTS: DocumentFormBreakpoint[] = [
  "base",
  "sm",
  "md",
  "lg",
];

const GRID_COLUMN_CLASS_NAMES: Record<
  DocumentFormBreakpoint,
  Record<1 | 2 | 3 | 4, string>
> = {
  base: {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  },
  sm: {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
  },
  md: {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  },
  lg: {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  },
};

const GRID_SPAN_CLASS_NAMES: Record<
  DocumentFormBreakpoint,
  Record<1 | 2 | 3 | 4, string>
> = {
  base: {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
  },
  sm: {
    1: "sm:col-span-1",
    2: "sm:col-span-2",
    3: "sm:col-span-3",
    4: "sm:col-span-4",
  },
  md: {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-3",
    4: "md:col-span-4",
  },
  lg: {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
  },
};

export function getResponsiveGridClassName(
  columns?: DocumentFormResponsiveCount,
): string {
  const resolvedColumns: DocumentFormResponsiveCount = {
    base: 1,
    ...columns,
  };

  return cn(
    "grid gap-4",
    ...RESPONSIVE_BREAKPOINTS.flatMap((breakpoint) => {
      const columnCount = resolvedColumns[breakpoint];
      return columnCount ? [GRID_COLUMN_CLASS_NAMES[breakpoint][columnCount]] : [];
    }),
  );
}

export function getResponsiveGridItemClassName(
  span?: DocumentFormResponsiveCount,
): string | undefined {
  if (!span) {
    return undefined;
  }

  return cn(
    ...RESPONSIVE_BREAKPOINTS.flatMap((breakpoint) => {
      const columnSpan = span[breakpoint];
      return columnSpan ? [GRID_SPAN_CLASS_NAMES[breakpoint][columnSpan]] : [];
    }),
  );
}

export function getDocumentFormFieldId(fieldName: string): string {
  return `document-field-${fieldName}`;
}
