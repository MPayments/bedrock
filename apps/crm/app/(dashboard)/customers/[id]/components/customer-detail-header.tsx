"use client";

import { Archive, EllipsisVertical, Loader2, Trash2 } from "lucide-react";
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
import {
  EntityPageHeader,
  getEntityInitials,
} from "@/components/app/entity-page-header";
import { formatDate } from "@/lib/utils/currency";

type CustomerDetailHeaderProps = {
  createdAt: string;
  customerId: string;
  deleting: boolean;
  externalRef: string | null;
  onArchive: () => Promise<void>;
  title: string;
};

export function CustomerDetailHeader({
  createdAt,
  customerId,
  deleting,
  externalRef,
  onArchive,
  title,
}: CustomerDetailHeaderProps) {
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  return (
    <>
      <EntityPageHeader
        avatar={{ initials: getEntityInitials(title) }}
        title={title}
        infoItems={[
          <span key="id" className="font-mono">
            ID {shortenId(customerId)}
          </span>,
          externalRef ? (
            <span key="ext" className="font-mono">
              {externalRef}
            </span>
          ) : null,
          `Создан ${formatDate(createdAt)}`,
        ]}
        actions={
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
        }
      />

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
    </>
  );
}

function shortenId(id: string) {
  if (id.length <= 10) {
    return id;
  }
  return `${id.slice(0, 8)}…`;
}
