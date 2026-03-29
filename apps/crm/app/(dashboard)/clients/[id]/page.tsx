"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { COUNTRIES as countries } from "@bedrock/shared/reference-data/countries";
import {
  ChevronLeft,
  Save,
  Loader2,
  Trash2,
  Pencil,
  FileText,
  Download,
  ChevronDown,
  UserPlus,
  Upload as UploadIcon,
  File,
  FileImage,
  FileType,
  Archive,
  Paperclip,
  Languages,
  Globe,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { API_BASE_URL } from "@/lib/constants";
import { translateFieldsToEnglish } from "@/lib/translate-fields";
import { NewContractDialog } from "@/components/dashboard/NewContractDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clientSchema, type ClientFormData } from "@/lib/validation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubAgent {
  id: number;
  name: string;
  commission: number;
}

interface ClientDocument {
  id: number;
  clientId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  uploadedBy: number;
  createdAt: string;
  updatedAt: string;
}

interface ClientData {
  id: number;
  orgName: string;
  orgNameI18n?: { ru?: string | null; en?: string | null } | null;
  orgType: string | null;
  orgTypeI18n?: { ru?: string | null; en?: string | null } | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  oktmo: string | null;
  okpo: string | null;
  directorName: string | null;
  directorNameI18n?: { ru?: string | null; en?: string | null } | null;
  position: string | null;
  positionI18n?: { ru?: string | null; en?: string | null } | null;
  directorBasis: string | null;
  directorBasisI18n?: { ru?: string | null; en?: string | null } | null;
  address: string | null;
  addressI18n?: { ru?: string | null; en?: string | null } | null;
  email: string | null;
  phone: string | null;
  bankName: string | null;
  bankNameI18n?: { ru?: string | null; en?: string | null } | null;
  bankAddress: string | null;
  bankAddressI18n?: { ru?: string | null; en?: string | null } | null;
  account: string | null;
  bic: string | null;
  corrAccount: string | null;
  contractNumber: string | null;
  subAgent: SubAgent | null;
  createdAt: string;
  updatedAt: string;
}

function clientToFormData(client: ClientData): ClientFormData {
  return {
    orgName: client.orgName || "",
    orgNameI18n: {
      ru: client.orgNameI18n?.ru || "",
      en: client.orgNameI18n?.en || "",
    },
    orgType: client.orgType || "",
    orgTypeI18n: {
      ru: client.orgTypeI18n?.ru || "",
      en: client.orgTypeI18n?.en || "",
    },
    inn: client.inn || "",
    kpp: client.kpp || "",
    ogrn: client.ogrn || "",
    oktmo: client.oktmo || "",
    okpo: client.okpo || "",
    directorName: client.directorName || "",
    directorNameI18n: {
      ru: client.directorNameI18n?.ru || "",
      en: client.directorNameI18n?.en || "",
    },
    position: client.position || "",
    positionI18n: {
      ru: client.positionI18n?.ru || "",
      en: client.positionI18n?.en || "",
    },
    directorBasis: client.directorBasis || "",
    directorBasisI18n: {
      ru: client.directorBasisI18n?.ru || "",
      en: client.directorBasisI18n?.en || "",
    },
    address: client.address || "",
    addressI18n: {
      ru: client.addressI18n?.ru || "",
      en: client.addressI18n?.en || "",
    },
    email: client.email || "",
    phone: client.phone || "",
    bankName: client.bankName || "",
    bankNameI18n: {
      ru: client.bankNameI18n?.ru || "",
      en: client.bankNameI18n?.en || "",
    },
    bankAddress: client.bankAddress || "",
    bankAddressI18n: {
      ru: client.bankAddressI18n?.ru || "",
      en: client.bankAddressI18n?.en || "",
    },
    account: client.account || "",
    bic: client.bic || "",
    corrAccount: client.corrAccount || "",
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
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

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [downloadingContract, setDownloadingContract] = useState(false);
  const [contractLang, setContractLang] = useState<"ru" | "en">("ru");

  // Перевод на английский
  const [translating, setTranslating] = useState(false);

  // Документы клиента
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [isUploadDocumentDialogOpen, setIsUploadDocumentDialogOpen] =
    useState(false);
  const [uploadDocumentFile, setUploadDocumentFile] = useState<File | null>(
    null,
  );
  const [uploadDocumentDescription, setUploadDocumentDescription] =
    useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(
    null,
  );

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      orgName: "",
      orgNameI18n: { ru: "", en: "" },
      orgType: "",
      orgTypeI18n: { ru: "", en: "" },
      inn: "",
      kpp: "",
      ogrn: "",
      oktmo: "",
      okpo: "",
      directorName: "",
      directorNameI18n: { ru: "", en: "" },
      position: "",
      positionI18n: { ru: "", en: "" },
      directorBasis: "",
      directorBasisI18n: { ru: "", en: "" },
      address: "",
      addressI18n: { ru: "", en: "" },
      email: "",
      phone: "",
      bankName: "",
      bankNameI18n: { ru: "", en: "" },
      bankAddress: "",
      bankAddressI18n: { ru: "", en: "" },
      account: "",
      bic: "",
      corrAccount: "",
    },
    mode: "onBlur",
  });

  const fetchClient = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Клиент не найден");
        }
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const data: ClientData = await res.json();
      setClient(data);
      form.reset(clientToFormData(data));
    } catch (err) {
      console.error("Fetch client error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки клиента");
    } finally {
      setLoading(false);
    }
  }, [clientId, form]);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const docs: ClientDocument[] = await res.json();
      setDocuments(docs);
    } catch (err) {
      console.error("Documents fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка загрузки документов",
      );
    } finally {
      setLoadingDocuments(false);
    }
  }, [clientId]);

  const handleDocumentUpload = async () => {
    if (!uploadDocumentFile) {
      setError("Выберите файл для загрузки");
      return;
    }

    try {
      setUploadingDocument(true);
      const formData = new FormData();
      formData.append("file", uploadDocumentFile);
      // Передаем оригинальное имя файла отдельно для правильной кодировки
      formData.append("fileName", uploadDocumentFile.name);
      if (uploadDocumentDescription) {
        formData.append("description", uploadDocumentDescription);
      }

      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка загрузки: ${res.status}`);
      }

      setIsUploadDocumentDialogOpen(false);
      setUploadDocumentFile(null);
      setUploadDocumentDescription("");
      await fetchDocuments();
    } catch (err) {
      console.error("Document upload error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка загрузки документа",
      );
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDocumentDownload = async (
    documentId: number,
    fileName: string,
  ) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/clients/${clientId}/documents/${documentId}/download`,
        {
          credentials: "include",
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка скачивания: ${res.status}`,
        );
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Document download error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка скачивания документа",
      );
    }
  };

  const handleDocumentDelete = async (documentId: number) => {
    try {
      setDeletingDocumentId(documentId);
      const res = await fetch(
        `${API_BASE_URL}/clients/${clientId}/documents/${documentId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка удаления: ${res.status}`);
      }

      await fetchDocuments();
    } catch (err) {
      console.error("Document delete error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка удаления документа",
      );
    } finally {
      setDeletingDocumentId(null);
    }
  };

  useEffect(() => {
    fetchClient();
    fetchDocuments();
  }, [fetchClient, fetchDocuments]);

  const onSubmit = async (data: ClientFormData) => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...data,
        orgNameI18n: {
          ru: data.orgName || undefined,
          en: data.orgNameI18n?.en || undefined,
        },
        orgTypeI18n: {
          ru: data.orgType || undefined,
          en: data.orgTypeI18n?.en || undefined,
        },
        directorNameI18n: {
          ru: data.directorName || undefined,
          en: data.directorNameI18n?.en || undefined,
        },
        positionI18n: {
          ru: data.position || undefined,
          en: data.positionI18n?.en || undefined,
        },
        directorBasisI18n: {
          ru: data.directorBasis || undefined,
          en: data.directorBasisI18n?.en || undefined,
        },
        addressI18n: {
          ru: data.address || undefined,
          en: data.addressI18n?.en || undefined,
        },
        bankNameI18n: {
          ru: data.bankName || undefined,
          en: data.bankNameI18n?.en || undefined,
        },
        bankAddressI18n: {
          ru: data.bankAddress || undefined,
          en: data.bankAddressI18n?.en || undefined,
        },
      };

      const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Ошибка сохранения: ${res.status}`,
        );
      }

      const updatedClient: ClientData = await res.json();
      setClient(updatedClient);
      form.reset(clientToFormData(updatedClient));
      setIsEditing(false);
    } catch (err) {
      console.error("Save client error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка сохранения клиента",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Ошибка удаления: ${res.status}`);
      }

      router.push("/clients");
    } catch (err) {
      console.error("Delete client error:", err);
      setError(err instanceof Error ? err.message : "Ошибка удаления клиента");
    } finally {
      setDeleting(false);
    }
  };

  const handleTranslateToEnglish = async () => {
    setTranslating(true);
    setError(null);

    try {
      const values = form.getValues();
      const ruFields: Record<string, string> = {
        orgName: values.orgName,
        orgType: values.orgType,
        directorName: values.directorName,
        position: values.position,
        directorBasis: values.directorBasis,
        address: values.address || "",
        bankName: values.bankName || "",
        bankAddress: values.bankAddress || "",
      };

      const translated = await translateFieldsToEnglish(ruFields);

      const mapping: Record<string, string> = {
        orgName: "orgNameI18n.en",
        orgType: "orgTypeI18n.en",
        directorName: "directorNameI18n.en",
        position: "positionI18n.en",
        directorBasis: "directorBasisI18n.en",
        address: "addressI18n.en",
        bankName: "bankNameI18n.en",
        bankAddress: "bankAddressI18n.en",
      };

      for (const [key, enField] of Object.entries(mapping)) {
        if (translated[key]) {
          form.setValue(enField as any, translated[key], {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }
    } catch (err) {
      console.error("Translation error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка перевода полей"
      );
    } finally {
      setTranslating(false);
    }
  };

  const handleCancel = () => {
    if (client) {
      form.reset(clientToFormData(client));
    }
    setIsEditing(false);
  };

  const handleDownloadContract = useCallback(
    async (format: "docx" | "pdf") => {
      try {
        setDownloadingContract(true);
        setError(null);

        const res = await fetch(
          `${API_BASE_URL}/documents/clients/${clientId}/contract?format=${format}&lang=${contractLang}`,
          {
            credentials: "include",
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Ошибка скачивания: ${res.status}`,
          );
        }

        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition");
        let filename = `contract.${format}`;

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match?.[1]) {
            filename = decodeURIComponent(match[1]);
          }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        console.error("Download contract error:", err);
        setError(
          err instanceof Error ? err.message : "Ошибка скачивания контракта",
        );
      } finally {
        setDownloadingContract(false);
      }
    },
    [clientId, contractLang],
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
        </div>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client.orgName}</h1>
            {client.contractNumber && (
              <p className="text-sm text-muted-foreground">
                Агентский договор: {client.contractNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={downloadingContract}>
                    {downloadingContract ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Агентский договор
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setContractDialogOpen(true)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Создать / Редактировать
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDownloadContract("docx")}
                    disabled={downloadingContract}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Скачать DOCX
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDownloadContract("pdf")}
                    disabled={downloadingContract}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Скачать PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Редактировать
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Удалить
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите удалить клиента «{client.orgName}»?
                      Это действие нельзя отменить.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleTranslateToEnglish}
                disabled={translating || saving}
              >
                {translating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Перевод...
                  </>
                ) : (
                  <>
                    <Languages className="mr-2 h-4 w-4" />
                    Заполнить EN поля
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Отмена
              </Button>
              <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Form {...form}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Основные данные организации */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Данные организации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Название организации{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="ООО «Компания»" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgNameI18n.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название организации (EN)</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="Company name in English"
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orgType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Тип организации{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="ООО, ИП, АО..." {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgTypeI18n.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип организации (EN)</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="LLC, Ltd..." {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        ИНН{" "}
                        {isEditing && (
                          <span className="text-destructive">*</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="1234567890" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kpp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>КПП</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="123456789" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ogrn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ОГРН</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="1234567890123" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="okpo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ОКПО</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="12345678" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="oktmo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ОКТМО</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="12345678901" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Директор */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Руководитель</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="directorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      ФИО директора{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Иванов Иван Иванович" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="directorNameI18n.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ФИО директора (EN)</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="Director full name in English"
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Должность{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Генеральный директор" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="positionI18n.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Должность (EN)</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="Director position in English"
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="directorBasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Основание полномочий{" "}
                      {isEditing && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input placeholder="Устава" {...field} />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="directorBasisI18n.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Основание полномочий (EN)</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="Authority basis in English"
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <CardTitle className="text-lg">Контакты</CardTitle>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Адрес</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="г. Москва, ул. Примерная, д. 1"
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressI18n.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Адрес (EN)</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          placeholder="Legal address in English"
                          {...field}
                        />
                      ) : (
                        <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                          {field.value || (
                            <span className="text-muted-foreground">
                              Не указано
                            </span>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            type="email"
                            placeholder="info@company.ru"
                            {...field}
                          />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="+7 (999) 123-45-67" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Банковские реквизиты */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Банковские реквизиты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название банка</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="ПАО Сбербанк" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankNameI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название банка (EN)</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            placeholder="Bank name in English"
                            {...field}
                          />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес банка</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="г. Москва" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAddressI18n.en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес банка (EN)</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            placeholder="Bank address in English"
                            {...field}
                          />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Страна банка</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Выберите страну" />
                            </SelectTrigger>
                            <SelectContent>
                              {countries.map((c) => (
                                <SelectItem key={c.alpha2} value={c.alpha2}>
                                  {c.emoji} {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value ? (
                              (() => {
                                const country = countries.find(
                                  (c) => c.alpha2 === field.value
                                );
                                return country
                                  ? `${country.emoji} ${country.name}`
                                  : field.value;
                              })()
                            ) : (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Расчётный счёт</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            placeholder="40702810123456789012"
                            {...field}
                          />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>БИК</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="044525225" {...field} />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="corrAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Корр. счёт</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            placeholder="30101810400000000225"
                            {...field}
                          />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 py-2 rounded-md bg-muted/50">
                            {field.value || (
                              <span className="text-muted-foreground">
                                Не указано
                              </span>
                            )}
                          </div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Субагент */}
          {client.subAgent && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Субагент
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Имя</Label>
                    <p className="font-medium">{client.subAgent.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      Комиссия
                    </Label>
                    <p className="font-medium">{client.subAgent.commission}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Загруженные документы */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <File className="h-5 w-5" />
                  Загруженные документы
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadDocumentDialogOpen(true)}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Загрузить документ
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDocuments ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Загрузка документов...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Нет загруженных документов
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {doc.fileName}
                          </div>
                          {doc.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {doc.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)} •{" "}
                            {new Date(doc.createdAt).toLocaleString("ru-RU")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            handleDocumentDownload(doc.id, doc.fileName)
                          }
                          title="Скачать"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDocumentDelete(doc.id)}
                          disabled={deletingDocumentId === doc.id}
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Form>

      {/* Диалог загрузки документа */}
      <Dialog
        open={isUploadDocumentDialogOpen}
        onOpenChange={setIsUploadDocumentDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Загрузить документ</DialogTitle>
            <DialogDescription>
              Выберите файл для загрузки и добавьте описание (необязательно)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="documentFile">Файл</Label>
              <Input
                id="documentFile"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadDocumentFile(file);
                  }
                }}
                disabled={uploadingDocument}
              />
              {uploadDocumentFile && (
                <p className="text-sm text-muted-foreground">
                  {uploadDocumentFile.name} (
                  {formatFileSize(uploadDocumentFile.size)})
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="documentDescription">
                Описание (необязательно)
              </Label>
              <Input
                id="documentDescription"
                value={uploadDocumentDescription}
                onChange={(e) => setUploadDocumentDescription(e.target.value)}
                placeholder="Например: Подписанный договор"
                disabled={uploadingDocument}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDocumentDialogOpen(false);
                setUploadDocumentFile(null);
                setUploadDocumentDescription("");
              }}
              disabled={uploadingDocument}
            >
              Отмена
            </Button>
            <Button
              onClick={handleDocumentUpload}
              disabled={uploadingDocument || !uploadDocumentFile}
            >
              {uploadingDocument ? "Загрузка..." : "Загрузить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модальное окно создания договора */}
      <NewContractDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        clientId={parseInt(clientId)}
        onSuccess={() => {
          fetchClient();
        }}
      />
    </div>
  );
}
