"use client";

import { useState } from "react";

import { AlertTriangle, Download, FileText, Loader2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  downloadPrintForm,
  type PrintFormClientOptions,
  type PrintFormOwner,
} from "../lib/client";
import type { PrintFormDescriptor, PrintFormFormat } from "../lib/schemas";

type PrintFormActionsProps = {
  client: PrintFormClientOptions;
  forms: PrintFormDescriptor[];
  owner: PrintFormOwner;
  size?: "default" | "lg" | "sm";
};

export function PrintFormActions({
  client,
  forms,
  owner,
  size = "lg",
}: PrintFormActionsProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (forms.length === 0) {
    return null;
  }

  async function runDownload(form: PrintFormDescriptor, format: PrintFormFormat) {
    const key = `${form.id}:${format}`;
    setActiveKey(key);

    try {
      await downloadPrintForm({
        client,
        form,
        format,
        owner,
      });
      toast.success("Печатная форма выгружена");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось выгрузить печатную форму",
      );
    } finally {
      setActiveKey(null);
    }
  }

  const hasWarnings = forms.some((form) => form.warnings.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasWarnings ? (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Draft
        </Badge>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" size={size} variant="outline" />}>
          {activeKey ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Печатная форма
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {forms.map((form, index) => (
            <div key={form.id}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{form.title}</span>
                  {form.quality === "draft" ? (
                    <Badge variant="warning">Draft</Badge>
                  ) : null}
                </span>
              </DropdownMenuLabel>
              {form.formats.map((format) => {
                const key = `${form.id}:${format}`;
                return (
                  <DropdownMenuItem
                    key={key}
                    disabled={activeKey !== null}
                    onClick={() => void runDownload(form, format)}
                  >
                    {activeKey === key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {format.toUpperCase()}
                  </DropdownMenuItem>
                );
              })}
              {form.warnings.length > 0 ? (
                <DropdownMenuLabel className="whitespace-normal">
                  {form.warnings[0]?.message}
                </DropdownMenuLabel>
              ) : null}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
