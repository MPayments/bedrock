"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Label } from "@bedrock/sdk-ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { API_BASE_URL } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface RejectApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: number;
  onSuccess: () => void;
}

const REJECT_REASONS = [
  { value: "Не устроил % АВ", label: "Не устроил % АВ" },
  { value: "Отложен", label: "Отложен" },
  { value: "Нет комментариев", label: "Нет комментариев" },
  { value: "Нет возможности провести", label: "Нет возможности провести" },
  { value: "custom", label: "Другая причина" },
];

export function RejectApplicationDialog({
  open,
  onOpenChange,
  applicationId,
  onSuccess,
}: RejectApplicationDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !rejecting) {
      onOpenChange(newOpen);
      // Сброс состояния при закрытии
      setSelectedReason("");
      setCustomReason("");
      setError(null);
    }
  };

  const handleReject = async () => {
    const reason = selectedReason === "custom" ? customReason : selectedReason;

    if (!reason || reason.trim() === "") {
      setError("Пожалуйста, укажите причину отклонения");
      return;
    }

    setRejecting(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/applications/${applicationId}/reject`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка отклонения заявки");
      }

      // Успешно отклонено
      onOpenChange(false);
      onSuccess();
      // Сброс состояния
      setSelectedReason("");
      setCustomReason("");
      setError(null);
    } catch (err) {
      console.error("Reject error:", err);
      setError(
        err instanceof Error ? err.message : "Не удалось отклонить заявку"
      );
    } finally {
      setRejecting(false);
    }
  };

  const canReject = () => {
    if (selectedReason === "custom") {
      return customReason.trim() !== "" && !rejecting;
    }
    return selectedReason !== "" && !rejecting;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[500px]"
          showCloseButton={!rejecting}
        >
          <DialogHeader>
            <DialogTitle>Отклонить заявку</DialogTitle>
            <DialogDescription>
              Выберите причину отклонения заявки или укажите свою.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup
              value={selectedReason}
              onValueChange={setSelectedReason}
            >
              {REJECT_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label
                    htmlFor={reason.value}
                    className="font-normal cursor-pointer"
                  >
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {selectedReason === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Укажите причину</Label>
                <Textarea
                  id="customReason"
                  placeholder="Введите причину отклонения..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  disabled={rejecting}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={rejecting}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              disabled={!canReject()}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Отклонить заявку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
