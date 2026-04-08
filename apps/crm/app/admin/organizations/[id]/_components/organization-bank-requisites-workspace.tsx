"use client";

import { AlertCircle, Loader2, Plus, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { RequisiteProviderSchema } from "@bedrock/parties/contracts";
import { RequisiteEditor } from "@bedrock/sdk-parties-ui/components/requisite-editor";
import type { RequisiteFormValues } from "@bedrock/sdk-parties-ui/lib/requisites";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

import {
  bankRequisiteToFormValues,
  createEmptyBankRequisiteValues,
  createOrganizationBankRequisitePatch,
  createOrganizationBankRequisitePayload,
  formatBankRequisiteIdentity,
  getBankProviderLabel,
  getCurrencyLabel,
  groupBankRequisitesByCurrency,
  OrganizationBankRequisiteSchema,
  resolveInitialBankRequisiteId,
  type OrganizationBankRequisite,
} from "../_lib/organization-bank-requisites";
import { useOrganizationBankRequisites } from "../_lib/use-organization-bank-requisites";

type OrganizationBankRequisitesWorkspaceProps = {
  initialSelectedRequisiteId: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSelectedRequisiteChange: (requisiteId: string | null) => void;
  organizationId: string;
  organizationName: string;
};

type EditorState =
  | { kind: "idle" }
  | { kind: "create" }
  | { kind: "existing"; requisiteId: string };

function isSameEditorState(left: EditorState, right: EditorState) {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind !== "existing" || right.kind !== "existing") {
    return true;
  }

  return left.requisiteId === right.requisiteId;
}

function toRelationOptions(
  items: Array<{
    id: string;
    label: string;
  }>,
) {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
  }));
}

