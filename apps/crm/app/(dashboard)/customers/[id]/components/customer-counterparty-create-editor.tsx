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
import type { LocalizedTextVariant } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

type CustomerCounterpartyCreateEditorProps = {
  customerId: string;
  localizedTextVariant?: LocalizedTextVariant;
  onCreated: (counterpartyId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
};

const CreatedCounterpartySchema = z.object({
  id: z.uuid(),
});

const INITIAL_VALUES: CounterpartyGeneralFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  description: "",
  customerId: "",
  groupIds: [],
};

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
  localizedTextVariant,
  onCreated,
  onDirtyChange,
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

  useEffect(() => {
    onDirtyChange(generalDirty || legalDirty);
  }, [generalDirty, legalDirty, onDirtyChange]);

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
        onDirtyChange={setGeneralDirty}
        onValuesChange={setGeneralValues}
        onSubmit={async (values) => {
          setError(null);
          setSubmitting(true);

          const fallbackCountryCode = values.country.trim() || null;
          const partyProfile =
            partyProfileDraft ??
            createSeededPartyProfileBundle({
              fullName: values.fullName.trim(),
              shortName: values.shortName.trim(),
              countryCode: fallbackCountryCode,
            });

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
        localizedTextVariant={localizedTextVariant}
        partyKind={generalValues.kind}
        seed={partyProfileSeed}
        submitting={submitting}
        error={error}
        onDirtyChange={setLegalDirty}
        showActions={false}
        showIdentityFields={false}
        showLocalizedTextModeSwitcher={false}
        onChange={(bundle) => {
          setPartyProfileDraft(bundle);
        }}
        title={counterpartyDetailsCopy.title}
      />
    </div>
  );
}
