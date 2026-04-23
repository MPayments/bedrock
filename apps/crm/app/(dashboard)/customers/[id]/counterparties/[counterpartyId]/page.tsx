"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import {
  BilingualToolbar,
  type BilingualMode,
} from "@bedrock/sdk-parties-ui/components/bilingual-toolbar";
import type {
  CounterpartyGeneralEditorExternalPatch,
  CounterpartyGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import { computePartyProfileCompleteness } from "@bedrock/sdk-parties-ui/lib/party-profile-completeness";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import {
  resolveCounterpartyBreadcrumbLabel,
} from "@/components/app/breadcrumbs";
import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import {
  EntityPageHeader,
  getEntityInitials,
} from "@/components/app/entity-page-header";
import { translateCounterpartyToEnglish } from "@/lib/translate-party-profile";
import { CustomerCounterpartyEditor } from "../../components/customer-counterparty-editor";
import type { PartyProfileOverride } from "../../components/customer-counterparty-create-editor";
import { getCustomerWorkspace } from "../../lib/customer-workspace-api";

export default function CustomerCounterpartyDetailsPage() {
  const params = useParams();
  const customerId = params.id as string;
  const counterpartyId = params.counterpartyId as string;

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string | null>(null);
  const [initialCountry, setInitialCountry] = useState<string | null>(null);
  const [initialInn, setInitialInn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bilingualMode, setBilingualMode] = useState<BilingualMode>("all");
  const [partyProfileOverride, setPartyProfileOverride] =
    useState<PartyProfileOverride | null>(null);
  const [externalPatch, setExternalPatch] =
    useState<CounterpartyGeneralEditorExternalPatch | null>(null);
  const [partyProfileDraft, setPartyProfileDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [generalValues, setGeneralValues] =
    useState<CounterpartyGeneralFormValues | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useCrmBreadcrumbs([
    ...(customerName
      ? [
          {
            href: `/customers/${customerId}`,
            label: customerName,
          },
        ]
      : []),
    ...(counterpartyName
      ? [
          {
            href: `/customers/${customerId}/counterparties/${counterpartyId}`,
            label: counterpartyName,
          },
        ]
      : []),
  ]);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCustomerName(null);
      setCounterpartyName(null);
      const workspace = await getCustomerWorkspace(customerId);
      const counterparty = workspace.counterparties.find(
        (item) => item.counterpartyId === counterpartyId,
      );

      if (!counterparty) {
        throw new Error("Контрагент не найден у этого клиента");
      }

      setCustomerName(workspace.name);
      setCounterpartyName(resolveCounterpartyBreadcrumbLabel(counterparty));
      setInitialCountry(counterparty.country);
      setInitialInn(counterparty.inn);
    } catch (loadError) {
      console.error("Failed to load customer counterparty details page", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить контрагента",
      );
    } finally {
      setLoading(false);
    }
  }, [counterpartyId, customerId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const displayName = useMemo(() => {
    const shortEn = generalValues?.shortNameEn?.trim();
    const shortRu = generalValues?.shortName?.trim();
    return shortEn || shortRu || counterpartyName || "Контрагент";
  }, [
    counterpartyName,
    generalValues?.shortName,
    generalValues?.shortNameEn,
  ]);

  const displaySecondaryName = useMemo(() => {
    const shortEn = generalValues?.shortNameEn?.trim();
    const shortRu = generalValues?.shortName?.trim();
    if (shortEn && shortRu && shortEn !== shortRu) {
      return shortRu;
    }
    return null;
  }, [generalValues?.shortName, generalValues?.shortNameEn]);

  const headerCountry = generalValues?.country ?? initialCountry;
  const headerInn = useMemo(() => {
    const fromDraft = partyProfileDraft?.identifiers?.find(
      (identifier) => identifier.scheme === "inn",
    )?.value;
    return fromDraft ?? initialInn ?? null;
  }, [initialInn, partyProfileDraft]);

  const completeness = useMemo(
    () =>
      computePartyProfileCompleteness(partyProfileDraft, {
        excludeProfileNames: true,
        extraPairs: [
          {
            ru: generalValues?.shortName ?? "",
            en: generalValues?.shortNameEn ?? "",
          },
          {
            ru: generalValues?.fullName ?? "",
            en: generalValues?.fullNameEn ?? "",
          },
          {
            ru: generalValues?.description ?? "",
            en: generalValues?.descriptionEn ?? "",
          },
        ],
      }).ratio,
    [partyProfileDraft, generalValues],
  );

  const handleTranslateAll = useCallback(async () => {
    if (!partyProfileDraft && !generalValues) {
      return;
    }

    setTranslating(true);
    setTranslateError(null);
    try {
      const next = await translateCounterpartyToEnglish({
        bundle: partyProfileDraft,
        general: generalValues
          ? {
              shortName: generalValues.shortName,
              shortNameEn: generalValues.shortNameEn,
              fullName: generalValues.fullName,
              fullNameEn: generalValues.fullNameEn,
              description: generalValues.description,
              descriptionEn: generalValues.descriptionEn,
            }
          : null,
      });
      const nonce = Date.now();
      if (next.profile) {
        setPartyProfileOverride({ nonce, patch: next.profile });
      }
      if (Object.keys(next.general).length > 0) {
        setExternalPatch({ nonce, patch: next.general });
      }
    } catch (translationError) {
      setTranslateError(
        translationError instanceof Error
          ? translationError.message
          : "Ошибка перевода полей",
      );
    } finally {
      setTranslating(false);
    }
  }, [partyProfileDraft, generalValues]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customerName) {
    return (
      <div className="space-y-4">
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {error ?? "Контрагент не найден"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EntityPageHeader
        avatar={{ initials: getEntityInitials(displayName) }}
        title={displayName}
        titleSecondary={displaySecondaryName ?? undefined}
        badge={{ label: "Active", variant: "success" }}
        infoItems={[
          <span key="id" className="font-mono">
            ID {shortenUuid(counterpartyId)}
          </span>,
          headerCountry ?? "—",
          <span key="inn" className="font-mono">
            ИНН {headerInn ?? "—"}
          </span>,
          customerName ? `Клиент ${customerName}` : null,
        ]}
      />

      <BilingualToolbar
        value={bilingualMode}
        onChange={setBilingualMode}
        completeness={completeness}
        onTranslateAll={handleTranslateAll}
        translating={translating}
      />

      {translateError ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {translateError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <CustomerCounterpartyEditor
        counterpartyId={counterpartyId}
        bilingualMode={bilingualMode}
        externalPatch={externalPatch}
        localizedTextVariant={bilingualMode}
        onDirtyChange={() => {}}
        onGeneralValuesChange={setGeneralValues}
        onPartyProfileChange={setPartyProfileDraft}
        onSaved={() => {
          void loadWorkspace();
        }}
        partyProfileOverride={partyProfileOverride}
        resetSignal={0}
      />
    </div>
  );
}

function shortenUuid(id: string) {
  if (id.length <= 10) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}
