"use client";

import {
  Building2,
  Download,
  File,
  FileImage,
  FileText,
  FileType,
  Loader2,
  Paperclip,
  Save,
  Trash2,
  Wallet,
  X,
  Upload as UploadIcon,
} from "lucide-react";
import { useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

import type {
  ClientDocument,
  CustomerLegalEntity,
  LegalEntityFormData,
} from "../_lib/customer-detail";
import {
  isPrimaryLegalEntity,
  legalEntityToFormValues,
} from "../_lib/customer-detail";
import { CounterpartyBankRequisitesWorkspace } from "./counterparty-bank-requisites-workspace";
import { CustomerLegalEntitySelect } from "./customer-legal-entity-select";

type CustomerLegalEntityPanelProps = {
  contractLang: "ru" | "en";
  deletingDocumentId: string | null;
  documents: ClientDocument[];
  downloadingContract: boolean;
  form: UseFormReturn<LegalEntityFormData>;
  loadingDocuments: boolean;
  onContractLangChange: (value: "ru" | "en") => void;
  onDeleteDocument: (documentId: string) => void;
  onDownloadContract: (format: "docx" | "pdf") => void;
  onDownloadDocument: (document: ClientDocument) => void;
  onEntityChange: (counterpartyId: string) => void;
  onRequisitesDirtyChange: (dirty: boolean) => void;
  onSave: (data: LegalEntityFormData) => void;
  onUploadDocument: () => void;
  requisitesResetSignal: number;
  saving: boolean;
  selectedLegalEntity: CustomerLegalEntity;
  workspaceLegalEntities: CustomerLegalEntity[];
  workspacePrimaryCounterpartyId: string | null;
};

type CustomerLegalEntitySection = "organization" | "requisites" | "documents";

function formatRelationshipKind(value: "customer_owned" | "external"): string {
  return value === "customer_owned" ? "Клиент" : "Внешнее юр. лицо";
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
    return <File className="h-5 w-5" />;
  }

  return <Paperclip className="h-5 w-5" />;
}

