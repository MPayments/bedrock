"use client";

import {
  Archive,
  EllipsisVertical,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";

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

type CustomerDetailHeaderProps = {
  deleting: boolean;
  counterpartyCount: number;
  onArchive: () => Promise<void>;
  title: string;
};

export function CustomerDetailHeader({
  deleting,
  counterpartyCount,
  onArchive,
  title,
}: CustomerDetailHeaderProps) {
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const customerInitials = getCustomerInitials(title);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <div className="bg-background flex h-10 w-10 items-center justify-center rounded-lg">
          <div className="text-foreground text-sm font-medium">
            {customerInitials}
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {counterpartyCount}{" "}
            {counterpartyCount === 1
              ? "контрагент"
              : counterpartyCount < 5
                ? "контрагента"
                : "контрагентов"}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:min-w-0 lg:items-end">
        <div className="flex w-full flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" />}
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setArchiveDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span>Архивировать клиента</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Клиент и связанные записи будут переведены в архив. Основные
              данные сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => {
                void onArchive();
              }}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getCustomerInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/^[^0-9\p{L}]+|[^0-9\p{L}]+$/gu, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return "К";
  }

  if (parts.length === 1) {
    const firstPart = parts[0] ?? "";
    return Array.from(firstPart)
      .slice(0, 2)
      .join("")
      .toLocaleUpperCase("ru-RU");
  }

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase("ru-RU");
}
