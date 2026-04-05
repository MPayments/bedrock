import { z } from "zod";
import { describe, expect, it } from "vitest";

import type { DocumentFormDefinition } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";
import {
  buildWatchedValueMap,
  collectVisibilityDependencyNames,
  deriveAccountCurrencyFieldUpdates,
  findInvalidAccountFieldUpdates,
  findDependentAccountFieldNames,
  isFieldVisible,
  mapDocumentFormZodError,
  resolveAccountRequisiteRequests,
  resolveDocumentFormDefaultValues,
} from "@/features/documents/components/forms/document-typed-form/helpers";
import {
  DOCUMENT_TYPED_FORM_RENDERER_KINDS,
  DOCUMENT_TYPED_FORM_RENDERERS_ARE_EXHAUSTIVE,
  documentTypedFormFieldRenderers,
} from "@/features/documents/components/forms/document-typed-form/renderers/registry";

const accountField = {
  kind: "account",
  name: "organizationRequisiteId",
  label: "Organization account",
  counterpartyField: "organizationId",
  currencyFieldName: "currency",
  optionsSource: "organizationRequisites",
} satisfies DocumentFormField;

const documentDefinition: DocumentFormDefinition = {
  docType: "invoice",
  label: "Invoice",
  family: "commercial",
  schema: z.object({}),
  sections: [],
  defaultValues: () => ({
    mode: "default",
  }),
  fromPayload: (payload) => ({
    mode: "edit",
    payload,
  }),
  toPayload: (values) => values,
};

