"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Button } from "@bedrock/sdk-ui/components/button";
import { API_BASE_URL } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { ClientCombobox } from "./ClientCombobox";
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

interface NewApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewApplicationDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewApplicationDialogProps) {
  const router = useRouter();
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<
    string | undefined
  >(
    undefined
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  // Проверка, заполнена ли форма
  const isFormDirty = () => {
    return selectedCounterpartyId !== undefined;
  };

  // Обработка закрытия с предупреждением
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isFormDirty() && !creating) {
      setPendingClose(true);
      setShowCloseConfirm(true);
      return;
    }
    onOpenChange(newOpen);
    // Сброс состояния при закрытии
    if (!newOpen) {
      setSelectedCounterpartyId(undefined);
      setError(null);
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    setPendingClose(false);
    onOpenChange(false);
    setSelectedCounterpartyId(undefined);
    setError(null);
  };

  const handleCreate = async () => {
    if (!selectedCounterpartyId) {
      setError("Пожалуйста, выберите юридическое лицо");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ counterpartyId: selectedCounterpartyId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка создания заявки");
      }

      const data = await res.json();
      const applicationId = data.id;

      // Успешное создание - переходим на страницу заявки
      onOpenChange(false);
      if (onSuccess) onSuccess();

      // Переход на страницу просмотра заявки
      router.push(`/applications/${applicationId}`);

      // Сброс формы
      setSelectedCounterpartyId(undefined);
    } catch (err) {
      console.error("Create application error:", err);
      setError(err instanceof Error ? err.message : "Ошибка создания заявки");
    } finally {
      setCreating(false);
    }
  };

  const canCreate = () => {
    return selectedCounterpartyId !== undefined && !creating;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]" showCloseButton={!creating}>
          <DialogHeader>
            <DialogTitle>Новая заявка</DialogTitle>
            <DialogDescription>
              Выберите юридическое лицо для создания новой заявки.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full min-w-0 py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Юридическое лицо <span className="text-red-500">*</span>
              </label>
              <ClientCombobox
                value={selectedCounterpartyId}
                onValueChange={(value) =>
                  setSelectedCounterpartyId(
                    typeof value === "string" ? value : undefined,
                  )
                }
                placeholder="Выберите юридическое лицо..."
                className="w-full"
                valueField="counterpartyId"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Выберите юридическое лицо из списка или начните вводить
                название организации
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate()}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать заявку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения закрытия */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть форму?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите закрыть форму? Выбранный клиент не будет
              сохранён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить редактирование</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>
              Закрыть форму
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
