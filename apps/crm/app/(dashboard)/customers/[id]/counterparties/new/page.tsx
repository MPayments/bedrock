"use client";

import { Loader2, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
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

import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import { EntityPageHeader } from "@/components/app/entity-page-header";
import { translateCounterpartyToEnglish } from "@/lib/translate-party-profile";
import {
  CounterpartyInputMethodCard,
  type CounterpartyInputMethod,
  type CounterpartyPrefillPatch,
} from "../../components/counterparty-input-method-card";
import { CustomerCounterpartyCreateEditor } from "../../components/customer-counterparty-create-editor";
import type { PartyProfileOverride } from "../../components/customer-counterparty-create-editor";
import {
  buildCustomerCounterpartyDetailsHref,
} from "../../lib/customer-detail";
import { getCustomerWorkspace } from "../../lib/customer-workspace-api";

export default function CustomerCounterpartyCreatePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bilingualMode, setBilingualMode] = useState<BilingualMode>("all");
  const [inputMethod, setInputMethod] =
    useState<CounterpartyInputMethod>("manual");
  const [externalPatch, setExternalPatch] =
    useState<CounterpartyGeneralEditorExternalPatch | null>(null);
  const [partyProfileOverride, setPartyProfileOverride] =
    useState<PartyProfileOverride | null>(null);
  const [generalValues, setGeneralValues] =
    useState<CounterpartyGeneralFormValues | null>(null);
  const [partyProfileDraft, setPartyProfileDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useCrmBreadcrumbs(
    customerName
      ? [
          {
            href: `/customers/${customerId}`,
            label: customerName,
          },
        ]
      : [],
  );

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const workspace = await getCustomerWorkspace(customerId);
      setCustomerName(workspace.name);
    } catch (loadError) {
      console.error("Failed to load customer for counterparty create page", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить клиента",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const counterpartyKind: "legal_entity" | "individual" =
    generalValues?.kind ?? "legal_entity";

  useEffect(() => {
    if (counterpartyKind === "individual" && inputMethod !== "manual") {
      setInputMethod("manual");
    }
  }, [counterpartyKind, inputMethod]);

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
        ],
      }).ratio,
    [partyProfileDraft, generalValues],
  );

  const handlePrefill = useCallback((patch: CounterpartyPrefillPatch) => {
    const now = Date.now();
    setExternalPatch({ nonce: now, patch: patch.general });
    setPartyProfileOverride({ nonce: now, patch: patch.profile });
  }, []);

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
              {error ?? "Клиент не найден"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createHeaderTitle =
    generalValues?.shortNameEn?.trim() ||
    generalValues?.shortName?.trim() ||
    "Новый контрагент";

  return (
    <div className="space-y-4">
      <EntityPageHeader
        avatar={{ icon: <Plus className="size-4" /> }}
        title={createHeaderTitle}
        badge={{ label: "Draft", variant: "warning" }}
        infoItems={[
          "Новый контрагент",
          customerName ? `Клиент ${customerName}` : null,
        ]}
      />

      <CounterpartyInputMethodCard
        counterpartyKind={counterpartyKind}
        mode={inputMethod}
        onModeChange={setInputMethod}
        onPrefill={handlePrefill}
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

      <CustomerCounterpartyCreateEditor
        customerId={customerId}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        localizedTextVariant={bilingualMode}
        partyProfileOverride={partyProfileOverride}
        onCreated={(counterpartyId) => {
          router.replace(
            buildCustomerCounterpartyDetailsHref(customerId, counterpartyId),
          );
        }}
        onDirtyChange={() => {}}
        onGeneralValuesChange={setGeneralValues}
        onPartyProfileChange={setPartyProfileDraft}
      />
    </div>
  );
}
