"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import {
  BilingualToolbar,
  type BilingualMode,
} from "@bedrock/sdk-parties-ui/components/bilingual-toolbar";
import {
  OrganizationGeneralEditor,
  type OrganizationGeneralEditorExternalPatch,
  type OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import { readLocalizedTextLocale } from "@bedrock/sdk-parties-ui/lib/localized-text";
import {
  createSeededPartyProfileBundle,
  toPartyProfileBundleInput,
} from "@bedrock/sdk-parties-ui/lib/party-profile";
import type { PartyProfileBundleSource } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { computePartyProfileCompleteness } from "@bedrock/sdk-parties-ui/lib/party-profile-completeness";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";
import { apiClient } from "@/lib/api-client";
import {
  applyPartyProfilePatch,
  type PartyProfileOverride,
} from "@/lib/party-profile-patch";
import { executeMutation } from "@/lib/resources/http";
import { translateOrganizationToEnglish } from "@/lib/translate-organization";

import { useOrganizationDraftName } from "../lib/create-draft-name-context";
import type { SerializedOrganization } from "../lib/types";

type EditOrganizationFormClientProps = {
  organization: SerializedOrganization;
  listPath?: string;
};

function toFormValues(
  organization: SerializedOrganization,
): OrganizationGeneralFormValues {
  const bundle = organization.partyProfile as PartyProfileBundleSource | null;
  const fullNameI18n = bundle?.profile.fullNameI18n ?? null;
  const shortNameI18n = bundle?.profile.shortNameI18n ?? null;
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

export function EditOrganizationFormClient({
  organization,
  listPath = "/treasury/organizations",
}: EditOrganizationFormClientProps) {
  const router = useRouter();
  const { actions } = useOrganizationDraftName();
  const [current, setCurrent] = useState(organization);
  const [initialValues, setInitialValues] = useState(() =>
    toFormValues(organization),
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingLegalEntity, setSavingLegalEntity] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bilingualMode, setBilingualMode] = useState<BilingualMode>("all");
  const [generalValues, setGeneralValues] =
    useState<OrganizationGeneralFormValues>(initialValues);
  const [externalPatch, setExternalPatch] =
    useState<OrganizationGeneralEditorExternalPatch | null>(null);
  const [overriddenBundle, setOverriddenBundle] =
    useState<PartyProfileBundleInput | null>(null);
  const [partyProfileOverride, setPartyProfileOverride] =
    useState<PartyProfileOverride | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

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

  const effectiveBundle:
    | PartyProfileBundleSource
    | PartyProfileBundleInput
    | null =
    overriddenBundle ??
    (current.partyProfile as PartyProfileBundleSource | null);

  const partyProfileDraft: PartyProfileBundleInput | null = useMemo(() => {
    if (overriddenBundle) {
      return overriddenBundle;
    }
    if (current.partyProfile) {
      return toPartyProfileBundleInput(
        current.partyProfile as PartyProfileBundleSource,
        partyProfileSeed,
      );
    }
    return null;
  }, [current.partyProfile, overriddenBundle, partyProfileSeed]);

  const completeness = useMemo(
    () =>
      computePartyProfileCompleteness(partyProfileDraft, {
        excludeProfileNames: true,
        extraPairs: [
          { ru: generalValues.shortName, en: generalValues.shortNameEn },
          { ru: generalValues.fullName, en: generalValues.fullNameEn },
        ],
      }).ratio,
    [generalValues, partyProfileDraft],
  );

  const partyProfileOverrideNonce = partyProfileOverride?.nonce ?? null;
  useEffect(() => {
    if (!partyProfileOverride) {
      return;
    }

    const base =
      overriddenBundle ??
      (current.partyProfile
        ? toPartyProfileBundleInput(
            current.partyProfile as PartyProfileBundleSource,
            partyProfileSeed,
          )
        : createSeededPartyProfileBundle({
            fullName: current.fullName,
            shortName: current.shortName,
            countryCode: current.country,
          }));

    const next = applyPartyProfilePatch(base, partyProfileOverride.patch);
    setOverriddenBundle(next);
    // Triggered by nonce change; dependencies intentionally narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyProfileOverrideNonce]);

  const handleTranslateAll = useCallback(async () => {
    setTranslating(true);
    setTranslateError(null);
    try {
      const next = await translateOrganizationToEnglish({
        bundle: partyProfileDraft,
        general: {
          shortName: generalValues.shortName,
          shortNameEn: generalValues.shortNameEn,
          fullName: generalValues.fullName,
          fullNameEn: generalValues.fullNameEn,
        },
      });
      const nonce = Date.now();
      if (next.profile) {
        setPartyProfileOverride({ nonce, patch: next.profile });
      }
      if (Object.keys(next.general).length > 0) {
        setExternalPatch({ nonce, patch: next.general });
      }
    } catch (translationError) {
      setTranslateError(
        translationError instanceof Error
          ? translationError.message
          : "Ошибка перевода полей",
      );
    } finally {
      setTranslating(false);
    }
  }, [generalValues, partyProfileDraft]);

  async function handleSubmit(
    values: OrganizationGeneralFormValues,
  ): Promise<OrganizationGeneralFormValues | void> {
    if (values.kind !== current.kind) {
      const message = "Смена типа организации в этой форме не поддерживается";
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await executeMutation<SerializedOrganization>({
      request: () =>
        apiClient.v1.organizations[":id"].$patch({
          param: { id: current.id },
          json: {
            externalRef: values.externalRef || null,
            description: values.description || null,
          },
        }),
      fallbackMessage: "Не удалось обновить организацию",
      parseData: async (response) =>
        (await response.json()) as SerializedOrganization,
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
    toast.success("Организация обновлена");
    router.refresh();

    return nextValues;
  }

  async function handleLegalEntitySubmit(bundle: PartyProfileBundleInput) {
    setError(null);
    setSavingLegalEntity(true);

    const result = await executeMutation<SerializedOrganization>({
      request: async () => {
        const response = await apiClient.v1.organizations[":id"][
          "party-profile"
        ].$put({
          param: { id: current.id },
          json: bundle,
        });

        if (!response.ok) {
          return response;
        }

        return apiClient.v1.organizations[":id"].$get({
          param: { id: current.id },
        });
      },
      fallbackMessage: "Не удалось обновить юридические данные организации",
      parseData: async (response) =>
        (await response.json()) as SerializedOrganization,
    });

    setSavingLegalEntity(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    setOverriddenBundle(null);
    setInitialValues(toFormValues(result.data));
    toast.success("Юридические данные организации обновлены");
    router.refresh();

    return (
      (result.data.partyProfile as PartyProfileBundleSource | null) ?? bundle
    );
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.organizations[":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить организацию",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Организация удалена");
    actions.clearEdit(current.id);
    router.push(listPath.replace(/\/+$/, ""));
    return true;
  }

  const showBilingualToolbar = current.kind === "legal_entity";

  return (
    <div className="space-y-6">
      {showBilingualToolbar ? (
        <BilingualToolbar
          value={bilingualMode}
          onChange={setBilingualMode}
          completeness={completeness}
          onTranslateAll={handleTranslateAll}
          translating={translating}
        />
      ) : null}

      {translateError ? (
        <Alert variant="destructive">
          <AlertDescription>{translateError}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <OrganizationGeneralEditor
        initialValues={initialValues}
        createdAt={current.createdAt}
        updatedAt={current.updatedAt}
        submitting={submitting}
        error={error}
        bilingualMode={bilingualMode}
        externalPatch={externalPatch}
        readOnlyNames
        onSubmit={handleSubmit}
        onShortNameChange={handleShortNameChange}
        onValuesChange={setGeneralValues}
        headerActions={
          <EntityDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            deleting={deleting}
            onDelete={handleDelete}
            disableDelete={submitting}
            title="Удалить организацию?"
            description="Организация будет удалена без возможности восстановления."
            trigger={
              <Button
                variant="destructive"
                type="button"
                disabled={submitting}
              />
            }
          />
        }
      />
      {current.kind === "legal_entity" ? (
        <PartyProfileEditor
          bundle={effectiveBundle}
          seed={partyProfileSeed}
          localizedTextVariant={bilingualMode}
          submitting={savingLegalEntity}
          error={error}
          onChange={(bundle) => {
            setOverriddenBundle(bundle);
          }}
          onSubmit={handleLegalEntitySubmit}
          showLocalizedTextModeSwitcher={false}
          title="Мастер-данные организации"
        />
      ) : null}
    </div>
  );
}
