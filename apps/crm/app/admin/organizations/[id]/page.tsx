"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LOCALIZED_TEXT_VARIANTS,
  type LocalizedTextVariant,
} from "@bedrock/sdk-parties-ui/lib/localized-text";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
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
  const [localizedTextVariant, setLocalizedTextVariant] =
    useState<LocalizedTextVariant>("ru");

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

  const localizedTextControl =
    activeTab === "organization" && organization.kind === "legal_entity" ? (
      <div className="w-full space-y-1 sm:w-[180px]">
        <Select
          value={localizedTextVariant}
          onValueChange={(value) =>
            setLocalizedTextVariant((value as LocalizedTextVariant) ?? "base")
          }
        >
          <SelectTrigger className="w-full bg-card">
            <SelectValue>
              {
                LOCALIZED_TEXT_VARIANTS.find(
                  (option) => option.value === localizedTextVariant,
                )?.label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LOCALIZED_TEXT_VARIANTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{organizationTitle}</h1>
          <Badge variant={organization.isActive ? "default" : "secondary"}>
            {organization.isActive ? "Активна" : "Архивирована"}
          </Badge>
        </div>
      </div>

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
        controls={localizedTextControl}
        onTabChange={handleTabChange}
      />

      <div
        hidden={activeTab !== "organization"}
        aria-hidden={activeTab !== "organization"}
      >
        <OrganizationCanonicalEditor
          localizedTextVariant={localizedTextVariant}
          organizationId={organizationId}
          onDirtyChange={setOrganizationDirty}
          onSaved={handleWorkspaceSaved}
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
