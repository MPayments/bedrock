"use client";

import { AlertCircle, Loader2, PencilLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  AlertDescription,
} from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { loadApplicantRequisites } from "@/lib/applicant-requisites";
import { API_BASE_URL } from "@/lib/constants";

import {
  DealIntakeForm,
  type CrmApplicantRequisiteOption,
  type CrmCurrencyOption,
  type CrmCustomerCounterpartyOption,
  type CrmDealHeaderDraft,
} from "@/app/(dashboard)/deals/_components/deal-intake-form";
import {
  DEAL_SECTION_LABELS,
  REQUIRED_DEAL_SECTION_IDS_BY_TYPE,
} from "./constants";
import type { ApiCrmDealWorkbenchProjection } from "./types";

type DealQuestionnaireTabProps = {
  isSaving: boolean;
  onSubmit: (header: CrmDealHeaderDraft) => Promise<void>;
  workbench: ApiCrmDealWorkbenchProjection;
};

function createDraftFromWorkbench(
  workbench: ApiCrmDealWorkbenchProjection,
): CrmDealHeaderDraft {
  const draft: CrmDealHeaderDraft = {
    common: {
      ...workbench.header.common,
    },
    externalBeneficiary: {
      ...workbench.header.externalBeneficiary,
    },
    incomingReceipt: {
      ...workbench.header.incomingReceipt,
    },
    moneyRequest: {
      ...workbench.header.moneyRequest,
    },
    settlementDestination: {
      ...workbench.header.settlementDestination,
    },
    type: workbench.header.type,
  };

  if (
    (draft.type === "payment" || draft.type === "currency_transit") &&
    draft.externalBeneficiary.beneficiaryCounterpartyId ===
      draft.common.applicantCounterpartyId
  ) {
    draft.externalBeneficiary = {
      ...draft.externalBeneficiary,
      beneficiaryCounterpartyId: null,
    };
  }

  return draft;
}

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

function trimToNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveBeneficiaryNames(
  snapshot: CrmDealHeaderDraft["externalBeneficiary"]["beneficiarySnapshot"],
) {
  return {
    fullName:
      trimToNull(snapshot?.legalName) ?? trimToNull(snapshot?.displayName),
    shortName:
      trimToNull(snapshot?.displayName) ?? trimToNull(snapshot?.legalName),
  };
}

function resolveBeneficiaryIdentifierScheme(
  snapshot: CrmDealHeaderDraft["externalBeneficiary"]["beneficiarySnapshot"],
) {
  return snapshot?.country?.trim().toUpperCase() === "RUSSIA"
    ? "inn"
    : "registration_number";
}