export function CustomerLegalEntityPanel({
  contractLang,
  deletingDocumentId,
  documents,
  downloadingContract,
  form,
  loadingDocuments,
  onContractLangChange,
  onDeleteDocument,
  onDownloadContract,
  onDownloadDocument,
  onEntityChange,
  onRequisitesDirtyChange,
  onSave,
  onUploadDocument,
  requisitesResetSignal,
  saving,
  selectedLegalEntity,
  workspaceLegalEntities,
  workspacePrimaryCounterpartyId,
}: CustomerLegalEntityPanelProps) {
  const isPrimary = isPrimaryLegalEntity(
    {
      legalEntities: workspaceLegalEntities,
      primaryCounterpartyId: workspacePrimaryCounterpartyId,
    },
    selectedLegalEntity.counterpartyId,
  );
  const [activeSection, setActiveSection] =
    useState<CustomerLegalEntitySection>("organization");
  const isOrganizationDirty = form.formState.isDirty;

  return (
    <div className="space-y-4">
      <Tabs
        value={activeSection}
        onValueChange={(value) => {
          if (
            value === "organization" ||
            value === "requisites" ||
            value === "documents"
          ) {
            setActiveSection(value);
          }
        }}
        className="w-full"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CustomerLegalEntitySelect
            activeCounterpartyId={selectedLegalEntity.counterpartyId}
            legalEntities={workspaceLegalEntities}
            onValueChange={onEntityChange}
            workspace={{
              legalEntities: workspaceLegalEntities,
              primaryCounterpartyId: workspacePrimaryCounterpartyId,
            }}
          />
          <TabsList className="gap-2">
            <TabsTrigger value="organization">
              <Building2 className="h-4 w-4" />
              Организация
            </TabsTrigger>
            <TabsTrigger value="requisites">
              <Wallet className="h-4 w-4" />
              Реквизиты
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4" />
              Документы
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      <div
        hidden={activeSection !== "organization"}
        aria-hidden={activeSection !== "organization"}
        className="space-y-4"
      >
        <form
          id="customer-legal-entity-form"
          className="space-y-4"
          onSubmit={form.handleSubmit(onSave)}
        >
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">Данные юр. лица</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Управление данными юридического лица
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isOrganizationDirty ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="submit"
                        form="customer-legal-entity-form"
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Сохранить
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          form.reset(
                            legalEntityToFormValues(selectedLegalEntity),
                          )
                        }
                      >
                        <X className="size-4" />
                        Отменить
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span>
                      {selectedLegalEntity.inn
                        ? `ИНН: ${selectedLegalEntity.inn}`
                        : "ИНН не указан"}
                    </span>
                    <span>
                      {formatRelationshipKind(
                        selectedLegalEntity.relationshipKind,
                      )}
                    </span>
                    {isPrimary ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        Основное
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                disabled={saving}
                form={form}
                label="Название юр. лица"
                name="orgName"
                required
              />
              <Field
                disabled={saving}
                form={form}
                label="Тип организации"
                name="orgType"
              />
              <Field disabled={saving} form={form} label="ИНН" name="inn" />
              <Field disabled={saving} form={form} label="КПП" name="kpp" />
              <Field disabled={saving} form={form} label="ОГРН" name="ogrn" />
              <Field disabled={saving} form={form} label="ОКПО" name="okpo" />
              <Field disabled={saving} form={form} label="ОКТМО" name="oktmo" />
              <Field
                disabled={saving}
                form={form}
                label="Email"
                name="email"
                type="email"
              />
              <Field
                disabled={saving}
                form={form}
                label="Телефон"
                name="phone"
              />
              <Field
                disabled={saving}
                form={form}
                label="Директор"
                name="directorName"
              />
              <Field
                disabled={saving}
                form={form}
                label="Должность"
                name="position"
              />
              <Field
                disabled={saving}
                form={form}
                label="Основание полномочий"
                name="directorBasis"
              />
              <Field
                disabled={saving}
                form={form}
                label="Адрес"
                name="address"
              />
            </CardContent>
          </Card>
        </form>

        {selectedLegalEntity.subAgent ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Субагент</CardTitle>
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
              <CardTitle className="text-base">Субагент</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Субагент не назначен.
            </CardContent>
          </Card>
        )}

      </div>

      <div
        hidden={activeSection !== "requisites"}
        aria-hidden={activeSection !== "requisites"}
      >
        <CounterpartyBankRequisitesWorkspace
          counterpartyId={selectedLegalEntity.counterpartyId}
          legalEntityName={selectedLegalEntity.orgName}
          onDirtyChange={onRequisitesDirtyChange}
          resetSignal={requisitesResetSignal}
        />
      </div>

      <div
        hidden={activeSection !== "documents"}
        aria-hidden={activeSection !== "documents"}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <File className="h-4 w-4" />
                Документы
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={contractLang}
                  onValueChange={(value) =>
                    onContractLangChange((value as "ru" | "en") ?? "ru")
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
                  size="sm"
                  disabled={downloadingContract}
                  onClick={() => onDownloadContract("docx")}
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
                  disabled={downloadingContract}
                  onClick={() => onDownloadContract("pdf")}
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
                  onClick={onUploadDocument}
                  type="button"
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Загрузить документ
                </Button>
              </div>
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
                          {new Date(document.createdAt).toLocaleString("ru-RU")}
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
                        onClick={() => onDownloadDocument(document)}
                        type="button"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingDocumentId === document.id}
                        onClick={() => onDeleteDocument(document.id)}
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
      </div>
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
    (form.formState.errors[name] as { message?: string } | undefined)
      ?.message ?? null;
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

function CountryField<TFieldValues extends FieldValues>({
  disabled,
  form,
  label,
  name,
}: {
  disabled: boolean;
  form: UseFormReturn<TFieldValues>;
  label: string;
  name: Path<TFieldValues>;
}) {
  const value = (form.watch(name) as unknown as string | undefined) ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <CountrySelect
        id={name}
        value={value}
        onValueChange={(nextValue) =>
          form.setValue(name, nextValue as TFieldValues[typeof name], {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        disabled={disabled}
        placeholder="Не выбрано"
        searchPlaceholder="Поиск страны..."
        emptyLabel="Страна не найдена"
        clearable
        clearLabel="Очистить"
      />
    </div>
  );
}

export { CountryField, Field };
