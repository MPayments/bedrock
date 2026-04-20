"use client";

import {
  Archive,
  ChevronDown,
  Loader2,
  Plus,
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
  onAddCounterparty: () => void;
  onArchive: () => Promise<void>;
  title: string;
};

export function CustomerDetailHeader({
  deleting,
  counterpartyCount,
  onAddCounterparty,
  onArchive,
  title,
}: CustomerDetailHeaderProps) {
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {counterpartyCount}{" "}
          {counterpartyCount === 1
            ? "субъект сделки"
            : counterpartyCount < 5
              ? "субъекта сделки"
              : "субъектов сделки"}
        </p>
      </div>

      <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:min-w-0 lg:items-end">
        <div className="flex w-full flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button className="w-full md:w-auto" />}
            >
              Действия
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={onAddCounterparty}>
                <Plus className="h-4 w-4" />
                <span>Добавить субъекта</span>
              </DropdownMenuItem>
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
