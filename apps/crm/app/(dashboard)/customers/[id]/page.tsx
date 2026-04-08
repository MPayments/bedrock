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
import { CustomerLegalEntityPanel } from "./_components/customer-legal-entity-panel";
import { CustomerSummaryCard } from "./_components/customer-summary-card";
import { PendingEntitySwitchDialog } from "./_components/pending-entity-switch-dialog";
import {
  buildCustomerEntityHref,
  customerFormSchema,
  customerToFormValues,
  type ClientDocument,
  type CustomerFormData,
  type CustomerWorkspaceDetail,
  resolveActiveLegalEntityId,
} from "./_lib/customer-detail";
import {
  archiveCustomer,
  deleteCustomerLegalEntityDocument,
  downloadCustomerLegalEntityContract,
  downloadCustomerLegalEntityDocument,
  getCustomerWorkspace,
  listCustomerLegalEntityDocuments,
  updateCustomerWorkspace,
  uploadCustomerLegalEntityDocument,
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
  const [legalEntityDirty, setLegalEntityDirty] = useState(false);
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
  const [creatingLegalEntityMode, setCreatingLegalEntityMode] = useState(false);
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

    return resolveActiveLegalEntityId({
      legalEntities: workspace.legalEntities,
      primaryCounterpartyId: workspace.primaryCounterpartyId,
      requestedCounterpartyId: entityParam,
    });
  }, [entityParam, workspace]);

  const selectedLegalEntity = useMemo(() => {
    const targetCounterpartyId =
      activeCounterpartyId ?? resolvedActiveCounterpartyId;

    if (!workspace || !targetCounterpartyId) {
      return null;
    }

    return (
      workspace.legalEntities.find(
        (legalEntity) => legalEntity.counterpartyId === targetCounterpartyId,
      ) ?? null
    );
  }, [activeCounterpartyId, resolvedActiveCounterpartyId, workspace]);

  const customerDirty = customerForm.formState.isDirty;
  const hasUnsavedChanges =
    customerDirty || legalEntityDirty || requisitesDirty;
  const hasCustomerAgreement = workspace?.hasActiveAgreement ?? false;
  const showMissingAgreementAlert =
    selectedLegalEntity !== null &&
    !hasCustomerAgreement &&
    !agreementAlertDismissed;
  const showMissingLegalEntitiesAlert =
    workspace !== null &&
    workspace.legalEntities.length === 0 &&
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
      setLegalEntityDirty(false);
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
          await listCustomerLegalEntityDocuments(customerId, counterpartyId),
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
    if (workspace?.legalEntities.length) {
      setEmptyAlertDismissed(false);
    }
  }, [workspace?.legalEntities.length]);

  useEffect(() => {
    setAgreementAlertDismissed(false);
  }, [hasCustomerAgreement]);

  useEffect(() => {
    void fetchDocuments(selectedLegalEntity?.counterpartyId ?? null);
  }, [fetchDocuments, selectedLegalEntity?.counterpartyId]);

  async function handleSaveCustomer(data: CustomerFormData) {
    if (!workspace) {
      return;
    }

    try {
      setCustomerSaving(true);
      setError(null);
      await updateCustomerWorkspace(customerId, {
        description: normalizeOptionalText(data.description),
        displayName: data.displayName.trim(),
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

  async function handleLegalEntityCreated(counterpartyId: string) {
    try {
      setError(null);
      setCreatingLegalEntityMode(false);
      setLegalEntityDirty(false);
      await fetchWorkspace();
      navigateToEntity(counterpartyId, "push");
    } catch (createError) {
      console.error("Failed to finish legal entity creation", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать юридическое лицо",
      );
    }
  }

  async function handleUploadDocument() {
    if (!selectedLegalEntity || !uploadDocumentFile) {
      return;
    }

    try {
      setUploadingDocument(true);
      await uploadCustomerLegalEntityDocument({
        customerId,
        counterpartyId: selectedLegalEntity.counterpartyId,
        description: uploadDocumentDescription,
        file: uploadDocumentFile,
      });
      setUploadDialogOpen(false);
      setUploadDocumentDescription("");
      setUploadDocumentFile(null);
      await fetchDocuments(selectedLegalEntity.counterpartyId);
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
    if (!selectedLegalEntity) {
      return;
    }

    try {
      await downloadResponseAsFile(
        await downloadCustomerLegalEntityDocument({
          customerId,
          counterpartyId: selectedLegalEntity.counterpartyId,
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
    if (!selectedLegalEntity) {
      return;
    }

    try {
      setDeletingDocumentId(documentId);
      await deleteCustomerLegalEntityDocument({
        customerId,
        counterpartyId: selectedLegalEntity.counterpartyId,
        documentId,
      });
      await fetchDocuments(selectedLegalEntity.counterpartyId);
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
    if (!selectedLegalEntity) {
      return;
    }

    try {
      setDownloadingContract(true);
      await downloadResponseAsFile(
        await downloadCustomerLegalEntityContract({
          customerId,
          counterpartyId: selectedLegalEntity.counterpartyId,
          format,
          lang: contractLang,
        }),
        `customer-contract-${selectedLegalEntity.counterpartyId}.${format}`,
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
        canManageAgreement={selectedLegalEntity !== null}
        deleting={deleting}
        legalEntityCount={workspace.legalEntityCount}
        onAddLegalEntity={() => setCreatingLegalEntityMode(true)}
        onArchive={handleArchive}
        onBack={() => router.back()}
        onOpenContractDialog={() => setContractDialogOpen(true)}
        title={workspace.displayName}
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
            У клиента пока нет юридических лиц. Добавьте первое юридическое
            лицо, чтобы продолжить.
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
        {workspace.legalEntities.length > 0 && selectedLegalEntity ? (
          <CustomerLegalEntityPanel
            createMode={creatingLegalEntityMode}
            customerId={customerId}
            contractLang={contractLang}
            deletingDocumentId={deletingDocumentId}
            documents={documents}
            downloadingContract={downloadingContract}
            legalEntityResetSignal={requisitesResetSignal}
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
              setCreatingLegalEntityMode(false);
              setLegalEntityDirty(false);
            }}
            onCreated={(counterpartyId) => {
              void handleLegalEntityCreated(counterpartyId);
            }}
            onLegalEntityDirtyChange={setLegalEntityDirty}
            onLegalEntitySaved={() => {
              setLegalEntityDirty(false);
              void fetchWorkspace();
            }}
            onRequisitesDirtyChange={setRequisitesDirty}
            requisitesResetSignal={requisitesResetSignal}
            onUploadDocument={() => setUploadDialogOpen(true)}
            selectedLegalEntity={selectedLegalEntity}
            workspaceLegalEntities={workspace.legalEntities}
            workspacePrimaryCounterpartyId={workspace.primaryCounterpartyId}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {creatingLegalEntityMode ? (
              <CustomerLegalEntityPanel
                createMode
                customerId={customerId}
                contractLang={contractLang}
                deletingDocumentId={deletingDocumentId}
                documents={documents}
                downloadingContract={downloadingContract}
                legalEntityResetSignal={requisitesResetSignal}
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
                  setCreatingLegalEntityMode(false);
                  setLegalEntityDirty(false);
                }}
                onCreated={(counterpartyId) => {
                  void handleLegalEntityCreated(counterpartyId);
                }}
                onLegalEntityDirtyChange={setLegalEntityDirty}
                onLegalEntitySaved={() => {
                  setLegalEntityDirty(false);
                  void fetchWorkspace();
                }}
                onRequisitesDirtyChange={setRequisitesDirty}
                requisitesResetSignal={requisitesResetSignal}
                onUploadDocument={() => setUploadDialogOpen(true)}
                selectedLegalEntity={{
                  counterpartyId: "00000000-0000-0000-0000-000000000000",
                  country: null,
                  createdAt: workspace.createdAt,
                  externalId: null,
                  fullName: "",
                  inn: null,
                  orgName: "",
                  relationshipKind: "customer_owned",
                  shortName: "",
                  subAgent: null,
                  subAgentCounterpartyId: null,
                  updatedAt: workspace.updatedAt,
                }}
                workspaceLegalEntities={workspace.legalEntities}
                workspacePrimaryCounterpartyId={workspace.primaryCounterpartyId}
              />
            ) : (
              "У этого клиента пока нет юридических лиц."
            )}
          </div>
        )}
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить документ</DialogTitle>
            <DialogDescription>
              Документ будет привязан к выбранному юридическому лицу.
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

      {selectedLegalEntity ? (
        <NewContractDialog
          counterpartyId={selectedLegalEntity.counterpartyId}
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