describe("document typed form helpers", () => {
  it("resolves create and edit default values from the definition", () => {
    expect(
      resolveDocumentFormDefaultValues({
        definition: documentDefinition,
        mode: "create",
      }),
    ).toEqual({
      mode: "default",
    });

    expect(
      resolveDocumentFormDefaultValues({
        definition: documentDefinition,
        mode: "edit",
        initialPayload: {
          id: "draft-1",
        },
      }),
    ).toEqual({
      mode: "edit",
      payload: {
        id: "draft-1",
      },
    });
  });

  it("merges create-mode initial payload into default values without using fromPayload", () => {
    expect(
      resolveDocumentFormDefaultValues({
        definition: documentDefinition,
        mode: "create",
        initialPayload: {
          amount: "1000",
          currency: "RUB",
        },
      }),
    ).toEqual({
      amount: "1000",
      currency: "RUB",
      mode: "default",
    });
  });

  it("maps Zod validation issues into form and field errors", () => {
    const result = z
      .object({
        amount: z.string().min(1, "Amount is required"),
      })
      .safeParse({
        amount: "",
      });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation to fail");
    }

    const mapped = mapDocumentFormZodError(result.error);

    expect(mapped).toEqual({
      formError: "Amount is required",
      fieldErrors: [
        {
          name: "amount",
          message: "Amount is required",
        },
      ],
    });
  });

  it("finds dependent account fields for an owner field", () => {
    expect(
      findDependentAccountFieldNames(
        [
          accountField,
          {
            ...accountField,
            name: "destinationRequisiteId",
            counterpartyField: "destinationOrganizationId",
          },
        ],
        "organizationId",
      ),
    ).toEqual(["organizationRequisiteId"]);
  });

  it("plans deduplicated requisite requests and skips cached/loading owners", () => {
    const ownerId = "614fb6eb-a1bd-429e-9628-e97d0f2efa0b";
    const rubCurrencyId = "714fb6eb-a1bd-429e-9628-e97d0f2efa0c";

    expect(
      resolveAccountRequisiteRequests({
        accountFields: [
          accountField,
          {
            ...accountField,
            name: "secondaryOrganizationRequisiteId",
          },
        ],
        ownerValuesByField: {
          currency: "RUB",
          organizationId: ownerId,
        },
        cachedOwnerKeys: [],
        currencyIdByCode: new Map([["RUB", rubCurrencyId]]),
        loadingOwnerKeys: [],
      }),
    ).toEqual([
      {
        currencyId: rubCurrencyId,
        ownerId,
        ownerKey: `organizationRequisites:${ownerId}:${rubCurrencyId}`,
        ownerType: "organization",
      },
    ]);

    expect(
      resolveAccountRequisiteRequests({
        accountFields: [accountField],
        ownerValuesByField: {
          currency: "RUB",
          organizationId: ownerId,
        },
        cachedOwnerKeys: [`organizationRequisites:${ownerId}:${rubCurrencyId}`],
        currencyIdByCode: new Map([["RUB", rubCurrencyId]]),
        loadingOwnerKeys: [],
      }),
    ).toEqual([]);
  });

  it("clears selected account values that no longer match the current currency-scoped options", () => {
    const ownerId = "614fb6eb-a1bd-429e-9628-e97d0f2efa0b";
    const rubCurrencyId = "714fb6eb-a1bd-429e-9628-e97d0f2efa0c";

    expect(
      findInvalidAccountFieldUpdates({
        accountFields: [accountField],
        currencyIdByCode: new Map([["RUB", rubCurrencyId]]),
        loadingOwnerKeys: [],
        requisitesByOwnerKey: new Map([
          [
            `organizationRequisites:${ownerId}:${rubCurrencyId}`,
            [{ id: "requisite-rub" }],
          ],
        ]),
        values: {
          currency: "RUB",
          organizationId: ownerId,
          organizationRequisiteId: "requisite-usd",
        },
      }),
    ).toEqual([
      {
        name: "organizationRequisiteId",
        value: "",
      },
    ]);
  });

  it("derives hidden account-currency updates and clears stale values", () => {
    const derivedField: DocumentFormField = {
      kind: "currency",
      name: "currency",
      label: "Currency",
      hidden: true,
      deriveFrom: {
        kind: "accountCurrency",
        accountFieldNames: ["organizationRequisiteId"],
      },
    };

    expect(
      deriveAccountCurrencyFieldUpdates({
        derivedFields: [derivedField],
        values: {
          organizationRequisiteId: "requisite-1",
          currency: "",
        },
        accountCurrencyCodeById: new Map([["requisite-1", "USD"]]),
      }),
    ).toEqual([
      {
        name: "currency",
        value: "USD",
      },
    ]);

    expect(
      deriveAccountCurrencyFieldUpdates({
        derivedFields: [derivedField],
        values: {
          organizationRequisiteId: "",
          currency: "EUR",
        },
        accountCurrencyCodeById: new Map(),
      }),
    ).toEqual([
      {
        name: "currency",
        value: "",
      },
    ]);
  });

  it("collects visibility dependencies and resolves field visibility from watched values", () => {
    const fields: DocumentFormField[] = [
      {
        kind: "text",
        name: "memo",
        label: "Memo",
      },
      {
        kind: "amount",
        name: "amount",
        label: "Amount",
        visibleWhen: {
          fieldName: "mode",
          equals: ["direct"],
        },
      },
      {
        kind: "currency",
        name: "currency",
        label: "Currency",
        visibleWhen: {
          fieldName: "mode",
          equals: ["exchange"],
        },
      },
    ];

    const dependencyNames = collectVisibilityDependencyNames(fields);
    const watchedValues = buildWatchedValueMap(dependencyNames, ["direct"]);
    const [modeField, organizationField, currencyField] = fields;

    if (!modeField || !organizationField || !currencyField) {
      throw new Error("Expected fixture fields to be defined");
    }

    expect(dependencyNames).toEqual(["mode"]);
    expect(isFieldVisible(modeField, watchedValues)).toBe(true);
    expect(isFieldVisible(organizationField, watchedValues)).toBe(true);
    expect(isFieldVisible(currencyField, watchedValues)).toBe(false);
  });

  it("keeps the renderer registry aligned with declared renderer kinds", () => {
    expect(DOCUMENT_TYPED_FORM_RENDERERS_ARE_EXHAUSTIVE).toBe(true);
    expect(Object.keys(documentTypedFormFieldRenderers).sort()).toEqual(
      Object.keys(DOCUMENT_TYPED_FORM_RENDERER_KINDS).sort(),
    );
  });
});
