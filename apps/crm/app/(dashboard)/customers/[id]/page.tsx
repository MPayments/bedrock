"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  Building2,
  ChevronLeft,
  Download,
  File,
  FileImage,
  FileText,
  FileType,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { COUNTRIES } from "@bedrock/shared/reference-data/countries";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bedrock/sdk-ui/components/select";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { NewContractDialog } from "@/components/dashboard/NewContractDialog";
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
import { API_BASE_URL } from "@/lib/constants";

type SubAgent = {
  commissionRate: number;
  counterpartyId: string;
  country: string | null;
  fullName: string;
  isActive: boolean;
  kind: "individual" | "legal_entity";
  shortName: string;
};

type CustomerLegalEntity = {
  account: string | null;
  address: string | null;
  bankAddress: string | null;
  bankCountry: string | null;
  bankName: string | null;
  bic: string | null;
  contractNumber: string | null;
  corrAccount: string | null;
  counterpartyId: string;
  country: string | null;
  createdAt: string;
  directorBasis: string | null;
  directorName: string | null;
  email: string | null;
  externalId: string | null;
  fullName: string;
  hasLegacyShell: boolean;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  okpo: string | null;
  oktmo: string | null;
  orgName: string;
  orgType: string | null;
  phone: string | null;
  position: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  subAgent: SubAgent | null;
  subAgentCounterpartyId: string | null;
  updatedAt: string;
};

type CustomerWorkspaceDetail = {
  createdAt: string;
  description: string | null;
  displayName: string;
  externalRef: string | null;
  id: string;
  legalEntities: CustomerLegalEntity[];
  legalEntityCount: number;
  primaryCounterpartyId: string | null;
  updatedAt: string;
};

type ClientDocument = {
  createdAt: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  updatedAt: string;
  uploadedBy: string | null;
};

const legalEntityFormSchema = z.object({
  account: z.string().optional(),
  address: z.string().optional(),
  bankAddress: z.string().optional(),
  bankCountry: z.string().max(2).optional(),
  bankName: z.string().optional(),
  bic: z.string().optional(),
  corrAccount: z.string().optional(),
  directorBasis: z.string().optional(),
  directorName: z.string().optional(),
  email: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  okpo: z.string().optional(),
  oktmo: z.string().optional(),
  orgName: z.string().min(1, "Название юридического лица обязательно"),
  orgType: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
});

type LegalEntityFormData = z.infer<typeof legalEntityFormSchema>;

const createLegalEntitySchema = z.object({
  address: z.string().optional(),
  country: z.string().max(2).optional(),
  directorName: z.string().optional(),
  email: z.string().optional(),
  inn: z.string().optional(),
  orgName: z.string().min(1, "Название юридического лица обязательно"),
  phone: z.string().optional(),
});