async function fetchCurrencyOptions(): Promise<CrmCurrencyOption[]> {
  const response = await fetch(`${API_BASE_URL}/currencies/options`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить валюты: ${response.status}`);
  }

  const payload = (await response.json()) as { data: CrmCurrencyOption[] };
  return payload.data;
}

function findInn(
  counterparty: NonNullable<
    ApiCrmDealWorkbenchProjection["context"]["customer"]
  >["counterparties"][number],
) {
  return (
    counterparty.partyProfile?.identifiers.find(
      (identifier) => identifier.scheme === "inn",
    )?.value ?? null
  );
}

function collectIncompleteSections(
  workbench: ApiCrmDealWorkbenchProjection,
) {
  const requiredSections = new Set(
    REQUIRED_DEAL_SECTION_IDS_BY_TYPE[workbench.summary.type],
  );

  return workbench.sectionCompleteness.filter(
    (section) => requiredSections.has(section.sectionId) && !section.complete,
  );
}

export function DealQuestionnaireTab({
  isSaving,
  onSubmit,
  workbench,
}: DealQuestionnaireTabProps) {
  const [extraCounterparties, setExtraCounterparties] = useState<
    CrmCustomerCounterpartyOption[]
  >([]);
  const counterparties = useMemo<CrmCustomerCounterpartyOption[]>(
    () => {
      const mapped = (workbench.context.customer?.counterparties ?? []).map(
        (counterparty) => ({
          counterpartyId: counterparty.id,
          fullName: counterparty.fullName,
          inn: findInn(counterparty),
          orgName: counterparty.shortName,
          shortName: counterparty.shortName,
        }),
      );

      return [...mapped, ...extraCounterparties].filter(
        (option, index, items) =>
          items.findIndex(
            (candidate) => candidate.counterpartyId === option.counterpartyId,
          ) === index,
      );
    },
    [extraCounterparties, workbench.context.customer?.counterparties],
  );
  const [draft, setDraft] = useState<CrmDealHeaderDraft>(() =>
    createDraftFromWorkbench(workbench),
  );
  const [currencyOptions, setCurrencyOptions] = useState<CrmCurrencyOption[]>([]);
  const [applicantRequisites, setApplicantRequisites] = useState<
    CrmApplicantRequisiteOption[]
  >([]);
  const [isCreatingBeneficiaryCounterparty, setIsCreatingBeneficiaryCounterparty] =
    useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incompleteSections = useMemo(
    () => collectIncompleteSections(workbench),
    [workbench],
  );
  const applicantCounterpartyId = draft.common.applicantCounterpartyId;
  const customerId =
    workbench.context.customer?.customer.id ??
    workbench.participants.find((participant) => participant.role === "customer")
      ?.customerId ??
    null;
  const isEditable = workbench.editability.header;

  useEffect(() => {
    setDraft(createDraftFromWorkbench(workbench));
    setExtraCounterparties([]);
    setError(null);
  }, [workbench]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrencyOptions() {
      try {
        const options = await fetchCurrencyOptions();

        if (!cancelled) {
          setCurrencyOptions(options);
        }
      } catch (nextError) {
        if (!cancelled) {
          console.error("Failed to load CRM currency options", nextError);
          setCurrencyOptions([]);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Не удалось загрузить валюты",
          );
        }
      }
    }

    void loadCurrencyOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!applicantCounterpartyId) {
      setApplicantRequisites([]);
      setDraft((current) => ({
        ...current,
        settlementDestination:
          current.settlementDestination.mode === "applicant_requisite"
            ? {
                ...current.settlementDestination,
                requisiteId: null,
              }
            : current.settlementDestination,
      }));
      return;
    }

    const currentApplicantCounterpartyId = applicantCounterpartyId;
    let cancelled = false;

    async function loadRequisites() {
      try {
        setLoadingContext(true);
        const requisites =
          await loadApplicantRequisites(currentApplicantCounterpartyId);

        if (cancelled) {
          return;
        }

        setApplicantRequisites(requisites);
        setDraft((current) => {
          if (
            current.settlementDestination.mode !== "applicant_requisite" ||
            current.settlementDestination.requisiteId === null
          ) {
            return current;
          }

          const hasCurrentRequisite = requisites.some(
            (requisite) =>
              requisite.id === current.settlementDestination.requisiteId,
          );

          return hasCurrentRequisite
            ? current
            : {
                ...current,
                settlementDestination: {
                  ...current.settlementDestination,
                  requisiteId: null,
                },
              };
        });
      } catch (nextError) {
        if (!cancelled) {
          console.error("Failed to load applicant requisites", nextError);
          setApplicantRequisites([]);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Не удалось загрузить реквизиты заявителя",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    }

    void loadRequisites();

    return () => {
      cancelled = true;
    };
  }, [applicantCounterpartyId]);

  const canSave = useMemo(
    () =>
      isEditable &&
      !isSaving &&
      !loadingContext &&
      currencyOptions.length > 0,
    [currencyOptions.length, isEditable, isSaving, loadingContext],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    try {
      await onSubmit(draft);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Не удалось сохранить анкету сделки",
      );
    }
  }, [draft, onSubmit]);

  const handleCreateBeneficiaryCounterparty = useCallback(async () => {
    const snapshot = draft.externalBeneficiary.beneficiarySnapshot;
    const { fullName, shortName } = resolveBeneficiaryNames(snapshot);

    if (!customerId) {
      setError("Не удалось определить клиента сделки для создания контрагента.");
      return;
    }

    if (!fullName || !shortName) {
      setError(
        "Сначала заполните фактического получателя по инвойсу, затем создавайте CRM-контрагента.",
      );
      return;
    }

    try {
      setError(null);
      setIsCreatingBeneficiaryCounterparty(true);

      const response = await fetch(`${API_BASE_URL}/counterparties`, {
        body: JSON.stringify({
          country: null,
          customerId,
          description: null,
          externalRef: null,
          fullName,
          groupIds: [],
          kind: "legal_entity",
          partyProfile: {
            address: null,
            contacts: [],
            identifiers: snapshot?.inn
              ? [
                  {
                    scheme: resolveBeneficiaryIdentifierScheme(snapshot),
                    value: snapshot.inn,
                  },
                ]
              : [],
            licenses: [],
            profile: {
              businessActivityCode: null,
              businessActivityText: null,
              countryCode: null,
              fullName,
              legalFormCode: null,
              legalFormLabel: null,
              shortName,
            },
            representatives: [],
          },
          relationshipKind: "external",
          shortName,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await parseErrorMessage(
            response,
            `Не удалось создать контрагента: ${response.status}`,
          ),
        );
      }

      const created = (await response.json()) as {
        fullName: string;
        id: string;
        shortName: string;
      };

      setExtraCounterparties((current) => [
        ...current,
        {
          counterpartyId: created.id,
          fullName: created.fullName,
          inn: snapshot?.inn ?? null,
          orgName: created.shortName,
          shortName: created.shortName,
        },
      ]);
      setDraft((current) => ({
        ...current,
        externalBeneficiary: {
          ...current.externalBeneficiary,
          beneficiaryCounterpartyId: created.id,
        },
      }));
    } catch (nextError) {
      console.error("Failed to create beneficiary counterparty", nextError);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Не удалось создать CRM-контрагента получателя",
      );
    } finally {
      setIsCreatingBeneficiaryCounterparty(false);
    }
  }, [customerId, draft.externalBeneficiary.beneficiarySnapshot]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PencilLine className="h-4 w-4 text-muted-foreground" />
            Анкета сделки
          </CardTitle>
          <CardDescription>
            CRM редактирует канонический заголовок сделки напрямую. Здесь
            заполняются назначение платежа, получатель, реквизиты и параметры
            исполнения.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditable ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Заголовок сделки больше нельзя редактировать в текущем статусе.
              </AlertDescription>
            </Alert>
          ) : null}

          {incompleteSections.length > 0 ? (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Незаполненные разделы:{" "}
                {incompleteSections
                  .map(
                    (section) =>
                      DEAL_SECTION_LABELS[section.sectionId] ?? section.sectionId,
                  )
                  .join(", ")}
                .
              </AlertDescription>
            </Alert>
          ) : null}

          <DealIntakeForm
            applicantRequisites={applicantRequisites}
            currencyOptions={currencyOptions}
            intake={draft}
            isCreatingBeneficiaryCounterparty={
              isCreatingBeneficiaryCounterparty
            }
            counterparties={counterparties}
            moneyRequestLayout="inline"
            onChange={setDraft}
            onCreateBeneficiaryCounterparty={
              isEditable ? handleCreateBeneficiaryCounterparty : undefined
            }
            readOnly={!isEditable}
          />

          {loadingContext ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаем справочники анкеты...
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button disabled={!canSave} onClick={() => void handleSubmit()}>
              {isSaving ? "Сохраняем анкету..." : "Сохранить анкету"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
