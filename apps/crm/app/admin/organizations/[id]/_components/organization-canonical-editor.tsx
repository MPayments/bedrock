"use client";

import { Loader2, RotateCcw, Save } from "lucide-react";
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
import { Button } from "@bedrock/sdk-ui/components/button";

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
  const [generalDraft, setGeneralDraft] =
    useState<OrganizationGeneralFormValues | null>(null);
  const [legalDraft, setLegalDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [generalDirty, setGeneralDirty] = useState(false);
  const [legalDirty, setLegalDirty] = useState(false);
  const [resetRevision, setResetRevision] = useState(0);
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
          const nextGeneralValues = toGeneralFormValues(payload);
          const nextPartyProfile = payload.partyProfile
            ? toPartyProfileBundleInput(payload.partyProfile, {
                fullName: payload.fullName,
                shortName: payload.shortName,
                countryCode: payload.country,
              })
            : null;
          setOrganization(payload);
          setOverriddenPartyProfile(null);
          setGeneralDraft(nextGeneralValues);
          setLegalDraft(nextPartyProfile);
          onGeneralValuesChange?.(nextGeneralValues);
          onPartyProfileChange?.(nextPartyProfile);
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
  }, [onGeneralValuesChange, onPartyProfileChange, organizationId]);

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
    setLegalDraft(next);
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

  function resolveBasePartyProfileBundle(
    currentOrganization: OrganizationWorkspaceRecord,
  ): PartyProfileBundleInput | null {
    if (currentOrganization.partyProfile) {
      return toPartyProfileBundleInput(
        currentOrganization.partyProfile,
        partyProfileSeed,
      );
    }

    if (currentOrganization.kind !== "legal_entity") {
      return null;
    }

    return createSeededPartyProfileBundle({
      fullName: currentOrganization.fullName,
      shortName: currentOrganization.shortName,
      countryCode: currentOrganization.country,
    });
  }

  async function saveGeneral(values: OrganizationGeneralFormValues) {
    if (!organization) {
      return;
    }

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
          const existingBundle =
            legalDraft ??
            overriddenPartyProfile ??
            (organization.partyProfile
              ? toPartyProfileBundleInput(
                  organization.partyProfile,
                  partyProfileSeed,
                )
              : createSeededPartyProfileBundle({
                  fullName: values.fullName.trim(),
                  shortName: values.shortName.trim(),
                  countryCode: values.country.trim() || null,
                }));

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

    const nextGeneralValues = toGeneralFormValues(result.data);
    const nextPartyProfile = result.data.partyProfile
      ? toPartyProfileBundleInput(result.data.partyProfile, {
          fullName: result.data.fullName,
          shortName: result.data.shortName,
          countryCode: result.data.country,
        })
      : null;

    setOrganization(result.data);
    setOverriddenPartyProfile(null);
    setGeneralDraft(nextGeneralValues);
    setLegalDraft(nextPartyProfile);
    onGeneralValuesChange?.(nextGeneralValues);
    onPartyProfileChange?.(nextPartyProfile);
    setGeneralDirty(false);
    setLegalDirty(false);
    onSaved?.();
    return nextGeneralValues;
  }

  async function saveLegal(bundle: PartyProfileBundleInput) {
    if (!organization) {
      return;
    }

    setError(null);
    setSavingLegal(true);

    const result = await executeApiMutation<OrganizationWorkspaceRecord>({
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
      fallbackMessage: "Не удалось сохранить юридические данные",
      parseData: async (response) =>
        readJsonWithSchema(response, OrganizationWorkspaceSchema),
    });

    setSavingLegal(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const nextGeneralValues = toGeneralFormValues(result.data);
    const nextPartyProfile = result.data.partyProfile
      ? toPartyProfileBundleInput(result.data.partyProfile, {
          fullName: result.data.fullName,
          shortName: result.data.shortName,
          countryCode: result.data.country,
        })
      : bundle;

    setOrganization(result.data);
    setOverriddenPartyProfile(null);
    setGeneralDraft(nextGeneralValues);
    setLegalDraft(nextPartyProfile);
    onGeneralValuesChange?.(nextGeneralValues);
    onPartyProfileChange?.(nextPartyProfile);
    setLegalDirty(false);
    onSaved?.();

    return result.data.partyProfile ?? bundle;
  }

  async function handleSaveChanges() {
    if (savingGeneral || savingLegal) {
      return;
    }

    if (generalDirty) {
      if (!generalDraft) {
        return;
      }

      await saveGeneral(generalDraft);
      return;
    }

    if (legalDirty && organization) {
      const bundle =
        legalDraft ??
        overriddenPartyProfile ??
        resolveBasePartyProfileBundle(organization);
      if (bundle) {
        await saveLegal(bundle);
      }
    }
  }

  function handleResetChanges() {
    if (!organization || savingGeneral || savingLegal) {
      return;
    }

    const nextGeneralValues = toGeneralFormValues(organization);
    const nextPartyProfile = resolveBasePartyProfileBundle(organization);

    setError(null);
    setOverriddenPartyProfile(null);
    setGeneralDraft(nextGeneralValues);
    setLegalDraft(nextPartyProfile);
    onGeneralValuesChange?.(nextGeneralValues);
    onPartyProfileChange?.(nextPartyProfile);
    setGeneralDirty(false);
    setLegalDirty(false);
    setResetRevision((current) => current + 1);
  }

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
        key={`general-${organization.id}-${resetRevision}`}
        initialValues={initialValues}
        createdAt={organization.createdAt}
        updatedAt={organization.updatedAt}
        submitting={savingGeneral}
        error={error}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        onDirtyChange={setGeneralDirty}
        onValuesChange={(values) => {
          setGeneralDraft(values);
          onGeneralValuesChange?.(values);
        }}
        kindReadonly
        onSubmit={saveGeneral}
        showActions={false}
        submitLabel="Сохранить"
        submittingLabel="Сохранение..."
        title="Организация"
        description="Общие и юридические данные организации."
      />
      {organization.kind === "legal_entity" ? (
        <PartyProfileEditor
          key={`party-profile-${organization.id}-${resetRevision}`}
          bundle={effectiveBundle}
          seed={partyProfileSeed}
          localizedTextVariant={localizedTextVariant}
          submitting={savingLegal}
          error={error}
          onDirtyChange={setLegalDirty}
          onChange={(bundle, dirty) => {
            setLegalDraft(bundle);
            onPartyProfileChange?.(bundle);
            setLegalDirty(dirty);
          }}
          showActions={false}
          showLocalizedTextModeSwitcher={false}
          onSubmit={saveLegal}
          title="Юридическое лицо"
        />
      ) : null}
      {generalDirty || legalDirty ? (
        <div className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button
            disabled={savingGeneral || savingLegal}
            onClick={handleResetChanges}
            variant="outline"
            type="button"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Отменить изменения
          </Button>
          <Button
            disabled={savingGeneral || savingLegal}
            onClick={() => {
              void handleSaveChanges();
            }}
            type="button"
          >
            {savingGeneral || savingLegal ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {savingGeneral || savingLegal
              ? "Сохранение..."
              : "Сохранить изменения"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
