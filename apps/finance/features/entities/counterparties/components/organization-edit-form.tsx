"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  CounterpartyGeneralEditor,
  type CounterpartyGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { CounterpartyDeleteDialog } from "./counterparty-delete-dialog";
import { useCounterpartyDraftName } from "../lib/create-draft-name-context";
import { apiClient } from "@/lib/api-client";
import type {
  CounterpartyDetails,
  CounterpartyGroupOption,
} from "../lib/queries";
import { executeMutation } from "@/lib/resources/http";

type CounterpartyEditFormProps = {
  counterparty: CounterpartyDetails;
  initialGroupOptions: CounterpartyGroupOption[];
  lockedGroupIds?: string[];
  listPath?: string;
  disableSubmit?: boolean;
  initialLoadError?: string | null;
};

function toFormValues(
  counterparty: CounterpartyEditFormProps["counterparty"],
): CounterpartyGeneralFormValues {
  return {
    shortName: counterparty.shortName,
    shortNameEn: "",
    fullName: counterparty.fullName,
    fullNameEn: "",
    kind: counterparty.kind,
    country: counterparty.country ?? "",
    description: counterparty.description ?? "",
    customerId: counterparty.customerId ?? "",
    groupIds: counterparty.groupIds,
  };
}

export function CounterpartyEditForm({
  counterparty,
  initialGroupOptions,
  lockedGroupIds,
  listPath = "/entities/counterparties",
  disableSubmit = false,
  initialLoadError = null,
}: CounterpartyEditFormProps) {
  const router = useRouter();
  const { actions } = useCounterpartyDraftName();
  const [current, setCurrent] = useState(counterparty);
  const [submitting, setSubmitting] = useState(false);
  const [savingLegalEntity, setSavingLegalEntity] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [initialValues, setInitialValues] = useState(() =>
    toFormValues(current),
  );

  const handleShortNameChange = useCallback(
    (name: string) => {
      actions.setEditName(current.id, name);
    },
    [actions, current.id],
  );
  const partyProfileSeed = useMemo(
    () => ({
      fullName: current.fullName,
      shortName: current.shortName,
      countryCode: current.country,
    }),
    [current.country, current.fullName, current.shortName],
  );

  async function handleSubmit(
    values: CounterpartyGeneralFormValues,
  ): Promise<CounterpartyGeneralFormValues | void> {
    setError(null);
    setSubmitting(true);

    const customerId =
      typeof values.customerId === "string" ? values.customerId.trim() : "";

    const partyProfile =
      current.partyProfile
        ? {
            ...current.partyProfile,
            profile: {
              ...current.partyProfile.profile,
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

    const result = await executeMutation<CounterpartyDetails>({
      request: async () => {
        const patchResponse = await apiClient.v1.counterparties[":id"].$patch({
          param: {
            id: current.id,
          },
          json: {
            description: values.description.trim() || null,
            customerId: customerId || null,
            groupIds: values.groupIds,
          },
        });

        if (!patchResponse.ok) {
          return patchResponse;
        }

        const partyProfileResponse =
          await apiClient.v1.counterparties[":id"]["party-profile"].$put({
            param: { id: current.id },
            json: partyProfile,
          });

        if (!partyProfileResponse.ok) {
          return partyProfileResponse;
        }

        return apiClient.v1.counterparties[":id"].$get({
          param: { id: current.id },
        });
      },
      fallbackMessage: "Не удалось обновить контрагента",
      parseData: async (response) => (await response.json()) as CounterpartyDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    const nextValues = toFormValues(result.data);
    setCurrent(result.data);
    setInitialValues(nextValues);
    toast.success("Контрагент обновлен");
    router.refresh();
    return nextValues;
  }

  async function handleDelete(): Promise<boolean> {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.counterparties[":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить контрагента",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    actions.clearEdit(current.id);
    router.push(listPath.replace(/\/+$/, ""));
    return true;
  }

  return (
    <div className="space-y-6">
      <CounterpartyGeneralEditor
        initialValues={initialValues}
        groupOptions={initialGroupOptions}
        kindReadonly
        lockedGroupIds={lockedGroupIds}
        submitting={submitting}
        error={error}
        onSubmit={disableSubmit ? undefined : handleSubmit}
        onShortNameChange={handleShortNameChange}
        createdAt={current.createdAt}
        updatedAt={current.updatedAt}
        headerActions={
          <CounterpartyDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            deleting={deleting}
            onDelete={handleDelete}
            disableDelete={submitting}
            trigger={
              <Button variant="destructive" type="button" disabled={submitting} />
            }
          />
        }
      />
      {current.kind === "legal_entity" ? (
        <PartyProfileEditor
          bundle={current.partyProfile}
          seed={partyProfileSeed}
          submitting={savingLegalEntity}
          error={error}
          onSubmit={async (bundle) => {
            setError(null);
            setSavingLegalEntity(true);

            const result = await executeMutation<CounterpartyDetails>({
              request: async () => {
                const response =
                  await apiClient.v1.counterparties[":id"]["party-profile"].$put({
                    param: { id: current.id },
                    json: bundle,
                  });

                if (!response.ok) {
                  return response;
                }

                return apiClient.v1.counterparties[":id"].$get({
                  param: { id: current.id },
                });
              },
              fallbackMessage: "Не удалось обновить юридические данные контрагента",
              parseData: async (response) =>
                (await response.json()) as CounterpartyDetails,
            });

            setSavingLegalEntity(false);

            if (!result.ok) {
              setError(result.message);
              toast.error(result.message);
              return;
            }

            const nextValues = toFormValues(result.data);
            setCurrent(result.data);
            setInitialValues(nextValues);
            toast.success("Юридические данные контрагента обновлены");
            router.refresh();

            return result.data.partyProfile ?? bundle;
          }}
          title="Мастер-данные контрагента"
        />
      ) : null}
    </div>
  );
}
