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
import { updateLocalizedTextLocale } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { computePartyProfileCompleteness } from "@bedrock/sdk-parties-ui/lib/party-profile-completeness";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import {
  applyPartyProfilePatch,
  type PartyProfileOverride,
} from "@/lib/party-profile-patch";
import { executeMutation } from "@/lib/resources/http";
import { translateOrganizationToEnglish } from "@/lib/translate-organization";

import { useOrganizationDraftName } from "../lib/create-draft-name-context";
import {
  OrganizationInputMethodCard,
  type OrganizationInputMethod,
  type OrganizationPrefillPatch,
} from "./organization-input-method-card";

type CreatedOrganization = {
  id: string;
};

type CreateOrganizationFormClientProps = {
  detailsBasePath?: string;
};

const EMPTY_ORGANIZATION_VALUES: OrganizationGeneralFormValues = {
  shortName: "",
  shortNameEn: "",
  fullName: "",
  fullNameEn: "",
  kind: "legal_entity",
  country: "",
  externalRef: "",
  description: "",
};

export function CreateOrganizationFormClient({
  detailsBasePath = "/treasury/organizations",
}: CreateOrganizationFormClientProps) {
  const router = useRouter();
  const { actions } = useOrganizationDraftName();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<OrganizationGeneralFormValues>(
    EMPTY_ORGANIZATION_VALUES,
  );
  const [partyProfileDraft, setPartyProfileDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [bilingualMode, setBilingualMode] = useState<BilingualMode>("all");
  const [inputMethod, setInputMethod] =
    useState<OrganizationInputMethod>("manual");
  const [externalPatch, setExternalPatch] =
    useState<OrganizationGeneralEditorExternalPatch | null>(null);
  const [partyProfileOverride, setPartyProfileOverride] =
    useState<PartyProfileOverride | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    if (draftValues.kind === "individual" && inputMethod !== "manual") {
      setInputMethod("manual");
    }
  }, [draftValues.kind, inputMethod]);

  const partyProfileSeed = useMemo(
    () => ({
      fullName: draftValues.fullName || EMPTY_ORGANIZATION_VALUES.fullName,
      shortName: draftValues.shortName || EMPTY_ORGANIZATION_VALUES.shortName,
      countryCode: draftValues.country || EMPTY_ORGANIZATION_VALUES.country,
    }),
    [draftValues.country, draftValues.fullName, draftValues.shortName],
  );

  const completeness = useMemo(
    () =>
      computePartyProfileCompleteness(partyProfileDraft, {
        excludeProfileNames: true,
        extraPairs: [
          { ru: draftValues.shortName, en: draftValues.shortNameEn },
          { ru: draftValues.fullName, en: draftValues.fullNameEn },
        ],
      }).ratio,
    [partyProfileDraft, draftValues],
  );

  const partyProfileOverrideNonce = partyProfileOverride?.nonce ?? null;
  useEffect(() => {
    if (!partyProfileOverride) {
      return;
    }

    const base =
      partyProfileDraft ??
      createSeededPartyProfileBundle({
        fullName: draftValues.fullName,
        shortName: draftValues.shortName,
        countryCode: draftValues.country || null,
      });

    const next = applyPartyProfilePatch(base, partyProfileOverride.patch);
    setPartyProfileDraft(next);
    // Triggered by nonce change; dependencies intentionally narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyProfileOverrideNonce]);

  const handlePrefill = useCallback((patch: OrganizationPrefillPatch) => {
    const now = Date.now();
    setExternalPatch({ nonce: now, patch: patch.general });
    setPartyProfileOverride({ nonce: now, patch: patch.profile });
  }, []);

  const handleTranslateAll = useCallback(async () => {
    setTranslating(true);
    setTranslateError(null);
    try {
      const next = await translateOrganizationToEnglish({
        bundle: partyProfileDraft,
        general: {
          shortName: draftValues.shortName,
          shortNameEn: draftValues.shortNameEn,
          fullName: draftValues.fullName,
          fullNameEn: draftValues.fullNameEn,
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
  }, [partyProfileDraft, draftValues]);

  function resolveCreatePartyProfileBundle(
    values: OrganizationGeneralFormValues,
    bundle: PartyProfileBundleInput | null,
  ) {
    const fallbackCountryCode = values.country.trim() || null;

    const base = bundle
      ? bundle
      : createSeededPartyProfileBundle({
          fullName: values.fullName,
          shortName: values.shortName,
          countryCode: values.country || null,
        });

    const nextFullNameI18n = updateLocalizedTextLocale({
      baseValue: values.fullName.trim(),
      localeMap: base.profile.fullNameI18n,
      nextValue: values.fullNameEn.trim(),
      locale: "en",
    }).localeMap;
    const nextShortNameI18n = updateLocalizedTextLocale({
      baseValue: values.shortName.trim(),
      localeMap: base.profile.shortNameI18n,
      nextValue: values.shortNameEn.trim(),
      locale: "en",
    }).localeMap;

    return {
      ...base,
      profile: {
        ...base.profile,
        fullName: base.profile.fullName.trim() || values.fullName.trim(),
        shortName: base.profile.shortName.trim() || values.shortName.trim(),
        fullNameI18n: nextFullNameI18n,
        shortNameI18n: nextShortNameI18n,
        countryCode: base.profile.countryCode ?? fallbackCountryCode,
      },
    };
  }

  async function handleSubmit(values: OrganizationGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<CreatedOrganization>({
      request: () =>
        apiClient.v1.organizations.$post({
          json: {
            shortName: values.shortName,
            fullName: values.fullName,
            kind: values.kind,
            country: values.country || undefined,
            externalRef: values.externalRef || undefined,
            description: values.description || undefined,
            partyProfile:
              values.kind === "legal_entity"
                ? resolveCreatePartyProfileBundle(values, partyProfileDraft)
                : undefined,
          },
        }),
      fallbackMessage: "Не удалось создать организацию",
      parseData: async (response) =>
        (await response.json()) as CreatedOrganization,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Организация создана");
    router.push(`${detailsBasePath.replace(/\/+$/, "")}/${result.data.id}`);
  }

  return (
    <div className="space-y-6">
      <OrganizationInputMethodCard
        organizationKind={draftValues.kind}
        mode={inputMethod}
        onModeChange={setInputMethod}
        onPrefill={handlePrefill}
      />

      <BilingualToolbar
        value={bilingualMode}
        onChange={setBilingualMode}
        completeness={completeness}
        onTranslateAll={handleTranslateAll}
        translating={translating}
      />

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
        initialValues={EMPTY_ORGANIZATION_VALUES}
        submitting={submitting}
        error={error}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        onSubmit={handleSubmit}
        onShortNameChange={actions.setCreateName}
        onValuesChange={setDraftValues}
        submitLabel="Создать"
        submittingLabel="Создание..."
        disableSubmitUntilDirty={false}
        showDates={false}
      />
      {draftValues.kind === "legal_entity" ? (
        <PartyProfileEditor
          bundle={partyProfileDraft}
          seed={partyProfileSeed}
          localizedTextVariant={bilingualMode}
          submitting={submitting}
          error={error}
          title="Мастер-данные организации"
          showActions={false}
          showLocalizedTextModeSwitcher={false}
          onChange={(bundle) => {
            setPartyProfileDraft(bundle);
          }}
        />
      ) : null}
    </div>
  );
}
