"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { API_BASE_URL } from "@/lib/constants";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";

// Компонент для отображения текста с ellipsis и popover для полного текста
function TruncatedText({
  text,
  subText,
  className,
}: {
  text: string;
  subText?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger render={<div className={className} />}>
        <div className="cursor-pointer truncate font-medium" title={text}>
          {text}
        </div>
        {subText && (
          <div
            className="truncate text-sm text-muted-foreground"
            title={subText}
          >
            {subText}
          </div>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" side="top">
        <div className="space-y-1">
          <div className="font-medium break-words">{text}</div>
          {subText && (
            <div className="text-sm text-muted-foreground break-words">
              {subText}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Organization {
  id: number;
  name: string;
  inn?: string;
  city?: string;
}

interface Bank {
  id: number;
  name: string;
  bankName?: string;
  currencyCode?: string;
}

interface ContractFormData {
  agentOrganizationId?: number;
  agentOrganizationBankDetailsId?: number;
  agentFee: string;
  fixedFee: string;
}

interface NewContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  onSuccess?: () => void;
}

type Step = "organization" | "bank" | "fees";

export function NewContractDialog({
  open,
  onOpenChange,
  clientId,
  onSuccess,
}: NewContractDialogProps) {
  const [step, setStep] = useState<Step>("organization");
  const [formData, setFormData] = useState<ContractFormData>({
    agentFee: "",
    fixedFee: "",
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Сброс состояния при открытии
  useEffect(() => {
    if (open) {
      setStep("organization");
      setFormData({
        agentFee: "",
        fixedFee: "",
      });
      setBanks([]);
      setError(null);
      fetchOrganizations();
    }
  }, [open]);

  // Загрузка организаций
  const fetchOrganizations = useCallback(async () => {
    try {
      setLoadingOrganizations(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/organizations`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Ошибка загрузки организаций");
      }

      const raw = await res.json();
      const data: Organization[] = Array.isArray(raw) ? raw : raw.data ?? [];
      setOrganizations(data);
    } catch (err) {
      console.error("Organizations fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить организации"
      );
    } finally {
      setLoadingOrganizations(false);
    }
  }, []);

  // Загрузка банков для выбранной организации
  const fetchBanks = useCallback(async (orgId: number) => {
    try {
      setLoadingBanks(true);
      setError(null);

      const res = await fetch(
        `${API_BASE_URL}/organizations/${orgId}/banks`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("Ошибка загрузки банков");
      }

      const raw = await res.json();
      const data: Bank[] = Array.isArray(raw) ? raw : raw.data ?? [];
      setBanks(data);
    } catch (err) {
      console.error("Banks fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить банки"
      );
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  // Проверка, заполнена ли форма
  const isFormDirty = () => {
    return (
      formData.agentOrganizationId !== undefined ||
      formData.agentOrganizationBankDetailsId !== undefined ||
      formData.agentFee !== "" ||
      formData.fixedFee !== ""
    );
  };

  // Обработка закрытия с предупреждением
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isFormDirty() && !creating) {
      setShowCloseConfirm(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    onOpenChange(false);
    setFormData({
      agentFee: "",
      fixedFee: "",
    });
    setError(null);
  };

  // Переход к следующему шагу
  const handleNextStep = async () => {
    if (step === "organization" && formData.agentOrganizationId) {
      await fetchBanks(formData.agentOrganizationId);
      setStep("bank");
    } else if (step === "bank" && formData.agentOrganizationBankDetailsId) {
      setStep("fees");
    }
  };

  // Возврат к предыдущему шагу
  const handleBack = () => {
    if (step === "bank") {
      setStep("organization");
      setFormData((prev) => ({ ...prev, agentOrganizationBankDetailsId: undefined }));
      setBanks([]);
    } else if (step === "fees") {
      setStep("bank");
    }
  };

  // Создание контракта
  const handleCreate = async () => {
    if (!formData.agentOrganizationId || !formData.agentOrganizationBankDetailsId) {
      setError("Пожалуйста, выберите организацию и банк");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agentOrganizationId: formData.agentOrganizationId,
          agentOrganizationBankDetailsId: formData.agentOrganizationBankDetailsId,
          agentFee: formData.agentFee || undefined,
          fixedFee: formData.fixedFee || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка создания контракта");
      }

      // Успешное создание
      onOpenChange(false);
      if (onSuccess) onSuccess();

      // Сброс формы
      setFormData({
        agentFee: "",
        fixedFee: "",
      });
    } catch (err) {
      console.error("Create contract error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка создания контракта"
      );
    } finally {
      setCreating(false);
    }
  };

  const selectedOrganization = organizations.find(
    (org) => org.id === formData.agentOrganizationId
  );
  const selectedBank = banks.find(
    (bank) => bank.id === formData.agentOrganizationBankDetailsId
  );

  const getStepTitle = () => {
    switch (step) {
      case "organization":
        return "Выберите организацию";
      case "bank":
        return "Выберите банк";
      case "fees":
        return "Условия договора";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "organization":
        return "Выберите организацию-агента для договора";
      case "bank":
        return `Выберите банковские реквизиты для ${selectedOrganization?.name || "организации"}`;
      case "fees":
        return "Укажите комиссии для агентского договора";
    }
  };

  const canProceed = () => {
    switch (step) {
      case "organization":
        return formData.agentOrganizationId !== undefined;
      case "bank":
        return formData.agentOrganizationBankDetailsId !== undefined;
      case "fees":
        return true;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[550px]"
          showCloseButton={!creating && !loadingOrganizations && !loadingBanks}
        >
          <DialogHeader>
            <DialogTitle>{getStepTitle()}</DialogTitle>
            <DialogDescription>{getStepDescription()}</DialogDescription>
          </DialogHeader>

          <div className="py-4 min-h-[300px] min-w-0 overflow-hidden">
            {/* Шаг 1: Выбор организации */}
            {step === "organization" && (
              <>
                {loadingOrganizations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <RadioGroup
                    value={formData.agentOrganizationId?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        agentOrganizationId: parseInt(value),
                        agentOrganizationBankDetailsId: undefined,
                      }))
                    }
                  >
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {organizations.map((org) => {
                        const subText =
                          org.inn || org.city
                            ? [org.inn && `ИНН: ${org.inn}`, org.city]
                                .filter(Boolean)
                                .join(" • ")
                            : undefined;

                        return (
                          <div
                            key={org.id}
                            className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-accent transition-colors"
                          >
                            <RadioGroupItem
                              value={org.id.toString()}
                              id={`org-${org.id}`}
                              className="shrink-0 cursor-pointer"
                            />
                            <Label
                              htmlFor={`org-${org.id}`}
                              className="flex-1 min-w-0 cursor-pointer font-normal"
                            >
                              <TruncatedText
                                text={org.name}
                                subText={subText}
                                className="min-w-0"
                              />
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </RadioGroup>
                )}

                {organizations.length === 0 && !loadingOrganizations && (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет доступных организаций
                  </div>
                )}
              </>
            )}

            {/* Шаг 2: Выбор банка */}
            {step === "bank" && (
              <>
                {loadingBanks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <RadioGroup
                    value={formData.agentOrganizationBankDetailsId?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        agentOrganizationBankDetailsId: parseInt(value),
                      }))
                    }
                  >
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {banks.map((bank) => {
                        const bankName =
                          bank.name || bank.bankName || `Банк #${bank.id}`;
                        const subText = bank.currencyCode
                          ? `Валюта: ${bank.currencyCode}`
                          : undefined;

                        return (
                          <div
                            key={bank.id}
                            className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-accent transition-colors"
                          >
                            <RadioGroupItem
                              value={bank.id.toString()}
                              id={`bank-${bank.id}`}
                              className="shrink-0"
                            />
                            <Label
                              htmlFor={`bank-${bank.id}`}
                              className="flex-1 min-w-0 cursor-pointer font-normal"
                            >
                              <TruncatedText
                                text={bankName}
                                subText={subText}
                                className="min-w-0"
                              />
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </RadioGroup>
                )}

                {banks.length === 0 && !loadingBanks && (
                  <div className="text-center py-8 text-muted-foreground">
                    У организации нет доступных банков
                  </div>
                )}
              </>
            )}

            {/* Шаг 3: Условия договора */}
            {step === "fees" && (
              <div className="space-y-6 min-w-0 overflow-hidden">
                <div className="rounded-lg border p-4 bg-muted/50 space-y-3 overflow-hidden">
                  <div className="min-w-0 overflow-hidden">
                    <div className="text-sm text-muted-foreground mb-1">
                      Организация
                    </div>
                    <div
                      className="font-medium truncate max-w-full"
                      title={selectedOrganization?.name}
                    >
                      {selectedOrganization?.name}
                    </div>
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <div className="text-sm text-muted-foreground mb-1">
                      Банк
                    </div>
                    <div
                      className="font-medium truncate max-w-full"
                      title={selectedBank?.name || selectedBank?.bankName}
                    >
                      {selectedBank?.name || selectedBank?.bankName}
                      {selectedBank?.currencyCode && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({selectedBank.currencyCode})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 min-w-0">
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="agentFee">Агентская комиссия (%)</Label>
                    <Input
                      id="agentFee"
                      value={formData.agentFee}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          agentFee: e.target.value,
                        }))
                      }
                      placeholder="Например: 2%"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Размер агентской комиссии в процентах
                    </p>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="fixedFee">SWIFT комиссия (USD)</Label>
                    <Input
                      id="fixedFee"
                      value={formData.fixedFee}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          fixedFee: e.target.value,
                        }))
                      }
                      placeholder="Например: 100 USD"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Фиксированная комиссия за SWIFT перевод
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <DialogFooter>
            {step !== "organization" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={creating || loadingBanks}
                className="mr-auto"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Назад
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating || loadingOrganizations || loadingBanks}
            >
              Отмена
            </Button>

            {step !== "fees" ? (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={!canProceed() || loadingOrganizations || loadingBanks}
              >
                {loadingBanks && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Далее
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать договор
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения закрытия */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть форму?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите закрыть форму? Все введённые данные будут
              потеряны.
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
