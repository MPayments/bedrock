"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ChevronLeft, Loader2, X } from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";

import { NewContractDialog } from "@/components/dashboard/NewContractDialog";
import { CustomerDetailHeader } from "./_components/customer-detail-header";
import { CustomerCounterpartyPanel } from "./_components/customer-counterparty-panel";
import { CustomerSummaryCard } from "./_components/customer-summary-card";
import { PendingEntitySwitchDialog } from "./_components/pending-entity-switch-dialog";
import {
  buildCustomerEntityHref,
  customerFormSchema,
  customerToFormValues,
  type ClientDocument,
  type CustomerFormData,
  type CustomerWorkspaceDetail,
  resolveActiveCounterpartyId,
} from "./_lib/customer-detail";
import {
  archiveCustomer,
  deleteCustomerCounterpartyDocument,
  downloadCustomerCounterpartyContract,
  downloadCustomerCounterpartyDocument,
  getCustomerWorkspace,
  listCustomerCounterpartyDocuments,
  updateCustomerWorkspace,
  uploadCustomerCounterpartyDocument,
} from "./_lib/customer-workspace-api";

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

type PendingEntitySwitch = {
  counterpartyId: string;
  mode: "push" | "replace";
} | null;

export default function CustomerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const entityParam = searchParams.get("entity");

  const [workspace, setWorkspace] = useState<CustomerWorkspaceDetail | null>(
    null,
  );
  const [activeCounterpartyId, setActiveCounterpartyId] = useState<
    string | null
  >(null);
  const [pendingEntitySwitch, setPendingEntitySwitch] =
    useState<PendingEntitySwitch>(null);
  const [entitySwitchDialogOpen, setEntitySwitchDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [counterpartyDirty, setCounterpartyDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<
    ClientDocument["id"] | null
  >(null);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [downloadingContract, setDownloadingContract] = useState(false);
  const [contractLang, setContractLang] = useState<"ru" | "en">("ru");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDocumentFile, setUploadDocumentFile] = useState<File | null>(
    null,
  );
  const [uploadDocumentDescription, setUploadDocumentDescription] =
    useState("");
  const [creatingCounterpartyMode, setCreatingCounterpartyMode] = useState(false);
  const [emptyAlertDismissed, setEmptyAlertDismissed] = useState(false);
  const [agreementAlertDismissed, setAgreementAlertDismissed] = useState(false);
  const [requisitesDirty, setRequisitesDirty] = useState(false);
  const [requisitesResetSignal, setRequisitesResetSignal] = useState(0);

  const customerForm = useForm<CustomerFormData>({
    defaultValues: customerToFormValues(null),
    resolver: zodResolver(customerFormSchema) as never,
  });

  const resolvedActiveCounterpartyId = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return resolveActiveCounterpartyId({
      counterparties: workspace.counterparties,
      primaryCounterpartyId: workspace.primaryCounterpartyId,
      requestedCounterpartyId: entityParam,
    });
  }, [entityParam, workspace]);

  const selectedCounterparty = useMemo(() => {
    const targetCounterpartyId =
      activeCounterpartyId ?? resolvedActiveCounterpartyId;

    if (!workspace || !targetCounterpartyId) {
      return null;
    }

    return (
      workspace.counterparties.find(
        (partyProfile) => partyProfile.counterpartyId === targetCounterpartyId,
      ) ?? null
    );
  }, [activeCounterpartyId, resolvedActiveCounterpartyId, workspace]);

  const customerDirty = customerForm.formState.isDirty;
  const hasUnsavedChanges =
    customerDirty || counterpartyDirty || requisitesDirty;
  const hasCustomerAgreement = workspace?.hasActiveAgreement ?? false;
  const showMissingAgreementAlert =
    selectedCounterparty !== null &&
    !hasCustomerAgreement &&
    !agreementAlertDismissed;
  const showMissingLegalEntitiesAlert =
    workspace !== null &&
    workspace.counterparties.length === 0 &&
    !emptyAlertDismissed;

  const navigateToEntity = useCallback(
    (counterpartyId: string | null, mode: "push" | "replace") => {
      const href = buildCustomerEntityHref({
        counterpartyId,
        pathname,
        searchParams: new URLSearchParams(searchParams.toString()),
      });

      if (mode === "replace") {
        router.replace(href);
        return;
      }

      router.push(href);
    },
    [pathname, router, searchParams],
  );

  const resetDraftsFromWorkspace = useCallback(
    () => {
      customerForm.reset(customerToFormValues(workspace));
      setCounterpartyDirty(false);
      setRequisitesDirty(false);
      setRequisitesResetSignal((current) => current + 1);
      setError(null);
    },
    [customerForm, workspace],
  );

  const requestEntityChange = useCallback(
    (counterpartyId: string, mode: "push" | "replace" = "push") => {
      if (
        !counterpartyId ||
        counterpartyId === activeCounterpartyId ||
        !workspace
      ) {
        return;
      }

      if (hasUnsavedChanges) {
        setPendingEntitySwitch({ counterpartyId, mode });
        setEntitySwitchDialogOpen(true);
        return;
      }

      navigateToEntity(counterpartyId, mode);
    },
    [activeCounterpartyId, hasUnsavedChanges, navigateToEntity, workspace],
  );

  const fetchDocuments = useCallback(
    async (counterpartyId: string | null) => {
      if (!counterpartyId) {
        setDocuments([]);
        return;
      }

      try {
        setLoadingDocuments(true);
        setDocuments(
          await listCustomerCounterpartyDocuments(customerId, counterpartyId),
        );
      } catch (fetchError) {
        console.error("Failed to fetch documents", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Не удалось загрузить документы",
        );
      } finally {
        setLoadingDocuments(false);
      }
    },
    [customerId],
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

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (entityParam !== resolvedActiveCounterpartyId) {
      navigateToEntity(resolvedActiveCounterpartyId, "replace");
    }
  }, [entityParam, navigateToEntity, resolvedActiveCounterpartyId, workspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (!resolvedActiveCounterpartyId) {
      setActiveCounterpartyId(null);
      return;
    }

    if (activeCounterpartyId === null) {
      setActiveCounterpartyId(resolvedActiveCounterpartyId);
      return;
    }

    if (resolvedActiveCounterpartyId === activeCounterpartyId) {
      return;
    }

    if (hasUnsavedChanges) {
      setPendingEntitySwitch({
        counterpartyId: resolvedActiveCounterpartyId,
        mode: "replace",
      });
      setEntitySwitchDialogOpen(true);
      navigateToEntity(activeCounterpartyId, "replace");
      return;
    }

    setActiveCounterpartyId(resolvedActiveCounterpartyId);
  }, [
    activeCounterpartyId,
    hasUnsavedChanges,
    navigateToEntity,
    resolvedActiveCounterpartyId,
    workspace,
  ]);

  useEffect(() => {
    if (!workspace || customerDirty) {
      return;
    }

    customerForm.reset(customerToFormValues(workspace));
  }, [customerDirty, customerForm, workspace]);

  useEffect(() => {
    if (workspace?.counterparties.length) {
      setEmptyAlertDismissed(false);
    }
  }, [workspace?.counterparties.length]);

  useEffect(() => {
    setAgreementAlertDismissed(false);
  }, [hasCustomerAgreement]);

  useEffect(() => {
    void fetchDocuments(selectedCounterparty?.counterpartyId ?? null);
  }, [fetchDocuments, selectedCounterparty?.counterpartyId]);

  async function handleSaveCustomer(data: CustomerFormData) {
    if (!workspace) {
      return;
    }

    try {
      setCustomerSaving(true);
      setError(null);
      await updateCustomerWorkspace(customerId, {
        description: normalizeOptionalText(data.description),
        name: data.name.trim(),
        externalRef: normalizeOptionalText(data.externalRef),
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

  async function handleCounterpartyCreated(counterpartyId: string) {
    try {
      setError(null);
      setCreatingCounterpartyMode(false);
      setCounterpartyDirty(false);
      await fetchWorkspace();
      navigateToEntity(counterpartyId, "push");
    } catch (createError) {
      console.error("Failed to finish counterparty creation", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать субъекта",
      );
    }
  }

  async function handleUploadDocument() {
    if (!selectedCounterparty || !uploadDocumentFile) {
      return;
    }

    try {
      setUploadingDocument(true);
      await uploadCustomerCounterpartyDocument({
        customerId,
        counterpartyId: selectedCounterparty.counterpartyId,
        description: uploadDocumentDescription,
        file: uploadDocumentFile,
      });
      setUploadDialogOpen(false);
      setUploadDocumentDescription("");
      setUploadDocumentFile(null);
      await fetchDocuments(selectedCounterparty.counterpartyId);
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

  async function handleDownloadDocument(document: ClientDocument) {
    if (!selectedCounterparty) {
      return;
    }

    try {
      await downloadResponseAsFile(
        await downloadCustomerCounterpartyDocument({
          customerId,
          counterpartyId: selectedCounterparty.counterpartyId,
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

  async function handleDeleteDocument(documentId: ClientDocument["id"]) {
    if (!selectedCounterparty) {
      return;
    }

    try {
      setDeletingDocumentId(documentId);
      await deleteCustomerCounterpartyDocument({
        customerId,
        counterpartyId: selectedCounterparty.counterpartyId,
        documentId,
      });
      await fetchDocuments(selectedCounterparty.counterpartyId);
    } catch (deleteError) {
      console.error("Failed to delete document", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить документ",
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function handleDownloadContract(format: "docx" | "pdf") {
    if (!selectedCounterparty) {
      return;
    }

    try {
      setDownloadingContract(true);
      await downloadResponseAsFile(
        await downloadCustomerCounterpartyContract({
          customerId,
          counterpartyId: selectedCounterparty.counterpartyId,
          format,
          lang: contractLang,
        }),
        `customer-contract-${selectedCounterparty.counterpartyId}.${format}`,
      );
    } catch (downloadError) {
      console.error("Failed to download contract", downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать договор",
      );
    } finally {
      setDownloadingContract(false);
    }
  }

  function handleConfirmEntitySwitch() {
    const nextSwitch = pendingEntitySwitch;

    setEntitySwitchDialogOpen(false);
    setPendingEntitySwitch(null);
    resetDraftsFromWorkspace();

    if (!nextSwitch) {
      return;
    }

    navigateToEntity(nextSwitch.counterpartyId, nextSwitch.mode);
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
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
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
        canManageAgreement={selectedCounterparty !== null}
        deleting={deleting}
        counterpartyCount={workspace.counterpartyCount}
        onAddCounterparty={() => setCreatingCounterpartyMode(true)}
        onArchive={handleArchive}
        onBack={() => router.back()}
        onOpenContractDialog={() => setContractDialogOpen(true)}
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
            У клиента пока нет субъектов сделки. Добавьте первый субъект, чтобы
            продолжить работу.
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
              onClick={() => setContractDialogOpen(true)}
            >
              Создать договор
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

      <CustomerSummaryCard
        createdAt={workspace.createdAt}
        form={customerForm}
        onSave={(data) => {
          void handleSaveCustomer(data);
        }}
        saving={customerSaving}
        workspace={workspace}
      />

      <div>
        {workspace.counterparties.length > 0 && selectedCounterparty ? (
          <CustomerCounterpartyPanel
            createMode={creatingCounterpartyMode}
            customerId={customerId}
            contractLang={contractLang}
            deletingDocumentId={deletingDocumentId}
            documents={documents}
            downloadingContract={downloadingContract}
            counterpartyResetSignal={requisitesResetSignal}
            loadingDocuments={loadingDocuments}
            onContractLangChange={setContractLang}
            onDeleteDocument={(documentId) => {
              void handleDeleteDocument(documentId);
            }}
            onDownloadContract={(format) => {
              void handleDownloadContract(format);
            }}
            onDownloadDocument={(document) => {
              void handleDownloadDocument(document);
            }}
            onEntityChange={(counterpartyId) => {
              requestEntityChange(counterpartyId, "push");
            }}
            onCancelCreate={() => {
              setCreatingCounterpartyMode(false);
              setCounterpartyDirty(false);
            }}
            onCreated={(counterpartyId) => {
              void handleCounterpartyCreated(counterpartyId);
            }}
            onCounterpartyDirtyChange={setCounterpartyDirty}
            onCounterpartySaved={() => {
              setCounterpartyDirty(false);
              void fetchWorkspace();
            }}
            onRequisitesDirtyChange={setRequisitesDirty}
            requisitesResetSignal={requisitesResetSignal}
            onUploadDocument={() => setUploadDialogOpen(true)}
            selectedCounterparty={selectedCounterparty}
            workspaceCounterparties={workspace.counterparties}
            workspacePrimaryCounterpartyId={workspace.primaryCounterpartyId}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {creatingCounterpartyMode ? (
              <CustomerCounterpartyPanel
                createMode
                customerId={customerId}
                contractLang={contractLang}
                deletingDocumentId={deletingDocumentId}
                documents={documents}
                downloadingContract={downloadingContract}
                counterpartyResetSignal={requisitesResetSignal}
                loadingDocuments={loadingDocuments}
                onContractLangChange={setContractLang}
                onDeleteDocument={(documentId) => {
                  void handleDeleteDocument(documentId);
                }}
                onDownloadContract={(format) => {
                  void handleDownloadContract(format);
                }}
                onDownloadDocument={(document) => {
                  void handleDownloadDocument(document);
                }}
                onEntityChange={(counterpartyId) => {
                  requestEntityChange(counterpartyId, "push");
                }}
                onCancelCreate={() => {
                  setCreatingCounterpartyMode(false);
                  setCounterpartyDirty(false);
                }}
                onCreated={(counterpartyId) => {
                  void handleCounterpartyCreated(counterpartyId);
                }}
                onCounterpartyDirtyChange={setCounterpartyDirty}
                onCounterpartySaved={() => {
                  setCounterpartyDirty(false);
                  void fetchWorkspace();
                }}
                onRequisitesDirtyChange={setRequisitesDirty}
                requisitesResetSignal={requisitesResetSignal}
                onUploadDocument={() => setUploadDialogOpen(true)}
                selectedCounterparty={{
                  counterpartyId: "00000000-0000-0000-0000-000000000000",
                  country: null,
                  createdAt: workspace.createdAt,
                  externalRef: null,
                  fullName: "",
                  inn: null,
                  orgName: "",
                  relationshipKind: "customer_owned",
                  shortName: "",
                  subAgent: null,
                  subAgentCounterpartyId: null,
                  updatedAt: workspace.updatedAt,
                }}
                workspaceCounterparties={workspace.counterparties}
                workspacePrimaryCounterpartyId={workspace.primaryCounterpartyId}
              />
            ) : (
              "У этого клиента пока нет субъектов сделки."
            )}
          </div>
        )}
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить документ</DialogTitle>
            <DialogDescription>
              Документ будет привязан к выбранному субъекту сделки.
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

      <PendingEntitySwitchDialog
        open={entitySwitchDialogOpen}
        onOpenChange={(open) => {
          setEntitySwitchDialogOpen(open);
          if (!open) {
            setPendingEntitySwitch(null);
          }
        }}
        onConfirm={handleConfirmEntitySwitch}
      />

      {selectedCounterparty ? (
        <NewContractDialog
          counterpartyId={selectedCounterparty.counterpartyId}
          customerId={customerId}
          onOpenChange={setContractDialogOpen}
          onSuccess={() => {
            void fetchWorkspace();
          }}
          open={contractDialogOpen}
        />
      ) : null}
    </div>
  );
}
