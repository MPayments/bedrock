"use client";

import { useEffect, useMemo, useState } from "react";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import {
  OrganizationGeneralEditor,
  type OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import { type LocalizedTextVariant } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";

import {
  OrganizationWorkspaceSchema,
  type OrganizationWorkspaceRecord,
} from "../_lib/organization-workspace-api";

type OrganizationCanonicalEditorProps = {
  localizedTextVariant: LocalizedTextVariant;
  onDirtyChange: (dirty: boolean) => void;
  onSaved?: () => void;
  organizationId: string;
};

function toGeneralFormValues(
  organization: OrganizationWorkspaceRecord,
): OrganizationGeneralFormValues {
  return {
    shortName: organization.shortName,
    fullName: organization.fullName,
    kind: organization.kind,
    country: organization.country ?? "",
    externalRef: organization.externalRef ?? "",
    description: organization.description ?? "",
  };
}

export function OrganizationCanonicalEditor({
  localizedTextVariant,
  onDirtyChange,
  onSaved,
  organizationId,
}: OrganizationCanonicalEditorProps) {
  const [organization, setOrganization] =
    useState<OrganizationWorkspaceRecord | null>(null);
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

    async function loadOrganization() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.v1.organizations[":id"].$get({
          param: { id: organizationId },
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить организацию");
        }

        const payload = await readJsonWithSchema(
          response,
          OrganizationWorkspaceSchema,
        );

        if (!cancelled) {
          setOrganization(payload);
          setGeneralDirty(false);
          setLegalDirty(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить организацию",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const partyProfileSeed = useMemo(
    () =>
      organization
        ? {
            fullName: organization.fullName,
            shortName: organization.shortName,
            countryCode: organization.country,
          }
        : undefined,
    [organization],
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Загрузка организации...
        </CardContent>
      </Card>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Не удалось загрузить организацию.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <OrganizationGeneralEditor
        initialValues={toGeneralFormValues(organization)}
        createdAt={organization.createdAt}
        updatedAt={organization.updatedAt}
        submitting={savingGeneral}
        error={error}
        onDirtyChange={setGeneralDirty}
        kindReadonly
        onSubmit={async (values) => {
          if (values.kind !== organization.kind) {
            setError("Смена типа организации в CRM не поддерживается");
            return;
          }

          setError(null);
          setSavingGeneral(true);

          const result = await executeApiMutation<OrganizationWorkspaceRecord>({
            request: async () => {
              const patchResponse = await apiClient.v1.organizations[":id"].$patch({
                param: { id: organizationId },
                json: {
                  shortName: values.shortName.trim(),
                  fullName: values.fullName.trim(),
                  country: values.country.trim() || null,
                  description: values.description.trim() || null,
                  externalRef: values.externalRef.trim() || null,
                },
              });

              if (!patchResponse.ok) {
                return patchResponse;
              }

              if (organization.kind === "legal_entity") {
                const bundle =
                  organization.partyProfile
                    ? {
                        ...organization.partyProfile,
                        profile: {
                          ...organization.partyProfile.profile,
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

                const legalResponse =
                  await apiClient.v1.organizations[":id"]["party-profile"].$put({
                    param: { id: organizationId },
                    json: bundle,
                  });

                if (!legalResponse.ok) {
                  return legalResponse;
                }
              }

              return apiClient.v1.organizations[":id"].$get({
                param: { id: organizationId },
              });
            },
            fallbackMessage: "Не удалось сохранить организацию",
            parseData: async (response) =>
              readJsonWithSchema(response, OrganizationWorkspaceSchema),
          });

          setSavingGeneral(false);

          if (!result.ok) {
            setError(result.message);
            return;
          }

          setOrganization(result.data);
          setGeneralDirty(false);
          onSaved?.();
          return toGeneralFormValues(result.data);
        }}
        submitLabel="Сохранить"
        submittingLabel="Сохранение..."
        title="Организация"
        description="Общие и юридические данные организации."
      />
      {organization.kind === "legal_entity" ? (
        <PartyProfileEditor
          bundle={organization.partyProfile}
          seed={partyProfileSeed}
          localizedTextVariant={localizedTextVariant}
          submitting={savingLegal}
          error={error}
          onDirtyChange={setLegalDirty}
          showLocalizedTextModeSwitcher={false}
          onSubmit={async (bundle: PartyProfileBundleInput) => {
            setError(null);
            setSavingLegal(true);

            const result = await executeApiMutation<OrganizationWorkspaceRecord>({
              request: async () => {
                const response =
                  await apiClient.v1.organizations[":id"]["party-profile"].$put({
                    param: { id: organizationId },
                    json: bundle,
                  });

                if (!response.ok) {
                  return response;
                }

                return apiClient.v1.organizations[":id"].$get({
                  param: { id: organizationId },
                });
              },
              fallbackMessage: "Не удалось сохранить юридические данные",
              parseData: async (response) =>
                readJsonWithSchema(response, OrganizationWorkspaceSchema),
            });

            setSavingLegal(false);

            if (!result.ok) {
              setError(result.message);
              return;
            }

            setOrganization(result.data);
            setLegalDirty(false);
            onSaved?.();

            return result.data.partyProfile ?? bundle;
          }}
          title="Юридическое лицо"
        />
      ) : null}
    </div>
  );
}
