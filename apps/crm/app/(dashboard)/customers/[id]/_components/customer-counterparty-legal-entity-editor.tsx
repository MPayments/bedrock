"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

import type { PartyLegalEntityBundleInput } from "@bedrock/parties/contracts";
import type { PartyLegalEntityBundleSource } from "@bedrock/sdk-parties-ui/lib/legal-entity";
import { LegalEntityBundleEditor } from "@bedrock/sdk-parties-ui/components/legal-entity-bundle-editor";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

const CounterpartyEditorSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  fullName: z.string(),
  country: z.string().nullable(),
  kind: z.enum(["legal_entity", "individual"]),
  legalEntity: z.custom<PartyLegalEntityBundleSource | null>(),
});

type CounterpartyEditorPayload = z.infer<typeof CounterpartyEditorSchema>;

type CustomerCounterpartyLegalEntityEditorProps = {
  counterpartyId: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaved?: () => void;
  resetSignal: number;
};

export function CustomerCounterpartyLegalEntityEditor({
  counterpartyId,
  onDirtyChange,
  onSaved,
  resetSignal,
}: CustomerCounterpartyLegalEntityEditorProps) {
  const [counterparty, setCounterparty] =
    useState<CounterpartyEditorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCounterparty() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.v1.counterparties[":id"].$get({
          param: { id: counterpartyId },
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить юридические данные");
        }

        const payload = await readJsonWithSchema(response, CounterpartyEditorSchema);

        if (!cancelled) {
          setCounterparty(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить юридические данные",
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Загрузка юридических данных...
        </CardContent>
      </Card>
    );
  }

  if (!counterparty || counterparty.kind !== "legal_entity") {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          У выбранного контрагента нет редактируемого юридического профиля.
        </CardContent>
      </Card>
    );
  }

  return (
    <LegalEntityBundleEditor
      bundle={counterparty.legalEntity}
      seed={{
        fullName: counterparty.fullName,
        shortName: counterparty.shortName,
        countryCode: counterparty.country,
      }}
      submitting={saving}
      error={error}
      onDirtyChange={onDirtyChange}
      onSubmit={async (bundle: PartyLegalEntityBundleInput) => {
        setError(null);
        setSaving(true);

        const result = await executeApiMutation<CounterpartyEditorPayload>({
          request: async () => {
            const response =
              await apiClient.v1.counterparties[":id"]["legal-entity"].$put({
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
          fallbackMessage: "Не удалось сохранить юридические данные",
          parseData: async (response) =>
            readJsonWithSchema(response, CounterpartyEditorSchema),
        });

        setSaving(false);

        if (!result.ok) {
          setError(result.message);
          return;
        }

        setCounterparty(result.data);
        onSaved?.();

        return result.data.legalEntity ?? bundle;
      }}
      title="Юридическое лицо"
    />
  );
}
