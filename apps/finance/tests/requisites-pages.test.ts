import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const getRequisiteById = vi.fn();
const getRequisiteFormOptions = vi.fn();
const renderCreateRequisiteFormClient = vi.fn();
const renderEditRequisiteFormClient = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound,
}));

vi.mock("@/features/entities/requisites/lib/queries", () => ({
  getRequisiteById,
  getRequisiteFormOptions,
}));

vi.mock("@/components/entities/workspace-layout", () => ({
  EntityWorkspaceLayout: ({ children }: { children?: unknown }) =>
    children ?? null,
}));

vi.mock(
  "@/features/entities/requisites/components/create-requisite-form-client",
  () => ({
    CreateRequisiteFormClient: (props: unknown) => {
      renderCreateRequisiteFormClient(props);
      return null;
    },
  }),
);

vi.mock(
  "@/features/entities/requisites/components/edit-requisite-form-client",
  () => ({
    EditRequisiteFormClient: (props: unknown) => {
      renderEditRequisiteFormClient(props);
      return null;
    },
  }),
);

const FORM_OPTIONS = {
  counterpartyOwners: [{ id: "counterparty-1", label: "Acme" }],
  organizationOwners: [{ id: "organization-1", label: "Bedrock" }],
  providers: [{ id: "provider-1", label: "Provider" }],
  currencies: [{ id: "currency-1", label: "USD" }],
};

describe("requisites pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getRequisiteFormOptions.mockResolvedValue(FORM_OPTIONS);
    getRequisiteById.mockResolvedValue({
      id: "requisite-1",
      ownerType: "organization",
      ownerId: "organization-1",
      providerId: "provider-1",
      currencyId: "currency-1",
      kind: "bank",
      label: "Main USD",
      description: "",
      beneficiaryName: "",
      accountNo: "",
      corrAccount: "",
      iban: "",
      network: "",
      assetCode: "",
      address: "",
      memoTag: "",
      accountRef: "",
      subaccountRef: "",
      contact: "",
      notes: "",
      isDefault: false,
      createdAt: "2026-03-17T10:00:00.000Z",
      updatedAt: "2026-03-17T10:00:00.000Z",
    });
  });

  it("renders a single create form with owner defaults from search params", async () => {
    const { default: CreateRequisitePage } = await import(
      "@/app/(shell)/entities/requisites/create/page"
    );

    renderToStaticMarkup(
      await CreateRequisitePage({
        searchParams: Promise.resolve({
          ownerType: "counterparty",
          ownerId: "counterparty-1",
        }),
      }),
    );

    expect(getRequisiteFormOptions).toHaveBeenCalledTimes(1);
    expect(renderCreateRequisiteFormClient).toHaveBeenCalledWith(
      expect.objectContaining({
        options: FORM_OPTIONS,
        initialOwnerType: "counterparty",
        initialValues: { ownerId: "counterparty-1" },
        ownerReadonly: true,
        ownerTypeReadonly: true,
      }),
    );
  });

  it("renders the shared edit form for the resolved requisite", async () => {
    const { default: RequisitePage } = await import(
      "@/app/(shell)/entities/requisites/[id]/page"
    );

    renderToStaticMarkup(
      await RequisitePage({
        params: Promise.resolve({ id: "requisite-1" }),
      }),
    );

    expect(getRequisiteById).toHaveBeenCalledWith("requisite-1");
    expect(getRequisiteFormOptions).toHaveBeenCalledTimes(1);
    expect(renderEditRequisiteFormClient).toHaveBeenCalledWith(
      expect.objectContaining({
        requisite: expect.objectContaining({
          id: "requisite-1",
          ownerType: "organization",
        }),
        options: FORM_OPTIONS,
      }),
    );
  });
});
