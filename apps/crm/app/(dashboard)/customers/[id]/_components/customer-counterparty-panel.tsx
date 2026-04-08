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
  Trash2,
  UserRound,
  Wallet,
  Upload as UploadIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
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
  CustomerCounterparty,
} from "../_lib/customer-detail";
import { CounterpartyBankRequisitesWorkspace } from "./counterparty-bank-requisites-workspace";
import { CustomerCounterpartyCreateEditor } from "./customer-counterparty-create-editor";
import { CustomerCounterpartyEditor } from "./customer-counterparty-editor";
import { CustomerCounterpartySelect } from "./customer-counterparty-select";

type CustomerCounterpartyPanelProps = {
  createMode: boolean;
  customerId: string;
  contractLang: "ru" | "en";
  deletingDocumentId: ClientDocument["id"] | null;
  documents: ClientDocument[];
  downloadingContract: boolean;
  counterpartyResetSignal: number;
  loadingDocuments: boolean;
  onContractLangChange: (value: "ru" | "en") => void;
  onDeleteDocument: (documentId: ClientDocument["id"]) => void;
  onDownloadContract: (format: "docx" | "pdf") => void;
  onDownloadDocument: (document: ClientDocument) => void;
  onEntityChange: (counterpartyId: string) => void;
  onCancelCreate: () => void;
  onCreated: (counterpartyId: string) => void;
  onCounterpartyDirtyChange: (dirty: boolean) => void;
  onCounterpartySaved?: () => void;
  onRequisitesDirtyChange: (dirty: boolean) => void;
  onUploadDocument: () => void;
  requisitesResetSignal: number;
  selectedCounterparty: CustomerCounterparty;
  workspaceCounterparties: CustomerCounterparty[];
  workspacePrimaryCounterpartyId: string | null;
};

type CustomerCounterpartySection =
  | "organization"
  | "subagent"
  | "requisites"
  | "documents";

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

export function CustomerCounterpartyPanel({
  createMode,
  customerId,
  contractLang,
  deletingDocumentId,
  documents,
  downloadingContract,
  counterpartyResetSignal,
  loadingDocuments,
  onContractLangChange,
  onDeleteDocument,
  onDownloadContract,
  onDownloadDocument,
  onEntityChange,
  onCancelCreate,
  onCreated,
  onCounterpartyDirtyChange,
  onCounterpartySaved,
  onRequisitesDirtyChange,
  onUploadDocument,
  requisitesResetSignal,
  selectedCounterparty,
  workspaceCounterparties,
  workspacePrimaryCounterpartyId,
}: CustomerCounterpartyPanelProps) {
  const [activeSection, setActiveSection] =
    useState<CustomerCounterpartySection>("organization");

  return (
    <div className="space-y-4">
      <Tabs
        value={activeSection}
        onValueChange={(value) => {
          if (
            value === "organization" ||
            value === "subagent" ||
            value === "requisites" ||
            value === "documents"
          ) {
            setActiveSection(value);
          }
        }}
        className="w-full"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CustomerCounterpartySelect
            activeCounterpartyId={selectedCounterparty.counterpartyId}
            counterparties={workspaceCounterparties}
            onValueChange={onEntityChange}
            workspace={{
              counterparties: workspaceCounterparties,
              primaryCounterpartyId: workspacePrimaryCounterpartyId,
            }}
          />
          <TabsList className="gap-2">
            <TabsTrigger value="organization">
              <Building2 className="h-4 w-4" />
              Контрагент
            </TabsTrigger>
            <TabsTrigger value="subagent">
              <UserRound className="h-4 w-4" />
              Субагент
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
        <div className="space-y-4">
          {createMode ? (
            <CustomerCounterpartyCreateEditor
              customerId={customerId}
              onCancel={onCancelCreate}
              onCreated={onCreated}
              onDirtyChange={onCounterpartyDirtyChange}
            />
          ) : (
            <CustomerCounterpartyEditor
              counterpartyId={selectedCounterparty.counterpartyId}
              onDirtyChange={onCounterpartyDirtyChange}
              onSaved={onCounterpartySaved}
              resetSignal={counterpartyResetSignal}
            />
          )}
        </div>
      </div>

      <div
        hidden={activeSection !== "subagent"}
        aria-hidden={activeSection !== "subagent"}
      >
        {selectedCounterparty.subAgent ? (
          <Card>
            <CardHeader className="border-b">
              <div className="space-y-1">
                <CardTitle className="text-base">Субагент</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Данные субагента, назначенного клиенту
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <InfoRow
                label="Краткое имя"
                value={selectedCounterparty.subAgent.shortName}
              />
              <InfoRow
                label="Полное имя"
                value={selectedCounterparty.subAgent.fullName}
              />
              <InfoRow
                label="Комиссия"
                value={`${selectedCounterparty.subAgent.commissionRate}%`}
              />
              <InfoRow
                label="Тип"
                value={
                  selectedCounterparty.subAgent.kind === "individual"
                    ? "Физическое лицо"
                    : "Юрлицо"
                }
              />
              <InfoRow
                label="Статус"
                value={
                  selectedCounterparty.subAgent.isActive
                    ? "Активен"
                    : "Архивирован"
                }
              />
              <InfoRow
                label="Страна"
                value={selectedCounterparty.subAgent.country ?? "Не указана"}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="border-b">
              <div className="space-y-1">
                <CardTitle className="text-base">Субагент</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Данные субагента, назначенного клиенту
                </p>
              </div>
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
          counterpartyId={selectedCounterparty.counterpartyId}
          counterpartyName={selectedCounterparty.orgName}
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
