"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import {
  BilingualToolbar,
  type BilingualMode,
} from "@bedrock/sdk-parties-ui/components/bilingual-toolbar";
import type {
  OrganizationGeneralEditorExternalPatch,
  OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import { computePartyProfileCompleteness } from "@bedrock/sdk-parties-ui/lib/party-profile-completeness";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";

import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import {
  EntityPageHeader,
  getEntityInitials,
} from "@/components/app/entity-page-header";
import type { PartyProfileOverride } from "@/lib/party-profile-patch";
import { translateOrganizationToEnglish } from "@/lib/translate-party-profile";

import { OrganizationBankRequisitesWorkspace } from "./_components/organization-bank-requisites-workspace";
import { OrganizationCanonicalEditor } from "./_components/organization-canonical-editor";
import { OrganizationFilesWorkspace } from "./_components/organization-files-workspace";
import { OrganizationSummaryCard } from "./_components/organization-summary-card";
import { OrganizationWorkspaceTabs } from "./_components/organization-workspace-tabs";
import {
  buildOrganizationWorkspaceHref,
  getOrganizationWorkspace,
  normalizeOrganizationWorkspaceTab,
  type OrganizationWorkspaceRecord,
} from "./_lib/organization-workspace-api";

export default function OrganizationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = params.id as string;
  const activeTab = normalizeOrganizationWorkspaceTab(searchParams.get("tab"));
  const selectedRequisiteId = searchParams.get("requisite");

  const [organization, setOrganization] =
    useState<OrganizationWorkspaceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationDirty, setOrganizationDirty] = useState(false);
  const [requisitesDirty, setRequisitesDirty] = useState(false);
  const [filesDirty, setFilesDirty] = useState(false);
  const [bilingualMode, setBilingualMode] = useState<BilingualMode>("all");
  const [externalPatch, setExternalPatch] =
    useState<OrganizationGeneralEditorExternalPatch | null>(null);
  const [partyProfileOverride, setPartyProfileOverride] =
    useState<PartyProfileOverride | null>(null);
  const [partyProfileDraft, setPartyProfileDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [generalValues, setGeneralValues] =
    useState<OrganizationGeneralFormValues | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const hasUnsavedChanges = organizationDirty || requisitesDirty || filesDirty;

  const fetchWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await getOrganizationWorkspace(organizationId);
      setOrganization(payload);
      return payload;
    } catch (loadError) {
      console.error("Failed to fetch organization workspace", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить организацию",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  const organizationTitle = useMemo(() => {
    if (!organization) {
      return "Организация";
    }

    return organization.shortName || organization.fullName || "Организация";
  }, [organization]);

  const displayName = useMemo(() => {
    const shortEn = generalValues?.shortNameEn?.trim();
    const shortRu = generalValues?.shortName?.trim();
    return shortEn || shortRu || organizationTitle;
  }, [
    generalValues?.shortName,
    generalValues?.shortNameEn,
    organizationTitle,
  ]);

  const displaySecondaryName = useMemo(() => {
    const shortEn = generalValues?.shortNameEn?.trim();
    const shortRu = generalValues?.shortName?.trim();
    if (shortEn && shortRu && shortEn !== shortRu) {
      return shortRu;
    }
    return null;
  }, [generalValues?.shortName, generalValues?.shortNameEn]);

  const headerInn = useMemo(() => {
    return (
      partyProfileDraft?.identifiers?.find(
        (identifier) => identifier.scheme === "inn",
      )?.value ?? null
    );
  }, [partyProfileDraft]);

  useCrmBreadcrumbs(
    organization
      ? [
          {
            href: `/admin/organizations/${organizationId}`,
            label: organizationTitle,
          },
        ]
      : [],
  );

  const completeness = useMemo(
    () =>
      computePartyProfileCompleteness(partyProfileDraft, {
        excludeProfileNames: true,
        extraPairs: [
          {
            ru: generalValues?.shortName ?? "",
            en: generalValues?.shortNameEn ?? "",
          },
          {
            ru: generalValues?.fullName ?? "",
            en: generalValues?.fullNameEn ?? "",
          },
        ],
      }).ratio,
    [partyProfileDraft, generalValues],
  );

  const handleTranslateAll = useCallback(async () => {
    if (!generalValues && !partyProfileDraft) {
      return;
    }

    setTranslating(true);
    setTranslateError(null);
    try {
      const next = await translateOrganizationToEnglish({
        bundle: partyProfileDraft,
        general: generalValues
          ? {
              shortName: generalValues.shortName,
              shortNameEn: generalValues.shortNameEn,
              fullName: generalValues.fullName,
              fullNameEn: generalValues.fullNameEn,
            }
          : null,
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
  }, [partyProfileDraft, generalValues]);

  function handleTabChange(nextTab: "organization" | "requisites" | "files") {
    router.replace(
      buildOrganizationWorkspaceHref({
        organizationId,
        requisiteId: nextTab === "requisites" ? selectedRequisiteId : null,
        tab: nextTab,
      }),
    );
  }

  function handleSelectedRequisiteChange(requisiteId: string | null) {
    if (activeTab !== "requisites") {
      return;
    }

    if ((requisiteId ?? null) === (selectedRequisiteId ?? null)) {
      return;
    }

    router.replace(
      buildOrganizationWorkspaceHref({
        organizationId,
        requisiteId,
        tab: "requisites",
      }),
    );
  }

  function handleWorkspaceSaved() {
    setOrganizationDirty(false);
    void fetchWorkspace();
  }

  function handleFilesSaved() {
    setFilesDirty(false);
    void fetchWorkspace();
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Загрузка организации...
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {error ?? "Не удалось загрузить организацию"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const showBilingualToolbar =
    activeTab === "organization" && organization.kind === "legal_entity";

  const kindLabel =
    organization.kind === "legal_entity" ? "Юр. лицо" : "Физ. лицо";
  const countryLabel = (generalValues?.country ?? organization.country) || "—";

  return (
    <div className="space-y-4">
      <EntityPageHeader
        avatar={{ initials: getEntityInitials(displayName) }}
        title={displayName}
        titleSecondary={displaySecondaryName ?? undefined}
        badge={{
          label: organization.isActive ? "Active" : "Archived",
          variant: organization.isActive ? "success" : "secondary",
        }}
        infoItems={[
          <span key="id" className="font-mono">
            ID {shortenUuid(organizationId)}
          </span>,
          kindLabel,
          countryLabel,
          organization.kind === "legal_entity" ? (
            <span key="inn" className="font-mono">
              ИНН {headerInn ?? "—"}
            </span>
          ) : null,
        ]}
      />

      {hasUnsavedChanges ? (
        <Alert variant="warning">
          <AlertDescription>
            Есть несохранённые изменения в текущем workspace организации.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <OrganizationSummaryCard organization={organization} />
      <OrganizationWorkspaceTabs
        activeTab={activeTab}
        counts={{
          files:
            Number(Boolean(organization.signatureUrl)) +
            Number(Boolean(organization.sealUrl)),
          requisites: organization.banksCount,
        }}
        onTabChange={handleTabChange}
      />

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

      <div
        hidden={activeTab !== "organization"}
        aria-hidden={activeTab !== "organization"}
      >
        <OrganizationCanonicalEditor
          bilingualMode={bilingualMode}
          externalPatch={externalPatch}
          localizedTextVariant={bilingualMode}
          organizationId={organizationId}
          onDirtyChange={setOrganizationDirty}
          onGeneralValuesChange={setGeneralValues}
          onPartyProfileChange={setPartyProfileDraft}
          onSaved={handleWorkspaceSaved}
          partyProfileOverride={partyProfileOverride}
        />
      </div>

      <div
        hidden={activeTab !== "requisites"}
        aria-hidden={activeTab !== "requisites"}
      >
        <OrganizationBankRequisitesWorkspace
          organizationId={organizationId}
          organizationName={organization.fullName || organization.shortName}
          initialSelectedRequisiteId={selectedRequisiteId}
          onDirtyChange={setRequisitesDirty}
          onSelectedRequisiteChange={handleSelectedRequisiteChange}
        />
      </div>

      <div hidden={activeTab !== "files"} aria-hidden={activeTab !== "files"}>
        <OrganizationFilesWorkspace
          organization={organization}
          onDirtyChange={setFilesDirty}
          onSaved={handleFilesSaved}
        />
      </div>
    </div>
  );
}

function shortenUuid(id: string) {
  if (id.length <= 10) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}
