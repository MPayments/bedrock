import { z } from "zod";
import { describe, expect, it } from "vitest";

import type { DocumentFormDefinition } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";
import {
  buildWatchedValueMap,
  collectVisibilityDependencyNames,
  deriveAccountCurrencyFieldUpdates,
  filterCounterpartyOptionsByCustomerId,
  findCounterpartyFieldNames,
  findCustomerFieldName,
  findCustomerIdForCounterparty,
  findDependentAccountFieldNames,
  findSingleCounterpartyIdForCustomer,
  isCounterpartyLinkedToCustomer,
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
  optionsSource: "organizationRequisites",
} satisfies DocumentFormField;

const documentDefinition: DocumentFormDefinition = {
  docType: "incoming_invoice",
  label: "Incoming Invoice",
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
        initialValues: {
          contour: "intl",
        },
      }),
    ).toEqual({
      mode: "default",
      contour: "intl",
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

  it("detects customer and counterparty field linkage from form fields", () => {
    const fields: DocumentFormField[] = [
      {
        kind: "customer",
        name: "customerId",
        label: "Customer",
      },
      {
        kind: "counterparty",
        name: "counterpartyId",
        label: "Counterparty",
      },
      {
        kind: "counterparty",
        name: "organizationId",
        label: "Organization",
        optionsSource: "organizations",
      },
    ];

    expect(findCustomerFieldName(fields)).toBe("customerId");
    expect(findCounterpartyFieldNames(fields)).toEqual(["counterpartyId"]);
  });

  it("filters counterparties by selected customer and resolves linked customer ids", () => {
    const counterparties = [
      {
        value: "counterparty-1",
        label: "Contoso",
        customerIds: ["customer-1"],
      },
      {
        value: "counterparty-2",
        label: "Fabrikam",
        customerIds: ["customer-2", "customer-3"],
      },
      {
        value: "counterparty-3",
        label: "Unscoped",
        customerIds: [],
      },
    ];

    expect(
      filterCounterpartyOptionsByCustomerId(counterparties, "customer-1"),
    ).toEqual([counterparties[0]]);
    expect(
      filterCounterpartyOptionsByCustomerId(counterparties, "customer-3"),
    ).toEqual([counterparties[1]]);
    expect(filterCounterpartyOptionsByCustomerId(counterparties, "")).toEqual(
      counterparties,
    );
    expect(
      findCustomerIdForCounterparty(counterparties, "counterparty-1"),
    ).toBe("customer-1");
    expect(
      findCustomerIdForCounterparty(counterparties, "counterparty-2"),
    ).toBeNull();
    expect(
      findCustomerIdForCounterparty(counterparties, "missing-counterparty"),
    ).toBeNull();
    expect(
      findSingleCounterpartyIdForCustomer(counterparties, "customer-1"),
    ).toBe("counterparty-1");
    expect(
      findSingleCounterpartyIdForCustomer(counterparties, "customer-2"),
    ).toBe("counterparty-2");
    expect(
      findSingleCounterpartyIdForCustomer(counterparties, "customer-4"),
    ).toBeNull();
    expect(
      isCounterpartyLinkedToCustomer({
        options: counterparties,
        counterpartyId: "counterparty-2",
        customerId: "customer-3",
      }),
    ).toBe(true);
    expect(
      isCounterpartyLinkedToCustomer({
        options: counterparties,
        counterpartyId: "counterparty-1",
        customerId: "customer-3",
      }),
    ).toBe(false);
  });

  it("plans deduplicated requisite requests and skips cached/loading owners", () => {
    const ownerId = "614fb6eb-a1bd-429e-9628-e97d0f2efa0b";

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
          organizationId: ownerId,
        },
        cachedOwnerKeys: [],
        loadingOwnerKeys: [],
      }),
    ).toEqual([
      {
        ownerId,
        ownerKey: `organizationRequisites:${ownerId}`,
        ownerType: "organization",
      },
    ]);

    expect(
      resolveAccountRequisiteRequests({
        accountFields: [accountField],
        ownerValuesByField: {
          organizationId: ownerId,
        },
        cachedOwnerKeys: [`organizationRequisites:${ownerId}`],
        loadingOwnerKeys: [],
      }),
    ).toEqual([]);
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
          equals: ["intl"],
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
