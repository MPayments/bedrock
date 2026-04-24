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
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import {
  readLocalizedTextLocale,
  updateLocalizedTextLocale,
  type LocalizedTextVariant,
} from "@bedrock/sdk-parties-ui/lib/localized-text";
import type { PartyProfileBundleSource } from "@bedrock/sdk-parties-ui/lib/party-profile";
import {
  createSeededPartyProfileBundle,
  toPartyProfileBundleInput,
} from "@bedrock/sdk-parties-ui/lib/party-profile";
import {
  parsePartyProfileZodErrorMessage,
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

const CounterpartyEditorSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: z.enum(["legal_entity", "individual"]),
  customerId: z.uuid().nullable(),
  groupIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  partyProfile: z.custom<PartyProfileBundleSource | null>().nullable(),
});

type CounterpartyEditorPayload = z.infer<typeof CounterpartyEditorSchema>;

type CustomerCounterpartyEditorProps = {
  counterpartyId: string;
  bilingualMode?: CounterpartyGeneralBilingualMode;
  externalPatch?: CounterpartyGeneralEditorExternalPatch | null;
  localizedTextVariant?: LocalizedTextVariant;
  onDirtyChange: (dirty: boolean) => void;
  onGeneralValuesChange?: (values: CounterpartyGeneralFormValues) => void;
  onPartyProfileChange?: (draft: PartyProfileBundleInput | null) => void;
  onSaved?: () => void;
  partyProfileOverride?: PartyProfileOverride | null;
  resetSignal: number;
};

function extractProfileErrorsFromPayload(
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
          "Идентификаторы, адрес, контакты и англоязычные поля контрагента.",
        title: "Детали контрагента",
      }
    : {
        description:
          "Юридические реквизиты, идентификаторы, адрес, контакты, представители и лицензии контрагента.",
        title: "Юридические и контактные данные",
      };
}

function toGeneralFormValues(
  counterparty: CounterpartyEditorPayload,
): CounterpartyGeneralFormValues {
  const fullNameI18n = counterparty.partyProfile?.profile.fullNameI18n ?? null;
  const shortNameI18n = counterparty.partyProfile?.profile.shortNameI18n ?? null;
  return {
    shortName: counterparty.shortName,
    shortNameEn: readLocalizedTextLocale({
      localeMap: shortNameI18n,
      locale: "en",
    }),
    fullName: counterparty.fullName,
    fullNameEn: readLocalizedTextLocale({
      localeMap: fullNameI18n,
      locale: "en",
    }),
    kind: counterparty.kind,
    country: counterparty.country ?? "",
    description: counterparty.description ?? "",
    customerId: counterparty.customerId ?? "",
    groupIds: counterparty.groupIds,
  };
}

