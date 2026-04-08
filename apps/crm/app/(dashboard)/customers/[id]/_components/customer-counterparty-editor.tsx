"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import { CounterpartyGroupOptionsResponseSchema } from "@bedrock/parties/contracts";
import {
  CounterpartyGeneralEditor,
  type CounterpartyGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import type { PartyProfileBundleSource } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

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
  onDirtyChange: (dirty: boolean) => void;
  onSaved?: () => void;
  resetSignal: number;
};

function toGeneralFormValues(
  counterparty: CounterpartyEditorPayload,
): CounterpartyGeneralFormValues {
  return {
    shortName: counterparty.shortName,
    fullName: counterparty.fullName,
    kind: counterparty.kind,
    country: counterparty.country ?? "",
    description: counterparty.description ?? "",
    customerId: counterparty.customerId ?? "",
    groupIds: counterparty.groupIds,
  };
}

export function CustomerCounterpartyEditor({
  counterpartyId,
  onDirtyChange,
  onSaved,
  resetSignal,
}: CustomerCounterpartyEditorProps) {
  const [counterparty, setCounterparty] =
    useState<CounterpartyEditorPayload | null>(null);
  const [groupOptions, setGroupOptions] = useState<
    z.infer<typeof CounterpartyGroupOptionsResponseSchema>["data"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [generalDirty, setGeneralDirty] = useState(false);
  const [legalDirty, setLegalDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setGroupOptions(groupPayload.data);
          setGeneralDirty(false);
          setLegalDirty(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить профиль контрагента",
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Загрузка профиля контрагента...
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

  return (
    <div className="space-y-6">
      <CounterpartyGeneralEditor
        initialValues={toGeneralFormValues(counterparty)}
        groupOptions={groupOptions}
        lockedGroupIds={lockedGroupIds}
        createdAt={counterparty.createdAt}
        updatedAt={counterparty.updatedAt}
        submitting={savingGeneral}
        error={error}
        onDirtyChange={setGeneralDirty}
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

              const bundle =
                counterparty.partyProfile
                  ? {
                      ...counterparty.partyProfile,
                      profile: {
                        ...counterparty.partyProfile.profile,
                        fullName: values.fullName.trim(),
                        shortName: values.shortName.trim(),
                        countryCode: values.country.trim() || null,
                      },
                    }
                  : createSeededPartyProfileBundle({
                      fullName: values.fullName.trim(),
                      shortName: values.shortName.trim(),
                      countryCode: values.country.trim() || null,
                    });

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
            fallbackMessage: "Не удалось сохранить данные контрагента",
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
        submitLabel="Сохранить контрагента"
        submittingLabel="Сохранение..."
      />
      <PartyProfileEditor
        bundle={counterparty.partyProfile}
        partyKind={counterparty.kind}
        seed={partyProfileSeed}
        submitting={savingLegal}
        error={error}
        onDirtyChange={setLegalDirty}
        onSubmit={async (bundle: PartyProfileBundleInput) => {
          setError(null);
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
            fallbackMessage: "Не удалось сохранить профиль контрагента",
            parseData: async (response) =>
              readJsonWithSchema(response, CounterpartyEditorSchema),
          });

          setSavingLegal(false);

          if (!result.ok) {
            setError(result.message);
            return;
          }

          setCounterparty(result.data);
          setLegalDirty(false);
          onSaved?.();

          return result.data.partyProfile ?? bundle;
        }}
        title="Профиль контрагента"
      />
    </div>
  );
}