export function OrganizationBankRequisitesWorkspace({
  initialSelectedRequisiteId,
  onDirtyChange,
  onSelectedRequisiteChange,
  organizationId,
  organizationName,
}: OrganizationBankRequisitesWorkspaceProps) {
  const {
    currencyOptions,
    error: loadError,
    loading,
    providerOptions,
    refresh,
    requisites,
  } = useOrganizationBankRequisites(organizationId);
  const [editorState, setEditorState] = useState<EditorState>({ kind: "idle" });
  const [editorDirty, setEditorDirty] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    onDirtyChange(editorDirty || editorState.kind === "create");
  }, [editorDirty, editorState.kind, onDirtyChange]);

  const groupedRequisites = useMemo(
    () => groupBankRequisitesByCurrency(requisites, currencyOptions),
    [currencyOptions, requisites],
  );

  const selectedRequisite =
    editorState.kind === "existing"
      ? (requisites.find((requisite) => requisite.id === editorState.requisiteId) ??
        null)
      : null;

  const syncEditorState = useCallback(
    (requestedRequisiteId: string | null) => {
      const nextState =
        requestedRequisiteId === "new"
          ? ({ kind: "create" } as const)
          : (() => {
              const nextId = resolveInitialBankRequisiteId(
                requisites,
                requestedRequisiteId,
              );

              if (!nextId) {
                return { kind: "idle" } as const;
              }

              return {
                kind: "existing",
                requisiteId: nextId,
              } as const;
            })();

      setEditorState((current) =>
        isSameEditorState(current, nextState) ? current : nextState,
      );
    },
    [requisites],
  );

  useEffect(() => {
    if (editorDirty && initialSelectedRequisiteId !== null) {
      return;
    }

    syncEditorState(initialSelectedRequisiteId);
  }, [editorDirty, initialSelectedRequisiteId, syncEditorState]);

  useEffect(() => {
    if (editorDirty) {
      return;
    }

    if (
      editorState.kind === "existing" &&
      initialSelectedRequisiteId !== editorState.requisiteId
    ) {
      onSelectedRequisiteChange(editorState.requisiteId);
      return;
    }

    if (editorState.kind === "idle" && initialSelectedRequisiteId) {
      onSelectedRequisiteChange(null);
    }
  }, [editorDirty, editorState, initialSelectedRequisiteId, onSelectedRequisiteChange]);

  function requestEditorState(nextState: EditorState) {
    if (editorDirty) {
      const confirmed = window.confirm(
        "Есть несохранённые изменения в реквизите. Переключиться без сохранения?",
      );
      if (!confirmed) {
        return;
      }
    }

    setMutationError(null);
    setEditorDirty(false);
    setEditorState(nextState);
    onSelectedRequisiteChange(
      nextState.kind === "existing"
        ? nextState.requisiteId
        : nextState.kind === "create"
          ? "new"
          : null,
    );
  }

  async function loadProviderBranches(providerId: string) {
    const response = await apiClient.v1.requisites.providers[":id"].$get({
      param: { id: providerId },
    });

    if (!response.ok) {
      return [];
    }

    const provider = RequisiteProviderSchema.omit({
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
    })
      .extend({
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        archivedAt: z.iso.datetime().nullable(),
      })
      .parse(await response.json());

    return provider.branches.map((branch) => ({
      id: branch.id,
      label: branch.name,
    }));
  }

  async function handleSubmit(values: RequisiteFormValues) {
    setMutationError(null);

    const result = await executeApiMutation<OrganizationBankRequisite>({
      request: () =>
        editorState.kind === "existing"
          ? apiClient.v1.requisites[":id"].$patch({
              param: { id: editorState.requisiteId },
              json: createOrganizationBankRequisitePatch(values),
            })
          : apiClient.v1.organizations[":id"].requisites.$post({
              param: { id: organizationId },
              json: createOrganizationBankRequisitePayload({
                organizationId,
                values,
              }),
            }),
      fallbackMessage: "Не удалось сохранить реквизит",
      parseData: async (response) =>
        readJsonWithSchema(response, OrganizationBankRequisiteSchema),
    });

    if (!result.ok) {
      setMutationError(result.message);
      return;
    }

    const nextRequisites = await refresh();
    const nextId =
      resolveInitialBankRequisiteId(nextRequisites, result.data.id) ??
      result.data.id;

    setEditorDirty(false);
    setEditorState({ kind: "existing", requisiteId: nextId });
    onSelectedRequisiteChange(nextId);

    return {
      ...values,
      ownerId: organizationId,
    };
  }

  async function handleDelete() {
    if (editorState.kind !== "existing") {
      return false;
    }

    setMutationError(null);

    const result = await executeApiMutation({
      request: () =>
        apiClient.v1.requisites[":id"].$delete({
          param: { id: editorState.requisiteId },
        }),
      fallbackMessage: "Не удалось архивировать реквизит",
      parseData: async () => ({ deleted: true }),
    });

    if (!result.ok) {
      setMutationError(result.message);
      return false;
    }

    const nextRequisites = await refresh();
    const nextId = resolveInitialBankRequisiteId(nextRequisites, null);
    setEditorDirty(false);
    setEditorState(
      nextId ? { kind: "existing", requisiteId: nextId } : { kind: "idle" },
    );
    onSelectedRequisiteChange(nextId);

    return true;
  }

  const effectiveError = mutationError ?? loadError;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" />
              Реквизиты
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Управление банковскими реквизитами организации.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => requestEditorState({ kind: "create" })}
          >
            <Plus className="size-4" />
            Добавить реквизит
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {effectiveError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{effectiveError}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : requisites.length === 0 && editorState.kind !== "create" ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            У организации пока нет банковских реквизитов.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-4">
              {groupedRequisites.map((group) => (
                <div key={group.currency.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{group.currency.code}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {group.currency.name}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.requisites.map((requisite) => {
                      const isActive =
                        editorState.kind === "existing" &&
                        editorState.requisiteId === requisite.id;

                      return (
                        <button
                          key={requisite.id}
                          type="button"
                          className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                            isActive
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/40"
                          }`}
                          onClick={() =>
                            requestEditorState({
                              kind: "existing",
                              requisiteId: requisite.id,
                            })
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-medium">
                                {requisite.label}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {getBankProviderLabel(requisite, providerOptions)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatBankRequisiteIdentity(requisite)}
                              </p>
                            </div>
                            {requisite.isDefault ? <Badge>Основной</Badge> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {editorState.kind === "idle" ? null : (
              <div className="space-y-3">
                {selectedRequisite && editorState.kind === "existing" ? (
                  <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    {getBankProviderLabel(selectedRequisite, providerOptions)} ·{" "}
                    {getCurrencyLabel(selectedRequisite.currencyId, currencyOptions)}
                  </div>
                ) : null}
                <RequisiteEditor
                  ownerType="organization"
                  ownerLabel="Организация"
                  ownerDescription="Реквизит принадлежит выбранной организации."
                  ownerOptions={toRelationOptions([
                    {
                      id: organizationId,
                      label: organizationName,
                    },
                  ])}
                  ownerTypeReadonly
                  ownerReadonly
                  providerOptions={toRelationOptions(providerOptions)}
                  loadProviderBranches={loadProviderBranches}
                  currencyOptions={toRelationOptions(currencyOptions)}
                  initialValues={{
                    ownerId: organizationId,
                    ...bankRequisiteToFormValues(
                      selectedRequisite,
                      organizationName,
                    ),
                  }}
                  createdAt={selectedRequisite?.createdAt ?? null}
                  updatedAt={selectedRequisite?.updatedAt ?? null}
                  error={effectiveError}
                  onDirtyChange={setEditorDirty}
                  onSubmit={handleSubmit}
                  onDelete={editorState.kind === "existing" ? handleDelete : undefined}
                  submitLabel={
                    editorState.kind === "create"
                      ? "Создать реквизит"
                      : "Сохранить реквизит"
                  }
                  submittingLabel="Сохранение..."
                  showDelete={editorState.kind === "existing"}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