type CreateLegalEntityFormData = z.infer<typeof createLegalEntitySchema>;

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function legalEntityToFormValues(
  legalEntity: CustomerLegalEntity | null,
): LegalEntityFormData {
  return {
    account: legalEntity?.account ?? "",
    address: legalEntity?.address ?? "",
    bankAddress: legalEntity?.bankAddress ?? "",
    bankCountry: legalEntity?.bankCountry ?? "",
    bankName: legalEntity?.bankName ?? "",
    bic: legalEntity?.bic ?? "",
    corrAccount: legalEntity?.corrAccount ?? "",
    directorBasis: legalEntity?.directorBasis ?? "",
    directorName: legalEntity?.directorName ?? "",
    email: legalEntity?.email ?? "",
    inn: legalEntity?.inn ?? "",
    kpp: legalEntity?.kpp ?? "",
    ogrn: legalEntity?.ogrn ?? "",
    okpo: legalEntity?.okpo ?? "",
    oktmo: legalEntity?.oktmo ?? "",
    orgName: legalEntity?.orgName ?? "",
    orgType: legalEntity?.orgType ?? "",
    phone: legalEntity?.phone ?? "",
    position: legalEntity?.position ?? "",
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, unitIndex)) * 100) / 100} ${units[unitIndex]}`;
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
    return <Archive className="h-5 w-5" />;
  }

  return <Paperclip className="h-5 w-5" />;
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

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [workspace, setWorkspace] = useState<CustomerWorkspaceDetail | null>(null);
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [downloadingContract, setDownloadingContract] = useState(false);
  const [contractLang, setContractLang] = useState<"ru" | "en">("ru");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDocumentFile, setUploadDocumentFile] = useState<File | null>(null);
  const [uploadDocumentDescription, setUploadDocumentDescription] = useState("");
  const [newLegalEntityOpen, setNewLegalEntityOpen] = useState(false);
  const [creatingLegalEntity, setCreatingLegalEntity] = useState(false);
  const [customerDescription, setCustomerDescription] = useState("");
  const [customerExternalRef, setCustomerExternalRef] = useState("");

  const legalEntityForm = useForm<LegalEntityFormData>({
    defaultValues: legalEntityToFormValues(null),
    resolver: zodResolver(legalEntityFormSchema),
  });
  const createLegalEntityForm = useForm<CreateLegalEntityFormData>({
    defaultValues: {
      address: "",
      country: "",
      directorName: "",
      email: "",
      inn: "",
      orgName: "",
      phone: "",
    },
    resolver: zodResolver(createLegalEntitySchema),
  });

  const selectedLegalEntity = useMemo(
    () =>
      workspace?.legalEntities.find(
        (legalEntity) => legalEntity.counterpartyId === selectedCounterpartyId,
      ) ??
      workspace?.legalEntities[0] ??
      null,
    [selectedCounterpartyId, workspace],
  );

  const isPrimaryLegalEntity =
    workspace !== null &&
    selectedLegalEntity !== null &&
    (workspace.primaryCounterpartyId === selectedLegalEntity.counterpartyId ||
      (!workspace.primaryCounterpartyId &&
        workspace.legalEntities[0]?.counterpartyId ===
          selectedLegalEntity.counterpartyId));

  const fetchDocuments = useCallback(
    async (counterpartyId: string | null) => {
      if (!counterpartyId) {
        setDocuments([]);
        return;
      }

      try {
        setLoadingDocuments(true);
        const response = await fetch(
          `${API_BASE_URL}/customers/${customerId}/legal-entities/${counterpartyId}/documents`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Ошибка загрузки документов: ${response.status}`);
        }

        const data: ClientDocument[] = await response.json();
        setDocuments(data);
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

      const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Клиент не найден");
        }

        throw new Error(`Ошибка загрузки: ${response.status}`);
      }

      const data: CustomerWorkspaceDetail = await response.json();
      setWorkspace(data);
      setCustomerDescription(data.description ?? "");
      setCustomerExternalRef(data.externalRef ?? "");
      setSelectedCounterpartyId((current) => {
        if (
          current &&
          data.legalEntities.some(
            (legalEntity) => legalEntity.counterpartyId === current,
          )
        ) {
          return current;
        }

        return (
          data.primaryCounterpartyId ??
          data.legalEntities[0]?.counterpartyId ??
          null
        );
      });
    } catch (fetchError) {
      console.error("Failed to fetch customer workspace", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить клиента",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    legalEntityForm.reset(legalEntityToFormValues(selectedLegalEntity));
  }, [legalEntityForm, selectedLegalEntity]);

  useEffect(() => {
    void fetchDocuments(selectedLegalEntity?.counterpartyId ?? null);
  }, [fetchDocuments, selectedLegalEntity?.counterpartyId]);

  async function handleSave(data: LegalEntityFormData) {
    if (!workspace || !selectedLegalEntity) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const legalEntityPayload = {
        account: normalizeOptionalText(data.account),
        address: normalizeOptionalText(data.address),
        bankAddress: normalizeOptionalText(data.bankAddress),
        bankCountry: normalizeOptionalText(data.bankCountry)?.toUpperCase() ?? null,
        bankName: normalizeOptionalText(data.bankName),
        bic: normalizeOptionalText(data.bic),
        corrAccount: normalizeOptionalText(data.corrAccount),
        directorBasis: normalizeOptionalText(data.directorBasis),
        directorName: normalizeOptionalText(data.directorName),
        email: normalizeOptionalText(data.email),
        inn: normalizeOptionalText(data.inn),
        kpp: normalizeOptionalText(data.kpp),
        ogrn: normalizeOptionalText(data.ogrn),
        okpo: normalizeOptionalText(data.okpo),
        oktmo: normalizeOptionalText(data.oktmo),
        orgName: data.orgName.trim(),
        orgType: normalizeOptionalText(data.orgType),
        phone: normalizeOptionalText(data.phone),
        position: normalizeOptionalText(data.position),
      };

      const legalEntityResponse = await fetch(
        `${API_BASE_URL}/customers/${customerId}/legal-entities/${selectedLegalEntity.counterpartyId}`,
        {
          body: JSON.stringify(legalEntityPayload),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      if (!legalEntityResponse.ok) {
        const message = await legalEntityResponse
          .json()
          .catch(() => ({ error: "Ошибка сохранения юридического лица" }));
        throw new Error(message.error ?? "Ошибка сохранения юридического лица");
      }

      const customerPayload: Record<string, string | null> = {
        description: normalizeOptionalText(customerDescription),
        externalRef: normalizeOptionalText(customerExternalRef),
      };
      if (isPrimaryLegalEntity) {
        customerPayload.displayName = data.orgName.trim();
      }

      const customerResponse = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
        body: JSON.stringify(customerPayload),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!customerResponse.ok) {
        const message = await customerResponse
          .json()
          .catch(() => ({ error: "Ошибка сохранения клиента" }));
        throw new Error(message.error ?? "Ошибка сохранения клиента");
      }

      setIsEditing(false);
      await fetchWorkspace();
    } catch (saveError) {
      console.error("Failed to save customer workspace", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить изменения",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
        credentials: "include",
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "Ошибка архивации клиента" }));
        throw new Error(message.error ?? "Ошибка архивации клиента");
      }

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

  async function handleCreateLegalEntity(values: CreateLegalEntityFormData) {
    if (!workspace) {
      return;
    }

    try {
      setCreatingLegalEntity(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/customers/${customerId}/legal-entities`,
        {
          body: JSON.stringify({
            address: normalizeOptionalText(values.address),
            country: normalizeOptionalText(values.country)?.toUpperCase() ?? null,
            directorName: normalizeOptionalText(values.directorName),
            email: normalizeOptionalText(values.email),
            inn: normalizeOptionalText(values.inn),
            orgName: values.orgName.trim(),
            phone: normalizeOptionalText(values.phone),
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "Ошибка создания юридического лица" }));
        throw new Error(message.error ?? "Ошибка создания юридического лица");
      }

      const created: CustomerLegalEntity = await response.json();
      createLegalEntityForm.reset();
      setNewLegalEntityOpen(false);
      setSelectedCounterpartyId(created.counterpartyId);
      await fetchWorkspace();
    } catch (createError) {
      console.error("Failed to create legal entity", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать юридическое лицо",
      );
    } finally {
      setCreatingLegalEntity(false);
    }
  }

  async function handleUploadDocument() {
    if (!selectedLegalEntity || !uploadDocumentFile) {
      return;
    }

    try {
      setUploadingDocument(true);
      const formData = new FormData();
      formData.append("file", uploadDocumentFile);
      if (uploadDocumentDescription.trim()) {
        formData.append("description", uploadDocumentDescription.trim());
      }

      const response = await fetch(
        `${API_BASE_URL}/customers/${customerId}/legal-entities/${selectedLegalEntity.counterpartyId}/documents`,
        {
          body: formData,
          credentials: "include",
          method: "POST",
        },
      );

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "Ошибка загрузки документа" }));
        throw new Error(message.error ?? "Ошибка загрузки документа");
      }

      setUploadDialogOpen(false);
      setUploadDocumentDescription("");
      setUploadDocumentFile(null);
      await fetchDocuments(selectedLegalEntity.counterpartyId);
      await fetchWorkspace();
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
      const response = await fetch(
        `${API_BASE_URL}/customers/${customerId}/legal-entities/${selectedLegalEntity.counterpartyId}/documents/${document.id}/download`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "Ошибка скачивания документа" }));
        throw new Error(message.error ?? "Ошибка скачивания документа");
      }

      await downloadResponseAsFile(response, document.fileName);
    } catch (downloadError) {
      console.error("Failed to download document", downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать документ",
      );
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!selectedLegalEntity) {
      return;
    }

    try {
      setDeletingDocumentId(documentId);
      const response = await fetch(
        `${API_BASE_URL}/customers/${customerId}/legal-entities/${selectedLegalEntity.counterpartyId}/documents/${documentId}`,
        {
          credentials: "include",
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "Ошибка удаления документа" }));
        throw new Error(message.error ?? "Ошибка удаления документа");
      }

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
      const response = await fetch(
        `${API_BASE_URL}/customers/${customerId}/legal-entities/${selectedLegalEntity.counterpartyId}/contract?format=${format}&lang=${contractLang}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "Ошибка скачивания договора" }));
        throw new Error(message.error ?? "Ошибка скачивания договора");
      }

      await downloadResponseAsFile(
        response,
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{workspace.displayName}</h1>
            <p className="text-sm text-muted-foreground">
              {workspace.legalEntityCount}{" "}
              {workspace.legalEntityCount === 1
                ? "юридическое лицо"
                : workspace.legalEntityCount < 5
                  ? "юридических лица"
                  : "юридических лиц"}
            </p>
            {!selectedLegalEntity ? (
              <p className="text-sm text-amber-600">
                У клиента пока нет юридических лиц. Добавьте первое юридическое
                лицо, чтобы продолжить.
              </p>
            ) : !selectedLegalEntity.hasLegacyShell ? (
              <p className="text-sm text-amber-600">
                Execution-shell будет создан автоматически при первом
                договоре, документе или заявке.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setNewLegalEntityOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить юр. лицо
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditing((current) => !current)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {isEditing ? "Отменить редактирование" : "Редактировать"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setContractDialogOpen(true)}
            disabled={!selectedLegalEntity}
          >
            <FileText className="mr-2 h-4 w-4" />
            Создать / редактировать договор
          </Button>
          <ArchiveCustomerButton deleting={deleting} onConfirm={handleArchive} />
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Паспорт клиента</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Каноническое имя клиента</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {workspace.displayName}
            </div>
            <p className="text-xs text-muted-foreground">
              Для primary юридического лица это имя зеркалится из поля
              организации.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-external-ref">External Ref</Label>
            {isEditing ? (
              <Input
                id="customer-external-ref"
                value={customerExternalRef}
                onChange={(event) => setCustomerExternalRef(event.target.value)}
                placeholder="Например: crm-0001"
              />
            ) : (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {workspace.externalRef ?? "Не указан"}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Создан</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {new Date(workspace.createdAt).toLocaleString("ru-RU")}
            </div>
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="customer-description">Описание</Label>
            {isEditing ? (
              <Textarea
                id="customer-description"
                value={customerDescription}
                onChange={(event) => setCustomerDescription(event.target.value)}
                placeholder="Описание клиента"
                rows={3}
              />
            ) : (
              <div className="min-h-[88px] rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {workspace.description ?? "Описание не указано"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Юридические лица
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspace.legalEntities.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <Label>Активное юридическое лицо</Label>
                <Select
                  value={selectedLegalEntity?.counterpartyId ?? ""}
                  onValueChange={(value) => setSelectedCounterpartyId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите юридическое лицо" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.legalEntities.map((legalEntity) => (
                      <SelectItem
                        key={legalEntity.counterpartyId}
                        value={legalEntity.counterpartyId}
                      >
                        {legalEntity.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                  {workspace.legalEntities.map((legalEntity) => {
                    const isSelected =
                      legalEntity.counterpartyId ===
                      selectedLegalEntity?.counterpartyId;
                    const isPrimary =
                      workspace.primaryCounterpartyId ===
                        legalEntity.counterpartyId ||
                      (!workspace.primaryCounterpartyId &&
                        workspace.legalEntities[0]?.counterpartyId ===
                          legalEntity.counterpartyId);

                    return (
                      <button
                        key={legalEntity.counterpartyId}
                        className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}
                        onClick={() =>
                          setSelectedCounterpartyId(legalEntity.counterpartyId)
                        }
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {legalEntity.shortName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {legalEntity.inn
                                ? `ИНН: ${legalEntity.inn}`
                                : "ИНН не указан"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {isPrimary ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                Primary
                              </span>
                            ) : null}
                            {!legalEntity.hasLegacyShell ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                                shell позже
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedLegalEntity ? (
                <form
                  className="space-y-4"
                  onSubmit={legalEntityForm.handleSubmit(handleSave)}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Название юр. лица"
                      name="orgName"
                      required
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Тип организации"
                      name="orgType"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="ИНН"
                      name="inn"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="КПП"
                      name="kpp"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="ОГРН"
                      name="ogrn"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="ОКПО"
                      name="okpo"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="ОКТМО"
                      name="oktmo"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Email"
                      name="email"
                      type="email"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Телефон"
                      name="phone"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Директор"
                      name="directorName"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Должность"
                      name="position"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Основание полномочий"
                      name="directorBasis"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Адрес"
                      name="address"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Название банка"
                      name="bankName"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Адрес банка"
                      name="bankAddress"
                    />
                    <SelectField
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Страна банка"
                      name="bankCountry"
                      options={COUNTRIES.map((country) => ({
                        label: `${country.emoji} ${country.name}`,
                        value: country.alpha2,
                      }))}
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Расчетный счёт"
                      name="account"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="БИК"
                      name="bic"
                    />
                    <Field
                      disabled={!isEditing}
                      form={legalEntityForm}
                      label="Корр. счёт"
                      name="corrAccount"
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Системные привязки
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <InfoRow
                          label="Counterparty ID"
                          value={selectedLegalEntity.counterpartyId}
                        />
                        <InfoRow
                          label="Relationship"
                          value={selectedLegalEntity.relationshipKind}
                        />
                        <InfoRow
                          label="Legacy shell"
                          value={
                            selectedLegalEntity.hasLegacyShell
                              ? "Привязан"
                              : "Будет создан по требованию"
                          }
                        />
                        <InfoRow
                          label="Договор"
                          value={
                            selectedLegalEntity.contractNumber ?? "Не создан"
                          }
                        />
                      </CardContent>
                    </Card>

                    {selectedLegalEntity.subAgent ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Субагент
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <InfoRow
                            label="Имя"
                            value={selectedLegalEntity.subAgent.shortName}
                          />
                          <InfoRow
                            label="Комиссия"
                            value={`${selectedLegalEntity.subAgent.commissionRate}%`}
                          />
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Субагент
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Субагент не назначен.
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <File className="h-4 w-4" />
                          Документы
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadDialogOpen(true)}
                          type="button"
                        >
                          <UploadIcon className="mr-2 h-4 w-4" />
                          Загрузить документ
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingDocuments ? (
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
                                    void handleDownloadDocument(document)
                                  }
                                  type="button"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={deletingDocumentId === document.id}
                                  onClick={() =>
                                    void handleDeleteDocument(document.id)
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

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={contractLang}
                      onValueChange={(value) =>
                        setContractLang((value as "ru" | "en") ?? "ru")
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ru">Русский</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={downloadingContract}
                      onClick={() => void handleDownloadContract("docx")}
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
                      disabled={downloadingContract}
                      onClick={() => void handleDownloadContract("pdf")}
                      type="button"
                    >
                      {downloadingContract ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Скачать PDF
                    </Button>
                    <Button disabled={!isEditing || saving} type="submit">
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Сохранить изменения
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              У этого клиента пока нет юридических лиц.
            </div>
          )}
        </CardContent>
      </Card>

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
              <Label htmlFor="document-file">Файл</Label>
              <Input
                id="document-file"
                onChange={(event) =>
                  setUploadDocumentFile(event.target.files?.[0] ?? null)
                }
                type="file"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-description">Описание</Label>
              <Input
                id="document-description"
                onChange={(event) =>
                  setUploadDocumentDescription(event.target.value)
                }
                placeholder="Например: подписанный договор"
                value={uploadDocumentDescription}
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

      <Dialog open={newLegalEntityOpen} onOpenChange={setNewLegalEntityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить юридическое лицо</DialogTitle>
            <DialogDescription>
              Создайте новое customer-owned юридическое лицо для этого клиента.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={createLegalEntityForm.handleSubmit(handleCreateLegalEntity)}
          >
            <Field
              disabled={creatingLegalEntity}
              form={createLegalEntityForm}
              label="Название юр. лица"
              name="orgName"
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                disabled={creatingLegalEntity}
                form={createLegalEntityForm}
                label="ИНН"
                name="inn"
              />
              <Field
                disabled={creatingLegalEntity}
                form={createLegalEntityForm}
                label="Email"
                name="email"
                type="email"
              />
              <Field
                disabled={creatingLegalEntity}
                form={createLegalEntityForm}
                label="Телефон"
                name="phone"
              />
              <Field
                disabled={creatingLegalEntity}
                form={createLegalEntityForm}
                label="Директор"
                name="directorName"
              />
              <SelectField
                disabled={creatingLegalEntity}
                form={createLegalEntityForm}
                label="Страна"
                name="country"
                options={COUNTRIES.map((country) => ({
                  label: `${country.emoji} ${country.name}`,
                  value: country.alpha2,
                }))}
              />
            </div>
            <Field
              disabled={creatingLegalEntity}
              form={createLegalEntityForm}
              label="Адрес"
              name="address"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setNewLegalEntityOpen(false)}
                type="button"
              >
                Отмена
              </Button>
              <Button disabled={creatingLegalEntity} type="submit">
                {creatingLegalEntity ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Создать юр. лицо
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}

function Field<TFieldValues extends FieldValues>({
  disabled,
  form,
  label,
  name,
  required = false,
  type = "text",
}: {
  disabled: boolean;
  form: UseFormReturn<TFieldValues>;
  label: string;
  name: Path<TFieldValues>;
  required?: boolean;
  type?: string;
}) {
  const error =
    (form.formState.errors[name] as { message?: string } | undefined)?.message ??
    null;
  const value = (form.watch(name) as unknown as string | undefined) ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        disabled={disabled}
        id={name}
        onChange={(event) =>
          form.setValue(name, event.target.value as TFieldValues[typeof name], {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        type={type}
        value={value}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField<TFieldValues extends FieldValues>({
  disabled,
  form,
  label,
  name,
  options,
}: {
  disabled: boolean;
  form: UseFormReturn<TFieldValues>;
  label: string;
  name: Path<TFieldValues>;
  options: Array<{ label: string; value: string }>;
}) {
  const value = (form.watch(name) as unknown as string | undefined) ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select
        value={value}
        onValueChange={(nextValue) =>
          form.setValue(name, nextValue as TFieldValues[typeof name], {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      >
        <SelectTrigger disabled={disabled} id={name}>
          <SelectValue placeholder="Не выбрано" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ArchiveCustomerButton({
  deleting,
  onConfirm,
}: {
  deleting: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} type="button">
        <Trash2 className="mr-2 h-4 w-4" />
        Архивировать клиента
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие архивирует связанные execution-shell записи. Канонический
              customer и memberships останутся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => {
                void onConfirm();
              }}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
