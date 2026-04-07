"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";

import type { PartyLegalEntityBundleInput } from "@bedrock/parties/contracts";
import { CounterpartyGroupOptionsResponseSchema } from "@bedrock/parties/contracts";
import {
  CounterpartyGeneralEditor,
  type CounterpartyGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import { LegalEntityBundleEditor } from "@bedrock/sdk-parties-ui/components/legal-entity-bundle-editor";
import { createSeededLegalEntityBundle } from "@bedrock/sdk-parties-ui/lib/legal-entity";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

type CustomerCounterpartyLegalEntityCreateEditorProps = {
  customerId: string;
  onCancel: () => void;
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

export function CustomerCounterpartyLegalEntityCreateEditor({
  customerId,
  onCancel,
  onCreated,
  onDirtyChange,
}: CustomerCounterpartyLegalEntityCreateEditorProps) {
  const [groupOptions, setGroupOptions] = useState<
    z.infer<typeof CounterpartyGroupOptionsResponseSchema>["data"]
  >([]);
  const [generalValues, setGeneralValues] =
    useState<CounterpartyGeneralFormValues>(INITIAL_VALUES);
  const [legalEntityDraft, setLegalEntityDraft] =
    useState<PartyLegalEntityBundleInput | null>(null);
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

  const legalEntitySeed = useMemo(
    () => ({
      fullName: generalValues.fullName,
      shortName: generalValues.shortName,
      countryCode: generalValues.country || null,
    }),
    [generalValues.country, generalValues.fullName, generalValues.shortName],
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Загрузка формы создания юридического лица...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CounterpartyGeneralEditor
        initialValues={{
          ...INITIAL_VALUES,
          groupIds: lockedGroupIds,
        }}
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
          const legalEntity =
            legalEntityDraft ??
            createSeededLegalEntityBundle({
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
                  legalEntity: {
                    ...legalEntity,
                    profile: {
                      ...legalEntity.profile,
                      fullName:
                        legalEntity.profile.fullName.trim() ||
                        values.fullName.trim(),
                      shortName:
                        legalEntity.profile.shortName.trim() ||
                        values.shortName.trim(),
                      countryCode:
                        legalEntity.profile.countryCode ?? fallbackCountryCode,
                    },
                  },
                },
              }),
            fallbackMessage: "Ошибка создания юридического лица",
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
        submitLabel="Создать юридическое лицо"
        submittingLabel="Создание..."
        disableSubmitUntilDirty={false}
        showDates={false}
        headerActions={
          <Button variant="outline" type="button" onClick={onCancel}>
            <X className="size-4" />
            Отменить
          </Button>
        }
      />
      <LegalEntityBundleEditor
        bundle={legalEntityDraft}
        seed={legalEntitySeed}
        submitting={submitting}
        error={error}
        onDirtyChange={setLegalDirty}
        showActions={false}
        onChange={(bundle) => {
          setLegalEntityDraft(bundle);
        }}
        title="Юридическое лицо"
      />
    </div>
  );
}
