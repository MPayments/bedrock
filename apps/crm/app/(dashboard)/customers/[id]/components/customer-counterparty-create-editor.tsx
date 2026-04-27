"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import { CounterpartyGroupOptionsResponseSchema } from "@bedrock/parties/contracts";
import {
  CounterpartyGeneralEditor,
  type CounterpartyGeneralBilingualMode,
  type CounterpartyGeneralEditorExternalPatch,
  type CounterpartyGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import { updateLocalizedTextLocale } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import type { LocalizedTextVariant } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import {
  hasPartyProfileValidationErrors,
  parsePartyProfileZodErrorMessage,
  validatePartyProfileBundle,
  type PartyProfileValidationErrors,
} from "@bedrock/sdk-parties-ui/lib/party-profile-validation";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";
import {
  applyPartyProfilePatch,
  type PartyProfileOverride,
} from "@/lib/party-profile-patch";

export type { PartyProfileOverride };

type CustomerCounterpartyCreateEditorProps = {
  customerId: string;
  externalPatch?: CounterpartyGeneralEditorExternalPatch | null;
  bilingualMode?: CounterpartyGeneralBilingualMode;
  localizedTextVariant?: LocalizedTextVariant;
  onCreated: (counterpartyId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onGeneralValuesChange?: (values: CounterpartyGeneralFormValues) => void;
  onPartyProfileChange?: (draft: PartyProfileBundleInput | null) => void;
  partyProfileOverride?: PartyProfileOverride | null;
};

const CreatedCounterpartySchema = z.object({
  id: z.uuid(),
});

const INITIAL_VALUES: CounterpartyGeneralFormValues = {
  shortName: "",
  shortNameEn: "",
  fullName: "",
  fullNameEn: "",
  kind: "legal_entity",
  country: "",
  description: "",
  customerId: "",
  groupIds: [],
};

function extractProfileErrorsFromResult(
  payload: unknown,
): PartyProfileValidationErrors {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const errorField = (payload as { error?: unknown }).error;
  if (!errorField || typeof errorField !== "object") {
    return {};
  }

  const message = (errorField as { message?: unknown }).message;
  return parsePartyProfileZodErrorMessage(message);
}

function getCounterpartyDetailsCopy(kind: "individual" | "legal_entity") {
  return kind === "individual"
    ? {
        description:
          "Идентификаторы, адрес, контакты и англоязычные поля будущего контрагента.",
        title: "Детали контрагента",
      }
    : {
        description:
          "Юридические реквизиты, идентификаторы, адрес, контакты, представители и лицензии будущего контрагента.",
        title: "Юридические и контактные данные",
      };
}

export function CustomerCounterpartyCreateEditor({
  customerId,
  externalPatch,
  bilingualMode,
  localizedTextVariant,
  onCreated,
  onDirtyChange,
  onGeneralValuesChange,
  onPartyProfileChange,
  partyProfileOverride,
}: CustomerCounterpartyCreateEditorProps) {
  const [groupOptions, setGroupOptions] = useState<
    z.infer<typeof CounterpartyGroupOptionsResponseSchema>["data"]
  >([]);
  const [generalValues, setGeneralValues] =
    useState<CounterpartyGeneralFormValues>(INITIAL_VALUES);
  const [partyProfileDraft, setPartyProfileDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generalDirty, setGeneralDirty] = useState(false);
  const [legalDirty, setLegalDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileErrors, setShowProfileErrors] = useState(false);
  const [profileServerErrors, setProfileServerErrors] =
    useState<PartyProfileValidationErrors>({});

  useEffect(() => {
    onDirtyChange(generalDirty || legalDirty);
  }, [generalDirty, legalDirty, onDirtyChange]);

  const partyProfileOverrideNonce = partyProfileOverride?.nonce ?? null;
  useEffect(() => {
    if (!partyProfileOverride) {
      return;
    }

    const base =
      partyProfileDraft ??
      createSeededPartyProfileBundle({
        fullName: generalValues.fullName,
        shortName: generalValues.shortName,
        countryCode: generalValues.country || null,
      });

    const next = applyPartyProfilePatch(base, partyProfileOverride.patch);
    setPartyProfileDraft(next);
    onPartyProfileChange?.(next);
    setLegalDirty(true);
    // Triggered by nonce change; dependencies intentionally narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyProfileOverrideNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadGroupOptions() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.v1["counterparty-groups"].options.$get({});
        if (!response.ok) {
          throw new Error("Не удалось загрузить группы контрагентов");
        }

        const payload = await readJsonWithSchema(
          response,
          CounterpartyGroupOptionsResponseSchema,
        );

        if (!cancelled) {
          setGroupOptions(payload.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить группы контрагентов",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGroupOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const lockedGroupIds = useMemo(() => {
    const managedGroupId = groupOptions.find(
      (group) => group.code === `customer:${customerId}`,
    )?.id;

    return managedGroupId ? [managedGroupId] : [];
  }, [customerId, groupOptions]);

  const partyProfileSeed = useMemo(
    () => ({
      fullName: generalValues.fullName,
      shortName: generalValues.shortName,
      countryCode: generalValues.country || null,
    }),
    [generalValues.country, generalValues.fullName, generalValues.shortName],
  );
  const initialValues = useMemo(
    () => ({
      ...INITIAL_VALUES,
      groupIds: lockedGroupIds,
    }),
    [lockedGroupIds],
  );

  if (loading) {
    return (
        <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Загрузка формы создания контрагента...
        </CardContent>
      </Card>
    );
  }

  const counterpartyDetailsCopy = getCounterpartyDetailsCopy(generalValues.kind);

  return (
    <div className="space-y-6">
      <CounterpartyGeneralEditor
        initialValues={initialValues}
        groupOptions={groupOptions}
        lockedGroupIds={lockedGroupIds}
        submitting={submitting}
        error={error}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        onDirtyChange={setGeneralDirty}
        onValuesChange={(values) => {
          setGeneralValues(values);
          onGeneralValuesChange?.(values);
        }}
        onSubmit={async (values) => {
          setError(null);
          setProfileServerErrors({});

          const fallbackCountryCode = values.country.trim() || null;
          const partyProfile =
            partyProfileDraft ??
            createSeededPartyProfileBundle({
              fullName: values.fullName.trim(),
              shortName: values.shortName.trim(),
              countryCode: fallbackCountryCode,
            });

          const clientErrors = validatePartyProfileBundle(partyProfile);
          if (hasPartyProfileValidationErrors(clientErrors)) {
            setShowProfileErrors(true);
            setError(
              "Исправьте ошибки в блоке «Юридические и контактные данные» ниже",
            );
            return;
          }

          setSubmitting(true);

          const nextFullNameI18n = updateLocalizedTextLocale({
            baseValue: values.fullName.trim(),
            localeMap: partyProfile.profile.fullNameI18n,
            nextValue: values.fullNameEn.trim(),
            locale: "en",
          }).localeMap;
          const nextShortNameI18n = updateLocalizedTextLocale({
            baseValue: values.shortName.trim(),
            localeMap: partyProfile.profile.shortNameI18n,
            nextValue: values.shortNameEn.trim(),
            locale: "en",
          }).localeMap;

          const result = await executeApiMutation<z.infer<typeof CreatedCounterpartySchema>>({
            request: () =>
              apiClient.v1.counterparties.$post({
                json: {
                  shortName: values.shortName.trim(),
                  fullName: values.fullName.trim(),
                  kind: values.kind,
                  country: values.country.trim() || undefined,
                  description: values.description.trim() || undefined,
                  customerId,
                  // Without this the server defaults to `external`, which hides
                  // the new counterparty from the customer's `customer_owned`
                  // workspace list and breaks the post-create redirect (the
                  // detail page looks the counterparty up via the workspace).
                  relationshipKind: "customer_owned",
                  groupIds: values.groupIds,
                  partyProfile: {
                    ...partyProfile,
                    profile: {
                      ...partyProfile.profile,
                      fullName:
                        partyProfile.profile.fullName.trim() ||
                        values.fullName.trim(),
                      shortName:
                        partyProfile.profile.shortName.trim() ||
                        values.shortName.trim(),
                      fullNameI18n: nextFullNameI18n,
                      shortNameI18n: nextShortNameI18n,
                      countryCode:
                        partyProfile.profile.countryCode ?? fallbackCountryCode,
                    },
                  },
                },
              }),
            fallbackMessage: "Ошибка создания контрагента",
            parseData: async (response) =>
              readJsonWithSchema(response, CreatedCounterpartySchema),
          });

          setSubmitting(false);

          if (!result.ok) {
            const serverProfileErrors = extractProfileErrorsFromResult(
              result.payload,
            );
            if (Object.keys(serverProfileErrors).length > 0) {
              setProfileServerErrors(serverProfileErrors);
              setShowProfileErrors(true);
            }
            setError(result.message);
            return;
          }

          setGeneralDirty(false);
          setLegalDirty(false);
          onCreated(result.data.id);
          return values;
        }}
        onShortNameChange={() => {}}
        description="Базовая карточка нового контрагента: как он будет называться, в какой стране работает и как отображается в CRM."
        submitLabel="Создать контрагента"
        submittingLabel="Создание..."
        disableSubmitUntilDirty={false}
        showGroups={false}
        showDates={false}
        title="Карточка контрагента"
      />
      <PartyProfileEditor
        bundle={partyProfileDraft}
        description={counterpartyDetailsCopy.description}
        externalErrors={profileServerErrors}
        localizedTextVariant={localizedTextVariant}
        partyKind={generalValues.kind}
        seed={partyProfileSeed}
        submitting={submitting}
        error={error}
        onDirtyChange={setLegalDirty}
        showActions={false}
        showIdentityFields={false}
        showLocalizedTextModeSwitcher={false}
        showValidationErrors={showProfileErrors}
        onChange={(bundle) => {
          setPartyProfileDraft(bundle);
          onPartyProfileChange?.(bundle);
        }}
        title={counterpartyDetailsCopy.title}
      />
    </div>
  );
}
