"use client";

import { useEffect, useMemo, useState } from "react";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import {
  OrganizationGeneralEditor,
  type OrganizationGeneralBilingualMode,
  type OrganizationGeneralEditorExternalPatch,
  type OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
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
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { apiClient } from "@/lib/api-client";
import { executeApiMutation } from "@/lib/api/mutation";
import { readJsonWithSchema } from "@/lib/api/response";
import {
  applyPartyProfilePatch,
  type PartyProfileOverride,
} from "@/lib/party-profile-patch";

import {
  OrganizationWorkspaceSchema,
  type OrganizationWorkspaceRecord,
} from "../_lib/organization-workspace-api";

type OrganizationCanonicalEditorProps = {
  bilingualMode?: OrganizationGeneralBilingualMode;
  externalPatch?: OrganizationGeneralEditorExternalPatch | null;
  localizedTextVariant: LocalizedTextVariant;
  onDirtyChange: (dirty: boolean) => void;
  onGeneralValuesChange?: (values: OrganizationGeneralFormValues) => void;
  onPartyProfileChange?: (draft: PartyProfileBundleInput | null) => void;
  onSaved?: () => void;
  organizationId: string;
  partyProfileOverride?: PartyProfileOverride | null;
};

function toGeneralFormValues(
  organization: OrganizationWorkspaceRecord,
): OrganizationGeneralFormValues {
  const fullNameI18n = organization.partyProfile?.profile.fullNameI18n ?? null;
  const shortNameI18n = organization.partyProfile?.profile.shortNameI18n ?? null;
  return {
    shortName: organization.shortName,
    shortNameEn: readLocalizedTextLocale({
      localeMap: shortNameI18n,
      locale: "en",
    }),
    fullName: organization.fullName,
    fullNameEn: readLocalizedTextLocale({
      localeMap: fullNameI18n,
      locale: "en",
    }),
    kind: organization.kind,
    country: organization.country ?? "",
    externalRef: organization.externalRef ?? "",
    description: organization.description ?? "",
  };
}

export function OrganizationCanonicalEditor({
  bilingualMode,
  externalPatch,
  localizedTextVariant,
  onDirtyChange,
  onGeneralValuesChange,
  onPartyProfileChange,
  onSaved,
  organizationId,
  partyProfileOverride,
}: OrganizationCanonicalEditorProps) {
  const [organization, setOrganization] =
    useState<OrganizationWorkspaceRecord | null>(null);
  const [overriddenPartyProfile, setOverriddenPartyProfile] =
    useState<PartyProfileBundleInput | null>(null);
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
          setOverriddenPartyProfile(null);
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

  const partyProfileOverrideNonce = partyProfileOverride?.nonce ?? null;
  useEffect(() => {
    if (!partyProfileOverride || !organization) {
      return;
    }

    const base =
      overriddenPartyProfile ??
      (organization.partyProfile
        ? toPartyProfileBundleInput(organization.partyProfile, partyProfileSeed)
        : createSeededPartyProfileBundle({
            fullName: organization.fullName,
            shortName: organization.shortName,
            countryCode: organization.country,
          }));

    const next = applyPartyProfilePatch(base, partyProfileOverride.patch);
    setOverriddenPartyProfile(next);
    onPartyProfileChange?.(next);
    setLegalDirty(true);
    // Triggered by nonce change; dependencies intentionally narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyProfileOverrideNonce]);

  const effectiveBundle:
    | PartyProfileBundleSource
    | PartyProfileBundleInput
    | null =
    overriddenPartyProfile ?? organization?.partyProfile ?? null;

  const initialValues = useMemo(
    () => (organization ? toGeneralFormValues(organization) : undefined),
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
        initialValues={initialValues}
        createdAt={organization.createdAt}
        updatedAt={organization.updatedAt}
        submitting={savingGeneral}
        error={error}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        onDirtyChange={setGeneralDirty}
        onValuesChange={onGeneralValuesChange}
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
              const patchResponse = await apiClient.v1.organizations[
                ":id"
              ].$patch({
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
                const existingBundle = overriddenPartyProfile
                  ? overriddenPartyProfile
                  : organization.partyProfile
                    ? toPartyProfileBundleInput(
                        organization.partyProfile,
                        partyProfileSeed,
                      )
                    : createSeededPartyProfileBundle({
                        fullName: values.fullName.trim(),
                        shortName: values.shortName.trim(),
                        countryCode: values.country.trim() || null,
                      });

                const nextFullNameI18n = updateLocalizedTextLocale({
                  baseValue: values.fullName.trim(),
                  localeMap: existingBundle.profile.fullNameI18n,
                  nextValue: values.fullNameEn.trim(),
                  locale: "en",
                }).localeMap;
                const nextShortNameI18n = updateLocalizedTextLocale({
                  baseValue: values.shortName.trim(),
                  localeMap: existingBundle.profile.shortNameI18n,
                  nextValue: values.shortNameEn.trim(),
                  locale: "en",
                }).localeMap;

                const bundle: PartyProfileBundleInput = {
                  ...existingBundle,
                  profile: {
                    ...existingBundle.profile,
                    fullName: values.fullName.trim(),
                    shortName: values.shortName.trim(),
                    fullNameI18n: nextFullNameI18n,
                    shortNameI18n: nextShortNameI18n,
                    countryCode: values.country.trim() || null,
                  },
                };

                const legalResponse = await apiClient.v1.organizations[":id"][
                  "party-profile"
                ].$put({
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
          setOverriddenPartyProfile(null);
          setGeneralDirty(false);
          setLegalDirty(false);
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
          bundle={effectiveBundle}
          seed={partyProfileSeed}
          localizedTextVariant={localizedTextVariant}
          submitting={savingLegal}
          error={error}
          onDirtyChange={setLegalDirty}
          onChange={(bundle) => {
            setOverriddenPartyProfile(bundle);
            onPartyProfileChange?.(bundle);
          }}
          showLocalizedTextModeSwitcher={false}
          onSubmit={async (bundle: PartyProfileBundleInput) => {
            setError(null);
            setSavingLegal(true);

            const result = await executeApiMutation<OrganizationWorkspaceRecord>(
              {
                request: async () => {
                  const response = await apiClient.v1.organizations[":id"][
                    "party-profile"
                  ].$put({
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
                fallbackMessage:
                  "Не удалось сохранить юридические данные",
                parseData: async (response) =>
                  readJsonWithSchema(response, OrganizationWorkspaceSchema),
              },
            );

            setSavingLegal(false);

            if (!result.ok) {
              setError(result.message);
              return;
            }

            setOrganization(result.data);
            setOverriddenPartyProfile(null);
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
