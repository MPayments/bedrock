"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  Building2,
  Download,
  File,
  FileImage,
  FileText,
  FileType,
  Handshake,
  Info,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload as UploadIcon,
  Wallet,
  X,
} from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { DataTable } from "@bedrock/sdk-tables-ui/components/data-table";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import { DataTableToolbar } from "@bedrock/sdk-tables-ui/components/data-table-toolbar";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@bedrock/sdk-ui/components/tabs";

import {
  NewContractDialog,
  type ContractDialogInitialValues,
} from "@/components/dashboard/NewContractDialog";
import { useCrmBreadcrumbs } from "@/components/app/breadcrumbs-provider";
import { WorkspaceTabLabel } from "@/components/app/workspace-tab-label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatAgreementFeeRuleLabel } from "@/lib/utils/agreement-fee-format";
import { formatDate } from "@/lib/utils/currency";
import { CounterpartyBankRequisitesWorkspace } from "./components/counterparty-bank-requisites-workspace";
import { CustomerDetailHeader } from "./components/customer-detail-header";
import { CustomerSummaryCard } from "./components/customer-summary-card";
import {
  formatBankRequisiteIdentity,
  getBankProviderLabel,
} from "./lib/counterparty-bank-requisites";
import {
  buildCustomerCounterpartyCreateHref,
  buildCustomerCounterpartyDetailsHref,
  buildCustomerTabHref,
  customerFormSchema,
  customerToFormValues,
  isPrimaryCounterparty,
  normalizeCustomerDetailTab,
  type ClientDocument,
  type CustomerCounterparty,
  type CustomerDetailTab,
  type CustomerFormData,
  type CustomerWorkspaceDetail,
} from "./lib/customer-detail";
import {
  archiveCustomer,
  deleteCustomerCounterpartyDocument,
  downloadCustomerCounterpartyContract,
  downloadCustomerCounterpartyDocument,
  getCustomerWorkspace,
  listCustomerAgreements,
  listCustomerCounterpartyDocuments,
  type CustomerAgreementDetail,
  updateCustomerWorkspace,
  uploadCustomerCounterpartyDocument,
} from "./lib/customer-workspace-api";
import {
  loadCounterpartyBankRequisitesReferenceData,
  listCounterpartyBankRequisites,
  type CounterpartyBankRequisitesReferenceData,
} from "./lib/use-counterparty-bank-requisites";

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function downloadResponseAsFile(
  response: Response,
  fallbackFileName: string,
) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;

  const contentDisposition = response.headers.get("Content-Disposition");
  const matchedFileName =
    contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackFileName;
  anchor.download = decodeURIComponent(matchedFileName);

  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const units = ["Bytes", "KB", "MB", "GB"];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, unitIndex)) * 100) / 100} ${
    units[unitIndex]
  }`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5" />;
  }

  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5" />;
  }

  if (mimeType.includes("word") || mimeType.includes("document")) {
    return <FileType className="h-5 w-5" />;
  }

  if (mimeType === "application/zip") {
    return <File className="h-5 w-5" />;
  }

  return <Paperclip className="h-5 w-5" />;
}

function getDefaultCounterparty(
  counterparties: CustomerCounterparty[],
  primaryCounterpartyId: string | null,
) {
  return (
    counterparties.find(
      (counterparty) => counterparty.counterpartyId === primaryCounterpartyId,
    ) ??
    counterparties[0] ??
    null
  );
}

function getCounterpartyLabel(counterparty: CustomerCounterparty) {
  return (
    normalizeOptionalText(counterparty.shortName) ??
    normalizeOptionalText(counterparty.orgName) ??
    normalizeOptionalText(counterparty.fullName) ??
    counterparty.counterpartyId
  );
}

function trimLeadingZeros(value: string) {
  const trimmed = value.replace(/^0+(?=\d)/, "");
  return trimmed.length > 0 ? trimmed : "0";
}

function normalizePositiveDecimalString(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(trimmed)) {
    return null;
  }

  const [wholeRaw = "0", fractionRaw = ""] = trimmed.split(".");
  const whole = trimLeadingZeros(wholeRaw);
  const fraction = fractionRaw.replace(/0+$/u, "");

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function shiftPositiveDecimalString(value: string, decimalPlaces: number) {
  const normalized = normalizePositiveDecimalString(value);
  if (!normalized) {
    return null;
  }

  const [wholeRaw = "0", fractionRaw = ""] = normalized.split(".");
  const digits = `${wholeRaw}${fractionRaw}`.replace(/^0+(?=\d)/u, "") || "0";
  const nextScale = fractionRaw.length - decimalPlaces;

  if (digits === "0") {
    return "0";
  }

  if (nextScale <= 0) {
    return normalizePositiveDecimalString(`${digits}${"0".repeat(-nextScale)}`);
  }

  if (nextScale >= digits.length) {
    return normalizePositiveDecimalString(
      `0.${"0".repeat(nextScale - digits.length)}${digits}`,
    );
  }

  const integerPart = digits.slice(0, digits.length - nextScale);
  const fractionPart = digits.slice(digits.length - nextScale);

  return normalizePositiveDecimalString(`${integerPart}.${fractionPart}`);
}

function formatDateShort(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getAgreementDialogInitialValues(
  agreement: CustomerAgreementDetail,
): ContractDialogInitialValues {
  const agentFeeRule = agreement.currentVersion.feeRules.find(
    (rule) => rule.kind === "agent_fee",
  );
  const fixedFeeRule = agreement.currentVersion.feeRules.find(
    (rule) => rule.kind === "fixed_fee",
  );

  return {
    agentFee: agentFeeRule
      ? (shiftPositiveDecimalString(agentFeeRule.value, -2) ?? "")
      : "",
    fixedFee: fixedFeeRule?.value ?? "",
    contractNumber: agreement.currentVersion.contractNumber ?? "",
    organizationId: agreement.organizationId,
    organizationRequisiteId: agreement.organizationRequisiteId,
  };
}

type RequisiteDialogState = {
  counterpartyId: string;
  counterpartyName: string;
  initialMode: "create" | "existing";
  initialRequisiteId: string | null;
  key: number;
} | null;

type ContractDialogState = {
  counterpartyId: string;
  initialValues: ContractDialogInitialValues | null;
} | null;

type RequisiteTableRow = {
  counterpartyId: string;
  counterpartyName: string;
  currencyCode: string;
  id: string;
  identity: string;
  isDefault: boolean;
  label: string;
  providerLabel: string;
  updatedAt: string;
};

export default function CustomerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const activeTab = normalizeCustomerDetailTab(searchParams.get("tab"));

  const [workspace, setWorkspace] = useState<CustomerWorkspaceDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyAlertDismissed, setEmptyAlertDismissed] = useState(false);
  const [agreementAlertDismissed, setAgreementAlertDismissed] = useState(false);

  const [requisiteDialogState, setRequisiteDialogState] =
    useState<RequisiteDialogState>(null);
  const [requisiteDialogDirty, setRequisiteDialogDirty] = useState(false);
  const [requisiteCloseDialogOpen, setRequisiteCloseDialogOpen] =
    useState(false);
  const [requisiteOwnerPickerOpen, setRequisiteOwnerPickerOpen] =
    useState(false);
  const [
    requisiteOwnerPickerCounterpartyId,
    setRequisiteOwnerPickerCounterpartyId,
  ] = useState("");

  const [requisiteReferenceData, setRequisiteReferenceData] =
    useState<CounterpartyBankRequisitesReferenceData | null>(null);
  const [requisiteRows, setRequisiteRows] = useState<RequisiteTableRow[]>([]);
  const [requisitesTableLoading, setRequisitesTableLoading] = useState(false);
  const [requisitesTableError, setRequisitesTableError] = useState<
    string | null
  >(null);
  const [requisitesReloadKey, setRequisitesReloadKey] = useState(0);

  const [documentsByCounterpartyId, setDocumentsByCounterpartyId] = useState<
    Record<string, ClientDocument[]>
  >({});
  const [documentErrorsByCounterpartyId, setDocumentErrorsByCounterpartyId] =
    useState<Record<string, string>>({});
  const [
    loadingDocumentsByCounterpartyId,
    setLoadingDocumentsByCounterpartyId,
  ] = useState<Record<string, boolean>>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTargetCounterpartyId, setUploadTargetCounterpartyId] = useState<
    string | null
  >(null);
  const [uploadDocumentFile, setUploadDocumentFile] = useState<File | null>(
    null,
  );
  const [uploadDocumentDescription, setUploadDocumentDescription] =
    useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentKey, setDeletingDocumentKey] = useState<string | null>(
    null,
  );
  const [
    downloadingContractCounterpartyId,
    setDownloadingContractCounterpartyId,
  ] = useState<string | null>(null);
  const [contractLang, setContractLang] = useState<"ru" | "en">("ru");

  const [agreements, setAgreements] = useState<CustomerAgreementDetail[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementsError, setAgreementsError] = useState<string | null>(null);

  useCrmBreadcrumbs(
    workspace
      ? [
          {
            href: `/customers/${customerId}`,
            label: workspace.name,
          },
        ]
      : [],
  );
  const [agreementsReloadKey, setAgreementsReloadKey] = useState(0);
  const [agreementPickerOpen, setAgreementPickerOpen] = useState(false);
  const [agreementPickerCounterpartyId, setAgreementPickerCounterpartyId] =
    useState("");
  const [contractDialogState, setContractDialogState] =
    useState<ContractDialogState>(null);

  const customerForm = useForm<CustomerFormData>({
    defaultValues: customerToFormValues(null),
    resolver: zodResolver(customerFormSchema) as never,
  });

  const customerDirty = customerForm.formState.isDirty;
  const hasCustomerAgreement = workspace?.hasActiveAgreement ?? false;
  const activeAgreement =
    agreements.find((agreement) => agreement.isActive) ?? null;
  const defaultCounterparty = useMemo(
    () =>
      workspace
        ? getDefaultCounterparty(
            workspace.counterparties,
            workspace.primaryCounterpartyId,
          )
        : null,
    [workspace],
  );
  const requisitesTabCount = requisiteRows.length;
  const documentsTabCount = useMemo(() => {
    if (!workspace) {
      return 0;
    }

    return workspace.counterparties.reduce(
      (total, counterparty) =>
        total +
        (documentsByCounterpartyId[counterparty.counterpartyId]?.length ?? 0),
      0,
    );
  }, [documentsByCounterpartyId, workspace]);
  const agreementsTabCount = agreements.length;
  const uploadTargetCounterparty =
    workspace?.counterparties.find(
      (counterparty) =>
        counterparty.counterpartyId === uploadTargetCounterpartyId,
    ) ?? null;
  const agreementPickerCounterparty =
    workspace?.counterparties.find(
      (counterparty) =>
        counterparty.counterpartyId === agreementPickerCounterpartyId,
    ) ?? null;
  const requisiteOwnerPickerCounterparty =
    workspace?.counterparties.find(
      (counterparty) =>
        counterparty.counterpartyId === requisiteOwnerPickerCounterpartyId,
    ) ?? null;
  const showMissingAgreementAlert =
    workspace !== null &&
    workspace.counterparties.length > 0 &&
    !hasCustomerAgreement &&
    !agreementAlertDismissed;
  const showMissingLegalEntitiesAlert =
    workspace !== null &&
    workspace.counterparties.length === 0 &&
    !emptyAlertDismissed;

  const switchToTab = useCallback(
    (tab: CustomerDetailTab) => {
      router.replace(
        buildCustomerTabHref({
          pathname,
          searchParams: new URLSearchParams(searchParams.toString()),
          tab,
        }),
      );
    },
    [pathname, router, searchParams],
  );

  const fetchWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomerWorkspace(customerId);
      setWorkspace(data);
      return data;
    } catch (fetchError) {
      console.error("Failed to fetch customer workspace", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить клиента",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const fetchDocumentsForCounterparty = useCallback(
    async (counterpartyId: string, force = false) => {
      if (!force && documentsByCounterpartyId[counterpartyId]) {
        return documentsByCounterpartyId[counterpartyId];
      }

      try {
        setLoadingDocumentsByCounterpartyId((current) => ({
          ...current,
          [counterpartyId]: true,
        }));

        const documents = await listCustomerCounterpartyDocuments(
          customerId,
          counterpartyId,
        );

        setDocumentsByCounterpartyId((current) => ({
          ...current,
          [counterpartyId]: documents,
        }));
        setDocumentErrorsByCounterpartyId((current) => {
          const next = { ...current };
          delete next[counterpartyId];
          return next;
        });

        return documents;
      } catch (fetchError) {
        console.error("Failed to fetch documents", fetchError);
        setDocumentErrorsByCounterpartyId((current) => ({
          ...current,
          [counterpartyId]:
            fetchError instanceof Error
              ? fetchError.message
              : "Не удалось загрузить документы",
        }));
        return [];
      } finally {
        setLoadingDocumentsByCounterpartyId((current) => ({
          ...current,
          [counterpartyId]: false,
        }));
      }
    },
    [customerId, documentsByCounterpartyId],
  );

  const loadAgreements = useCallback(async () => {
    try {
      setAgreementsLoading(true);
      setAgreementsError(null);
      setAgreements(await listCustomerAgreements(customerId));
    } catch (loadError) {
      console.error("Failed to load customer agreements", loadError);
      setAgreementsError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить договоры",
      );
    } finally {
      setAgreementsLoading(false);
    }
  }, [customerId]);

  const loadRequisitesTable = useCallback(async () => {
    if (!workspace) {
      return;
    }

    try {
      setRequisitesTableLoading(true);
      setRequisitesTableError(null);

      const referenceData =
        requisiteReferenceData ??
        (await loadCounterpartyBankRequisitesReferenceData());

      if (!requisiteReferenceData) {
        setRequisiteReferenceData(referenceData);
      }

      const rows = (
        await Promise.all(
          workspace.counterparties.map(async (counterparty) => {
            const requisites = await listCounterpartyBankRequisites(
              counterparty.counterpartyId,
            );

            return requisites.map((requisite) => ({
              counterpartyId: counterparty.counterpartyId,
              counterpartyName: counterparty.shortName,
              currencyCode:
                referenceData.currencyOptions.find(
                  (currency) => currency.id === requisite.currencyId,
                )?.code ?? "—",
              id: requisite.id,
              identity: formatBankRequisiteIdentity(requisite),
              isDefault: requisite.isDefault,
              label: requisite.label,
              providerLabel: getBankProviderLabel(
                requisite,
                referenceData.providerOptions,
              ),
              updatedAt: requisite.updatedAt,
            }));
          }),
        )
      )
        .flat()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

      setRequisiteRows(rows);
    } catch (loadError) {
      console.error("Failed to load requisites table", loadError);
      setRequisitesTableError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить реквизиты",
      );
    } finally {
      setRequisitesTableLoading(false);
    }
  }, [requisiteReferenceData, workspace]);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    if (!workspace || customerDirty) {
      return;
    }

    customerForm.reset(customerToFormValues(workspace));
  }, [customerDirty, customerForm, workspace]);

  useEffect(() => {
    if (!searchParams.get("entity")) {
      return;
    }

    switchToTab(activeTab);
  }, [activeTab, searchParams, switchToTab]);

  useEffect(() => {
    if (workspace?.counterparties.length) {
      setEmptyAlertDismissed(false);
    }

    const fallbackCounterpartyId = getDefaultCounterparty(
      workspace?.counterparties ?? [],
      workspace?.primaryCounterpartyId ?? null,
    )?.counterpartyId;

    setAgreementPickerCounterpartyId((current) => {
      if (
        current &&
        workspace?.counterparties.some(
          (counterparty) => counterparty.counterpartyId === current,
        )
      ) {
        return current;
      }

      return fallbackCounterpartyId ?? "";
    });
    setRequisiteOwnerPickerCounterpartyId((current) => {
      if (
        current &&
        workspace?.counterparties.some(
          (counterparty) => counterparty.counterpartyId === current,
        )
      ) {
        return current;
      }

      return fallbackCounterpartyId ?? "";
    });
  }, [workspace]);

  useEffect(() => {
    setAgreementAlertDismissed(false);
  }, [hasCustomerAgreement]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    void Promise.all(
      workspace.counterparties.map((counterparty) =>
        fetchDocumentsForCounterparty(counterparty.counterpartyId),
      ),
    );
  }, [fetchDocumentsForCounterparty, workspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    void loadAgreements();
  }, [agreementsReloadKey, loadAgreements, workspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    void loadRequisitesTable();
  }, [loadRequisitesTable, requisitesReloadKey, workspace]);

  async function handleSaveCustomer(data: CustomerFormData) {
    if (!workspace) {
      return;
    }

    try {
      setCustomerSaving(true);
      setError(null);
      await updateCustomerWorkspace(customerId, {
        description: normalizeOptionalText(data.description),
        externalRef: normalizeOptionalText(data.externalRef),
        name: data.name.trim(),
      });
      const updatedWorkspace = await fetchWorkspace();
      if (updatedWorkspace) {
        customerForm.reset(customerToFormValues(updatedWorkspace));
      }
    } catch (saveError) {
      console.error("Failed to save customer workspace", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить клиента",
      );
    } finally {
      setCustomerSaving(false);
    }
  }

  async function handleArchive() {
    try {
      setDeleting(true);
      setError(null);
      await archiveCustomer(customerId);
      router.push("/customers");
    } catch (deleteError) {
      console.error("Failed to archive customer workspace", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось архивировать клиента",
      );
    } finally {
      setDeleting(false);
    }
  }

  function openRequisiteDialog(input: {
    counterpartyId: string;
    counterpartyName: string;
    initialMode: "create" | "existing";
    initialRequisiteId?: string | null;
  }) {
    switchToTab("requisites");
    setRequisiteDialogDirty(false);
    setRequisiteDialogState((current) => ({
      counterpartyId: input.counterpartyId,
      counterpartyName: input.counterpartyName,
      initialMode: input.initialMode,
      initialRequisiteId: input.initialRequisiteId ?? null,
      key: (current?.key ?? 0) + 1,
    }));
  }

  function closeRequisiteDialog() {
    setRequisiteDialogDirty(false);
    setRequisiteCloseDialogOpen(false);
    setRequisiteDialogState(null);
  }

  function requestRequisiteDialogClose() {
    if (requisiteDialogDirty) {
      setRequisiteCloseDialogOpen(true);
      return;
    }

    closeRequisiteDialog();
  }

  function openAgreementCreateFlow() {
    if (!workspace?.counterparties.length) {
      return;
    }

    setAgreementPickerCounterpartyId(
      getDefaultCounterparty(
        workspace.counterparties,
        workspace.primaryCounterpartyId,
      )?.counterpartyId ?? "",
    );
    setAgreementPickerOpen(true);
  }

  function openRequisiteCreateFlow() {
    if (!workspace?.counterparties.length) {
      return;
    }

    setRequisiteOwnerPickerCounterpartyId(
      getDefaultCounterparty(
        workspace.counterparties,
        workspace.primaryCounterpartyId,
      )?.counterpartyId ?? "",
    );
    setRequisiteOwnerPickerOpen(true);
  }

  function openAgreementEditFlow() {
    if (!activeAgreement || !defaultCounterparty) {
      return;
    }

    setContractDialogState({
      counterpartyId: defaultCounterparty.counterpartyId,
      initialValues: getAgreementDialogInitialValues(activeAgreement),
    });
  }

  async function handleUploadDocument() {
    if (!uploadTargetCounterparty || !uploadDocumentFile) {
      return;
    }

    try {
      setUploadingDocument(true);
      setError(null);
      await uploadCustomerCounterpartyDocument({
        counterpartyId: uploadTargetCounterparty.counterpartyId,
        customerId,
        description: uploadDocumentDescription,
        file: uploadDocumentFile,
      });
      await fetchDocumentsForCounterparty(
        uploadTargetCounterparty.counterpartyId,
        true,
      );
      setUploadDialogOpen(false);
      setUploadTargetCounterpartyId(null);
      setUploadDocumentDescription("");
      setUploadDocumentFile(null);
    } catch (uploadError) {
      console.error("Failed to upload document", uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить документ",
      );
    } finally {
      setUploadingDocument(false);
    }
  }

  async function handleDownloadDocument(
    counterpartyId: string,
    document: ClientDocument,
  ) {
    try {
      setError(null);
      await downloadResponseAsFile(
        await downloadCustomerCounterpartyDocument({
          counterpartyId,
          customerId,
          documentId: document.id,
        }),
        document.fileName,
      );
    } catch (downloadError) {
      console.error("Failed to download document", downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать документ",
      );
    }
  }

  async function handleDeleteDocument(
    counterpartyId: string,
    documentId: ClientDocument["id"],
  ) {
    try {
      setDeletingDocumentKey(`${counterpartyId}:${String(documentId)}`);
      setError(null);
      await deleteCustomerCounterpartyDocument({
        counterpartyId,
        customerId,
        documentId,
      });
      await fetchDocumentsForCounterparty(counterpartyId, true);
    } catch (deleteError) {
      console.error("Failed to delete document", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить документ",
      );
    } finally {
      setDeletingDocumentKey(null);
    }
  }

  async function handleDownloadContract(
    counterpartyId: string,
    format: "docx" | "pdf",
  ) {
    try {
      setDownloadingContractCounterpartyId(counterpartyId);
      setError(null);
      await downloadResponseAsFile(
        await downloadCustomerCounterpartyContract({
          counterpartyId,
          customerId,
          format,
          lang: contractLang,
        }),
        `customer-contract-${counterpartyId}.${format}`,
      );
    } catch (downloadError) {
      console.error("Failed to download contract", downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать договор",
      );
    } finally {
      setDownloadingContractCounterpartyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="space-y-4">
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {error ?? "Клиент не найден"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CustomerDetailHeader
        createdAt={workspace.createdAt}
        customerId={workspace.id}
        deleting={deleting}
        externalRef={workspace.externalRef}
        onArchive={handleArchive}
        title={workspace.name}
      />

      {error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {showMissingLegalEntitiesAlert ? (
        <Alert variant="warning" className="pr-12">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            У клиента пока нет контрагентов. Добавьте первого контрагента, чтобы
            продолжить работу.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                router.push(buildCustomerCounterpartyCreateHref(customerId));
              }}
            >
              Добавить контрагента
            </Button>
          </AlertDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
            onClick={() => setEmptyAlertDismissed(true)}
            aria-label="Закрыть уведомление"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ) : null}

      {showMissingAgreementAlert ? (
        <Alert variant="warning" className="pr-12">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Для клиента пока не создан агентский договор.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => switchToTab("agreements")}
            >
              Перейти к договорам
            </Button>
          </AlertDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
            onClick={() => setAgreementAlertDismissed(true)}
            aria-label="Закрыть уведомление"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (
            value === "common" ||
            value === "counterparties" ||
            value === "requisites" ||
            value === "documents" ||
            value === "agreements"
          ) {
            switchToTab(value);
          }
        }}
        className="w-full"
      >
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto"
        >
          <TabsTrigger className="flex-none" value="common">
            <WorkspaceTabLabel icon={Info} label="Общее" />
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="counterparties">
            <WorkspaceTabLabel
              count={workspace.counterparties.length}
              icon={Building2}
              label="Контрагенты"
            />
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="requisites">
            <WorkspaceTabLabel
              count={requisitesTabCount}
              icon={Wallet}
              label="Реквизиты"
            />
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="documents">
            <WorkspaceTabLabel
              count={documentsTabCount}
              icon={File}
              label="Документы"
            />
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="agreements">
            <WorkspaceTabLabel
              count={agreementsTabCount}
              icon={FileText}
              label="Договоры"
            />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="common" className="pt-4">
          <CustomerSummaryCard
            createdAt={workspace.createdAt}
            form={customerForm}
            onSave={(data) => {
              void handleSaveCustomer(data);
            }}
            saving={customerSaving}
            workspace={workspace}
          />
        </TabsContent>

        <TabsContent value="counterparties" className="pt-4">
          <CounterpartiesTab
            counterparties={workspace.counterparties}
            onAdd={() => {
              router.push(buildCustomerCounterpartyCreateHref(customerId));
            }}
            onEdit={(counterpartyId) => {
              router.push(
                buildCustomerCounterpartyDetailsHref(
                  customerId,
                  counterpartyId,
                ),
              );
            }}
            primaryCounterpartyId={workspace.primaryCounterpartyId}
          />
        </TabsContent>

        <TabsContent value="requisites" className="pt-4">
          <RequisitesTab
            counterparties={workspace.counterparties}
            error={requisitesTableError}
            loading={requisitesTableLoading}
            onAdd={openRequisiteCreateFlow}
            onEdit={(row) => {
              openRequisiteDialog({
                counterpartyId: row.counterpartyId,
                counterpartyName: row.counterpartyName,
                initialMode: "existing",
                initialRequisiteId: row.id,
              });
            }}
            rows={requisiteRows}
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <DocumentsTab
            contractLang={contractLang}
            counterpartyDocuments={documentsByCounterpartyId}
            counterpartyErrors={documentErrorsByCounterpartyId}
            counterparties={workspace.counterparties}
            deletingDocumentKey={deletingDocumentKey}
            downloadingContractCounterpartyId={
              downloadingContractCounterpartyId
            }
            hasActiveAgreement={hasCustomerAgreement}
            loadingByCounterpartyId={loadingDocumentsByCounterpartyId}
            onContractLangChange={setContractLang}
            onDeleteDocument={(counterpartyId, documentId) => {
              void handleDeleteDocument(counterpartyId, documentId);
            }}
            onDownloadContract={(counterpartyId, format) => {
              void handleDownloadContract(counterpartyId, format);
            }}
            onDownloadDocument={(counterpartyId, document) => {
              void handleDownloadDocument(counterpartyId, document);
            }}
            onRetry={(counterpartyId) => {
              void fetchDocumentsForCounterparty(counterpartyId, true);
            }}
            onUploadDocument={(counterpartyId) => {
              setUploadTargetCounterpartyId(counterpartyId);
              setUploadDialogOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="agreements" className="pt-4">
          <AgreementsTab
            agreements={agreements}
            error={agreementsError}
            hasCounterparties={workspace.counterparties.length > 0}
            loading={agreementsLoading}
            onCreate={openAgreementCreateFlow}
            onEditActive={openAgreementEditFlow}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={requisiteDialogState !== null}
        onOpenChange={(open) => {
          if (!open) {
            requestRequisiteDialogClose();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {requisiteDialogState?.initialMode === "create"
                ? "Новый банковский реквизит"
                : "Банковские реквизиты"}
            </DialogTitle>
            <DialogDescription>
              {requisiteDialogState
                ? `Субъект: ${requisiteDialogState.counterpartyName}`
                : "Управление банковскими реквизитами."}
            </DialogDescription>
          </DialogHeader>

          {requisiteDialogState ? (
            <CounterpartyBankRequisitesWorkspace
              key={`${requisiteDialogState.counterpartyId}-${requisiteDialogState.key}`}
              counterpartyId={requisiteDialogState.counterpartyId}
              counterpartyName={requisiteDialogState.counterpartyName}
              initialMode={requisiteDialogState.initialMode}
              initialRequisiteId={requisiteDialogState.initialRequisiteId}
              onDirtyChange={setRequisiteDialogDirty}
              onRequisitesChange={() => {
                setRequisitesReloadKey((current) => current + 1);
              }}
              resetSignal={requisiteDialogState.key}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={agreementPickerOpen} onOpenChange={setAgreementPickerOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Выберите контрагента для договора</DialogTitle>
            <DialogDescription>
              Договор хранится на уровне клиента, но создание запускается из
              контекста одного из его контрагентов.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Select
              value={agreementPickerCounterpartyId}
              onValueChange={(value) =>
                setAgreementPickerCounterpartyId(value ?? "")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите контрагента">
                  {agreementPickerCounterparty
                    ? getCounterpartyLabel(agreementPickerCounterparty)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {workspace.counterparties.map((counterparty) => (
                  <SelectItem
                    key={counterparty.counterpartyId}
                    value={counterparty.counterpartyId}
                  >
                    {getCounterpartyLabel(counterparty)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAgreementPickerOpen(false)}
              type="button"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!agreementPickerCounterpartyId}
              onClick={() => {
                setAgreementPickerOpen(false);
                setContractDialogState({
                  counterpartyId: agreementPickerCounterpartyId,
                  initialValues: null,
                });
              }}
            >
              Продолжить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={requisiteOwnerPickerOpen}
        onOpenChange={setRequisiteOwnerPickerOpen}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Выберите контрагента для реквизита</DialogTitle>
            <DialogDescription>
              Новый реквизит нужно привязать к одному из контрагентов клиента.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Select
              value={requisiteOwnerPickerCounterpartyId}
              onValueChange={(value) =>
                setRequisiteOwnerPickerCounterpartyId(value ?? "")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите контрагента">
                  {requisiteOwnerPickerCounterparty
                    ? getCounterpartyLabel(requisiteOwnerPickerCounterparty)
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {workspace.counterparties.map((counterparty) => (
                  <SelectItem
                    key={counterparty.counterpartyId}
                    value={counterparty.counterpartyId}
                  >
                    {getCounterpartyLabel(counterparty)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequisiteOwnerPickerOpen(false)}
              type="button"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!requisiteOwnerPickerCounterpartyId}
              onClick={() => {
                const counterparty = workspace.counterparties.find(
                  (item) =>
                    item.counterpartyId === requisiteOwnerPickerCounterpartyId,
                );

                if (!counterparty) {
                  return;
                }

                setRequisiteOwnerPickerOpen(false);
                openRequisiteDialog({
                  counterpartyId: counterparty.counterpartyId,
                  counterpartyName: counterparty.shortName,
                  initialMode: "create",
                });
              }}
            >
              Продолжить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить документ</DialogTitle>
            <DialogDescription>
              {uploadTargetCounterparty
                ? `Документ будет привязан к контрагенту "${uploadTargetCounterparty.shortName}".`
                : "Документ будет привязан к выбранному контрагенту."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="document-file" className="text-sm font-medium">
                Файл
              </label>
              <input
                id="document-file"
                onChange={(event) =>
                  setUploadDocumentFile(event.target.files?.[0] ?? null)
                }
                type="file"
                className="border-input bg-background file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-8 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="document-description"
                className="text-sm font-medium"
              >
                Описание
              </label>
              <input
                id="document-description"
                onChange={(event) =>
                  setUploadDocumentDescription(event.target.value)
                }
                placeholder="Например: подписанный договор"
                value={uploadDocumentDescription}
                className="border-input bg-background file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-8 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                setUploadTargetCounterpartyId(null);
                setUploadDocumentDescription("");
                setUploadDocumentFile(null);
              }}
              type="button"
            >
              Отмена
            </Button>
            <Button
              disabled={!uploadDocumentFile || uploadingDocument}
              onClick={() => void handleUploadDocument()}
              type="button"
            >
              {uploadingDocument ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contractDialogState ? (
        <NewContractDialog
          counterpartyId={contractDialogState.counterpartyId}
          customerId={customerId}
          initialValues={contractDialogState.initialValues}
          onOpenChange={(open) => {
            if (!open) {
              setContractDialogState(null);
            }
          }}
          onSuccess={() => {
            setContractDialogState(null);
            setAgreementsReloadKey((current) => current + 1);
            void fetchWorkspace();
          }}
          open
        />
      ) : null}

      <PendingCloseDialog
        description="Несохраненные изменения реквизита будут потеряны."
        onConfirm={closeRequisiteDialog}
        onOpenChange={setRequisiteCloseDialogOpen}
        open={requisiteCloseDialogOpen}
        title="Закрыть форму реквизита?"
      />
    </div>
  );
}

function PendingCloseDialog(props: {
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const { description, onConfirm, onOpenChange, open, title } = props;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Остаться</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Закрыть без сохранения
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CounterpartiesTab(props: {
  counterparties: CustomerCounterparty[];
  onAdd: () => void;
  onEdit: (counterpartyId: string) => void;
  primaryCounterpartyId: string | null;
}) {
  const { counterparties, onAdd, onEdit, primaryCounterpartyId } = props;
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useMemo<ColumnDef<CustomerCounterparty>[]>(
    () => [
      {
        accessorKey: "shortName",
        cell: ({ row }) => {
          const counterparty = row.original;
          const primary = isPrimaryCounterparty(
            {
              counterparties,
              primaryCounterpartyId,
            },
            counterparty.counterpartyId,
          );

          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{counterparty.shortName}</span>
              {primary ? <Badge variant="outline">Основной</Badge> : null}
            </div>
          );
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Краткое имя" />
        ),
        meta: {
          label: "Краткое имя",
          placeholder: "Поиск по краткому имени...",
          variant: "text",
        },
      },
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Полное имя" />
        ),
        meta: {
          label: "Полное имя",
          placeholder: "Поиск по полному имени...",
          variant: "text",
        },
      },
      {
        accessorKey: "kind",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.kind === "individual" ? "Физ. лицо" : "Юр. лицо"}
          </Badge>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Тип" />
        ),
      },
      {
        accessorKey: "inn",
        cell: ({ row }) => row.original.inn || "—",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="ИНН" />
        ),
      },
      {
        accessorKey: "country",
        cell: ({ row }) => row.original.country?.trim().toUpperCase() || "—",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Страна" />
        ),
      },
      {
        id: "subAgent",
        accessorFn: (row) => row.subAgent?.shortName ?? "",
        cell: ({ row }) => row.original.subAgent?.shortName ?? "—",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Субагент" />
        ),
      },
      {
        accessorKey: "updatedAt",
        cell: ({ row }) => formatDate(row.original.updatedAt),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Обновлен" />
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(row.original.counterpartyId)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [counterparties, onEdit, primaryCounterpartyId],
  );

  const table = useReactTable({
    columns,
    data: counterparties,
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (counterparties.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="bg-muted rounded-full p-3">
            <Handshake className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">У клиента пока нет контрагентов</p>
            <p className="text-sm text-muted-foreground">
              Добавьте первого контрагента, чтобы настроить реквизиты, документы
              и договоры.
            </p>
          </div>
          <Button type="button" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить контрагента
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Контрагенты</CardTitle>
          <p className="text-sm text-muted-foreground">
            Все контрагенты клиента в одном списке.
          </p>
        </div>
        <Button type="button" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить контрагента
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DataTable
          table={table}
          onRowDoubleClick={(row) => onEdit(row.original.counterpartyId)}
          contextMenuItems={(row) => [
            {
              label: "Открыть",
              onClick: () => onEdit(row.original.counterpartyId),
            },
          ]}
        >
          <DataTableToolbar table={table} />
        </DataTable>
      </CardContent>
    </Card>
  );
}

function RequisitesTab(props: {
  counterparties: CustomerCounterparty[];
  error: string | null;
  loading: boolean;
  onAdd: () => void;
  onEdit: (row: RequisiteTableRow) => void;
  rows: RequisiteTableRow[];
}) {
  const { counterparties, error, loading, onAdd, onEdit, rows } = props;
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useMemo<ColumnDef<RequisiteTableRow>[]>(
    () => [
      {
        accessorKey: "counterpartyName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Контрагент" />
        ),
        meta: {
          label: "Контрагент",
          placeholder: "Поиск по контрагенту...",
          variant: "text",
        },
      },
      {
        accessorKey: "label",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Название" />
        ),
        meta: {
          label: "Название",
          placeholder: "Поиск по названию...",
          variant: "text",
        },
      },
      {
        accessorKey: "providerLabel",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Банк" />
        ),
      },
      {
        accessorKey: "currencyCode",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.currencyCode}</Badge>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Валюта" />
        ),
      },
      {
        accessorKey: "identity",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Идентификатор" />
        ),
      },
      {
        accessorKey: "isDefault",
        cell: ({ row }) =>
          row.original.isDefault ? <Badge>Основной</Badge> : "—",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="По умолчанию" />
        ),
      },
      {
        accessorKey: "updatedAt",
        cell: ({ row }) => formatDate(row.original.updatedAt),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Обновлен" />
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [onEdit],
  );

  const table = useReactTable({
    columns,
    data: rows,
    state: {
      columnFilters,
      columnVisibility,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (counterparties.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Сначала добавьте контрагента, чтобы создать для него реквизиты.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Реквизиты</CardTitle>
          <p className="text-sm text-muted-foreground">
            Банковские реквизиты всех контрагентов клиента.
          </p>
        </div>
        <Button type="button" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить реквизит
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">
              У клиента пока нет банковских реквизитов
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Создайте первый реквизит и привяжите его к нужному контрагенту.
            </p>
          </div>
        ) : (
          <DataTable
            table={table}
            onRowDoubleClick={(row) => onEdit(row.original)}
            contextMenuItems={(row) => [
              {
                label: "Открыть",
                onClick: () => onEdit(row.original),
              },
            ]}
          >
            <DataTableToolbar table={table} />
          </DataTable>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsTab(props: {
  contractLang: "ru" | "en";
  counterpartyDocuments: Record<string, ClientDocument[]>;
  counterpartyErrors: Record<string, string>;
  counterparties: CustomerCounterparty[];
  deletingDocumentKey: string | null;
  downloadingContractCounterpartyId: string | null;
  hasActiveAgreement: boolean;
  loadingByCounterpartyId: Record<string, boolean>;
  onContractLangChange: (value: "ru" | "en") => void;
  onDeleteDocument: (
    counterpartyId: string,
    documentId: ClientDocument["id"],
  ) => void;
  onDownloadContract: (counterpartyId: string, format: "docx" | "pdf") => void;
  onDownloadDocument: (
    counterpartyId: string,
    document: ClientDocument,
  ) => void;
  onRetry: (counterpartyId: string) => void;
  onUploadDocument: (counterpartyId: string) => void;
}) {
  const {
    contractLang,
    counterpartyDocuments,
    counterpartyErrors,
    counterparties,
    deletingDocumentKey,
    downloadingContractCounterpartyId,
    hasActiveAgreement,
    loadingByCounterpartyId,
    onContractLangChange,
    onDeleteDocument,
    onDownloadContract,
    onDownloadDocument,
    onRetry,
    onUploadDocument,
  } = props;

  if (counterparties.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Документы появятся после добавления контрагентов.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Документы</CardTitle>
            <p className="text-sm text-muted-foreground">
              Документы и шаблоны договоров сгруппированы по контрагентам.
            </p>
          </div>
          <div className="w-full max-w-[180px] space-y-1">
            <Select
              value={contractLang}
              onValueChange={(value) => {
                if (value) {
                  onContractLangChange(value);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {counterparties.map((counterparty) => {
        const documents =
          counterpartyDocuments[counterparty.counterpartyId] ?? [];
        const counterpartyError =
          counterpartyErrors[counterparty.counterpartyId] ?? null;
        const loading =
          loadingByCounterpartyId[counterparty.counterpartyId] ?? false;
        const downloadingContract =
          downloadingContractCounterpartyId === counterparty.counterpartyId;

        return (
          <Card key={counterparty.counterpartyId}>
            <CardHeader>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" />
                    {counterparty.shortName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Документы контрагента и выгрузка шаблона договора.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveAgreement || downloadingContract}
                    onClick={() =>
                      onDownloadContract(counterparty.counterpartyId, "docx")
                    }
                    type="button"
                  >
                    {downloadingContract ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Скачать DOCX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveAgreement || downloadingContract}
                    onClick={() =>
                      onDownloadContract(counterparty.counterpartyId, "pdf")
                    }
                    type="button"
                  >
                    {downloadingContract ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Скачать PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onUploadDocument(counterparty.counterpartyId)
                    }
                    type="button"
                  >
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Загрузить документ
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {counterpartyError ? (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>{counterpartyError}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRetry(counterparty.counterpartyId)}
                    >
                      Повторить
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Документы ещё не загружены.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="shrink-0">
                          {getFileIcon(document.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {document.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(document.fileSize)} •{" "}
                            {new Date(document.createdAt).toLocaleString(
                              "ru-RU",
                            )}
                          </p>
                          {document.description ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {document.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            onDownloadDocument(
                              counterparty.counterpartyId,
                              document,
                            )
                          }
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={
                            deletingDocumentKey ===
                            `${counterparty.counterpartyId}:${String(document.id)}`
                          }
                          onClick={() =>
                            onDeleteDocument(
                              counterparty.counterpartyId,
                              document.id,
                            )
                          }
                          type="button"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AgreementsTab(props: {
  agreements: CustomerAgreementDetail[];
  error: string | null;
  hasCounterparties: boolean;
  loading: boolean;
  onCreate: () => void;
  onEditActive: () => void;
}) {
  const {
    agreements,
    error,
    hasCounterparties,
    loading,
    onCreate,
    onEditActive,
  } = props;
  const activeAgreement =
    agreements.find((agreement) => agreement.isActive) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Agreements</CardTitle>
            <p className="text-sm text-muted-foreground">
              История агентских договоров клиента.
            </p>
          </div>
          <Button
            type="button"
            disabled={!hasCounterparties}
            onClick={activeAgreement ? onEditActive : onCreate}
          >
            {activeAgreement ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать активный договор
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Создать договор
              </>
            )}
          </Button>
        </CardHeader>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : agreements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="font-medium">Договоры клиента ещё не созданы</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Создайте первый агентский договор, чтобы его можно было
              использовать в сделках.
            </p>
          </CardContent>
        </Card>
      ) : (
        agreements.map((agreement) => (
          <Card
            key={agreement.id}
            className={agreement.isActive ? "border-primary/40" : undefined}
          >
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Агентский договор
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Создан {formatDate(agreement.createdAt)} • обновлен{" "}
                    {formatDate(agreement.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agreement.isActive ? "default" : "secondary"}>
                    {agreement.isActive ? "Действует" : "Не активен"}
                  </Badge>
                  <Badge variant="outline">
                    Версия {agreement.currentVersion.versionNumber}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Номер договора
                  </div>
                  <div className="text-base">
                    {agreement.currentVersion.contractNumber || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Дата договора
                  </div>
                  <div className="text-base">
                    {formatDateShort(agreement.currentVersion.contractDate)}
                  </div>
                </div>
              </div>

              {agreement.currentVersion.feeRules.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Условия
                  </div>
                  {agreement.currentVersion.feeRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                    >
                      {formatAgreementFeeRuleLabel(rule)}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