export function CustomerCounterpartyEditor({
  counterpartyId,
  bilingualMode,
  externalPatch,
  localizedTextVariant,
  onDirtyChange,
  onGeneralValuesChange,
  onPartyProfileChange,
  onSaved,
  partyProfileOverride,
  resetSignal,
}: CustomerCounterpartyEditorProps) {
  const [counterparty, setCounterparty] =
    useState<CounterpartyEditorPayload | null>(null);
  const [overriddenPartyProfile, setOverriddenPartyProfile] =
    useState<PartyProfileBundleInput | null>(null);
  const [groupOptions, setGroupOptions] = useState<
    z.infer<typeof CounterpartyGroupOptionsResponseSchema>["data"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [generalDirty, setGeneralDirty] = useState(false);
  const [legalDirty, setLegalDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileServerErrors, setProfileServerErrors] =
    useState<PartyProfileValidationErrors>({});

  useEffect(() => {
    onDirtyChange(generalDirty || legalDirty);
  }, [generalDirty, legalDirty, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;

    async function loadCounterparty() {
      try {
        setLoading(true);
        setError(null);

        const [counterpartyResponse, groupOptionsResponse] = await Promise.all([
          apiClient.v1.counterparties[":id"].$get({
            param: { id: counterpartyId },
          }),
          apiClient.v1["counterparty-groups"].options.$get({}),
        ]);

        if (!counterpartyResponse.ok) {
          throw new Error("Не удалось загрузить данные контрагента");
        }
        if (!groupOptionsResponse.ok) {
          throw new Error("Не удалось загрузить группы контрагентов");
        }

        const [counterpartyPayload, groupPayload] = await Promise.all([
          readJsonWithSchema(counterpartyResponse, CounterpartyEditorSchema),
          readJsonWithSchema(
            groupOptionsResponse,
            CounterpartyGroupOptionsResponseSchema,
          ),
        ]);

        if (!cancelled) {
          setCounterparty(counterpartyPayload);
          setOverriddenPartyProfile(null);
          setGroupOptions(groupPayload.data);
          setGeneralDirty(false);
          setLegalDirty(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить карточку контрагента",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCounterparty();

    return () => {
      cancelled = true;
    };
  }, [counterpartyId, resetSignal]);

  const lockedGroupIds = useMemo(() => {
    if (!counterparty?.customerId) {
      return [];
    }

    const managedGroupId = groupOptions.find(
      (group) => group.code === `customer:${counterparty.customerId}`,
    )?.id;

    return managedGroupId ? [managedGroupId] : [];
  }, [counterparty?.customerId, groupOptions]);

  const partyProfileSeed = useMemo(
    () =>
      counterparty
        ? {
            fullName: counterparty.fullName,
            shortName: counterparty.shortName,
            countryCode: counterparty.country,
          }
        : undefined,
    [counterparty],
  );
  const initialValues = useMemo(
    () => (counterparty ? toGeneralFormValues(counterparty) : undefined),
    [counterparty],
  );

  const partyProfileOverrideNonce = partyProfileOverride?.nonce ?? null;
  useEffect(() => {
    if (!partyProfileOverride || !counterparty) {
      return;
    }

    const base =
      overriddenPartyProfile ??
      (counterparty.partyProfile
        ? toPartyProfileBundleInput(counterparty.partyProfile, partyProfileSeed)
        : createSeededPartyProfileBundle({
            fullName: counterparty.fullName,
            shortName: counterparty.shortName,
            countryCode: counterparty.country,
          }));

    const next = applyPartyProfilePatch(base, partyProfileOverride.patch);
    setOverriddenPartyProfile(next);
    onPartyProfileChange?.(next);
    setLegalDirty(true);
    // Triggered by nonce change; dependencies intentionally narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyProfileOverrideNonce]);

  const effectiveBundle: PartyProfileBundleSource | PartyProfileBundleInput | null =
    overriddenPartyProfile ?? counterparty?.partyProfile ?? null;

  if (loading) {
    return (
        <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Загрузка карточки контрагента...
        </CardContent>
      </Card>
    );
  }

  if (!counterparty) {
    return (
        <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Не удалось загрузить данные контрагента.
        </CardContent>
      </Card>
    );
  }

  const counterpartyDetailsCopy = getCounterpartyDetailsCopy(counterparty.kind);

  return (
    <div className="space-y-6">
      <CounterpartyGeneralEditor
        initialValues={initialValues}
        groupOptions={groupOptions}
        lockedGroupIds={lockedGroupIds}
        createdAt={counterparty.createdAt}
        updatedAt={counterparty.updatedAt}
        submitting={savingGeneral}
        error={error}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        kindReadonly
        onDirtyChange={setGeneralDirty}
        onValuesChange={onGeneralValuesChange}
        onSubmit={async (values) => {
          if (values.kind !== counterparty.kind) {
            setError("Смена типа контрагента в CRM не поддерживается");
            return;
          }

          setError(null);
          setSavingGeneral(true);

          const result = await executeApiMutation<CounterpartyEditorPayload>({
            request: async () => {
              const patchResponse = await apiClient.v1.counterparties[":id"].$patch({
                param: { id: counterpartyId },
                json: {
                  description: values.description.trim() || null,
                  customerId: values.customerId.trim() || null,
                  groupIds: values.groupIds,
                },
              });

              if (!patchResponse.ok) {
                return patchResponse;
              }

              const existingProfile = counterparty.partyProfile;
              const nextFullNameI18n = updateLocalizedTextLocale({
                baseValue: values.fullName.trim(),
                localeMap: existingProfile?.profile.fullNameI18n ?? null,
                nextValue: values.fullNameEn.trim(),
                locale: "en",
              }).localeMap;
              const nextShortNameI18n = updateLocalizedTextLocale({
                baseValue: values.shortName.trim(),
                localeMap: existingProfile?.profile.shortNameI18n ?? null,
                nextValue: values.shortNameEn.trim(),
                locale: "en",
              }).localeMap;

              const baseBundle =
                existingProfile ??
                createSeededPartyProfileBundle({
                  fullName: values.fullName.trim(),
                  shortName: values.shortName.trim(),
                  countryCode: values.country.trim() || null,
                });
              const bundle = {
                ...baseBundle,
                profile: {
                  ...baseBundle.profile,
                  fullName: values.fullName.trim(),
                  shortName: values.shortName.trim(),
                  fullNameI18n: nextFullNameI18n,
                  shortNameI18n: nextShortNameI18n,
                  countryCode: values.country.trim() || null,
                },
              };

              const partyProfileResponse =
                await apiClient.v1.counterparties[":id"]["party-profile"].$put({
                  param: { id: counterpartyId },
                  json: bundle,
                });

              if (!partyProfileResponse.ok) {
                return partyProfileResponse;
              }

              return apiClient.v1.counterparties[":id"].$get({
                param: { id: counterpartyId },
              });
            },
            fallbackMessage: "Не удалось сохранить карточку контрагента",
            parseData: async (response) =>
              readJsonWithSchema(response, CounterpartyEditorSchema),
          });

          setSavingGeneral(false);

          if (!result.ok) {
            setError(result.message);
            return;
          }

          setCounterparty(result.data);
          setGeneralDirty(false);
          onSaved?.();
          return toGeneralFormValues(result.data);
        }}
        description="Базовая карточка контрагента: отображаемое имя, тип, страна и внутренний комментарий."
        submitLabel="Сохранить карточку"
        submittingLabel="Сохранение..."
        showGroups={false}
        title="Карточка контрагента"
      />
      <PartyProfileEditor
        bundle={effectiveBundle}
        description={counterpartyDetailsCopy.description}
        externalErrors={profileServerErrors}
        localizedTextVariant={localizedTextVariant}
        partyKind={counterparty.kind}
        seed={partyProfileSeed}
        submitting={savingLegal}
        error={error}
        onChange={(bundle) => {
          setOverriddenPartyProfile(bundle);
          onPartyProfileChange?.(bundle);
        }}
        onDirtyChange={setLegalDirty}
        onSubmit={async (bundle: PartyProfileBundleInput) => {
          setError(null);
          setProfileServerErrors({});
          setSavingLegal(true);

          const result = await executeApiMutation<CounterpartyEditorPayload>({
            request: async () => {
              const response =
                await apiClient.v1.counterparties[":id"]["party-profile"].$put({
                  param: { id: counterpartyId },
                  json: bundle,
                });

              if (!response.ok) {
                return response;
              }

              return apiClient.v1.counterparties[":id"].$get({
                param: { id: counterpartyId },
              });
            },
            fallbackMessage: "Не удалось сохранить дополнительные данные контрагента",
            parseData: async (response) =>
              readJsonWithSchema(response, CounterpartyEditorSchema),
          });

          setSavingLegal(false);

          if (!result.ok) {
            const serverProfileErrors = extractProfileErrorsFromPayload(
              result.payload,
            );
            if (Object.keys(serverProfileErrors).length > 0) {
              setProfileServerErrors(serverProfileErrors);
            }
            setError(result.message);
            return;
          }

          setCounterparty(result.data);
          setOverriddenPartyProfile(null);
          setLegalDirty(false);
          onSaved?.();

          return result.data.partyProfile ?? bundle;
        }}
        showIdentityFields={false}
        showLocalizedTextModeSwitcher={false}
        submitLabel="Сохранить детали"
        title={counterpartyDetailsCopy.title}
      />
    </div>
  );
}
