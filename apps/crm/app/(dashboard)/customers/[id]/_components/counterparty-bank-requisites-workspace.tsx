"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Loader2,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bedrock/sdk-ui/components/command";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { API_BASE_URL } from "@/lib/constants";
import { PendingRequisiteSwitchDialog } from "./pending-requisite-switch-dialog";
import {
  bankRequisiteEditorFormSchema,
  bankRequisiteToFormValues,
  createCounterpartyBankRequisitePatch,
  createCounterpartyBankRequisitePayload,
  createEmptyBankRequisiteValues,
  formatBankRequisiteIdentity,
  getBankProviderLabel,
  getCurrencyLabel,
  groupBankRequisitesByCurrency,
  resolveInitialBankRequisiteId,
  type BankRequisiteEditorFormData,
} from "../_lib/counterparty-bank-requisites";
import { useCounterpartyBankRequisites } from "../_lib/use-counterparty-bank-requisites";

type CounterpartyBankRequisitesWorkspaceProps = {
  counterpartyId: string;
  legalEntityName: string;
  onDirtyChange: (dirty: boolean) => void;
  resetSignal: number;
};

type EditorState =
  | { kind: "idle" }
  | { kind: "create" }
  | { kind: "existing"; requisiteId: string };

function ProviderCombobox(props: {
  disabled: boolean;
  onSelect: (providerId: string) => void;
  options: { id: string; label: string }[];
  value: string;
}) {
  const { disabled, onSelect, options, value } = props;
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
          />
        }
      >
        <span className="truncate text-left">
          {selectedOption?.label ?? "Выберите банк"}
        </span>
        <Search className="h-4 w-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command>
          <CommandInput placeholder="Поиск банка..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Банк не найден</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CounterpartyBankRequisitesWorkspace({
  counterpartyId,
  legalEntityName,
  onDirtyChange,
  resetSignal,
}: CounterpartyBankRequisitesWorkspaceProps) {
  const {
    currencyOptions,
    error: loadError,
    loading,
    providerOptions,
    refresh,
    requisites,
  } = useCounterpartyBankRequisites(counterpartyId);
  const [editorState, setEditorState] = useState<EditorState>({ kind: "idle" });
  const [pendingEditorState, setPendingEditorState] =
    useState<EditorState | null>(null);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const legalEntityNameRef = useRef(legalEntityName);

  const form = useForm<BankRequisiteEditorFormData>({
    defaultValues: createEmptyBankRequisiteValues(legalEntityName),
    resolver: zodResolver(bankRequisiteEditorFormSchema),
  });

  const groupedRequisites = useMemo(
    () => groupBankRequisitesByCurrency(requisites),
    [requisites],
  );
  const selectedRequisiteId =
    editorState.kind === "existing" ? editorState.requisiteId : null;
  const selectedRequisite =
    editorState.kind === "existing"
      ? (requisites.find((requisite) => requisite.id === selectedRequisiteId) ??
        null)
      : null;
  const selectedCurrencyLabel =
    currencyOptions.find((option) => option.id === form.watch("currencyId"))
      ?.label ?? undefined;
  const currentProviderLabel = selectedRequisite
    ? getBankProviderLabel(selectedRequisite, providerOptions)
    : (providerOptions.find((option) => option.id === form.watch("providerId"))
        ?.label ?? "Банк не выбран");
  const isEditorBusy = saving || archiving || settingDefault;
  const hasUnsavedEditorState =
    editorState.kind === "create" || form.formState.isDirty;
  const showEditorSaveActions = hasUnsavedEditorState;

  useEffect(() => {
    onDirtyChange(hasUnsavedEditorState);
  }, [hasUnsavedEditorState, onDirtyChange]);

  useEffect(() => {
    legalEntityNameRef.current = legalEntityName;
  }, [legalEntityName]);

  useEffect(() => {
    setEditorState({ kind: "idle" });
    setPendingEditorState(null);
    setSwitchDialogOpen(false);
    setMutationError(null);
    form.reset(createEmptyBankRequisiteValues(legalEntityNameRef.current));
  }, [counterpartyId, form, resetSignal]);

  useEffect(() => {
    if (editorState.kind === "create") {
      return;
    }

    const nextId = resolveInitialBankRequisiteId(
      requisites,
      selectedRequisiteId,
    );

    if (!nextId) {
      setEditorState({ kind: "idle" });
      return;
    }

    if (editorState.kind === "existing" && selectedRequisiteId === nextId) {
      return;
    }

    setEditorState({ kind: "existing", requisiteId: nextId });
  }, [editorState.kind, requisites, selectedRequisiteId]);

  useEffect(() => {
    if (editorState.kind === "create") {
      form.reset(createEmptyBankRequisiteValues(legalEntityNameRef.current));
      setMutationError(null);
      return;
    }

    if (editorState.kind === "existing") {
      form.reset(
        bankRequisiteToFormValues(
          selectedRequisite,
          legalEntityNameRef.current,
        ),
      );
      setMutationError(null);
      return;
    }

    form.reset(createEmptyBankRequisiteValues(legalEntityNameRef.current));
    setMutationError(null);
  }, [editorState, form, selectedRequisite]);

  function applyEditorState(nextState: EditorState) {
    setEditorState(nextState);
    setPendingEditorState(null);
    setSwitchDialogOpen(false);
  }

  function isSameEditorState(nextState: EditorState) {
    if (editorState.kind !== nextState.kind) {
      return false;
    }

    if (editorState.kind !== "existing" || nextState.kind !== "existing") {
      return true;
    }

    return editorState.requisiteId === nextState.requisiteId;
  }

  function requestEditorState(nextState: EditorState) {
    if (isSameEditorState(nextState)) {
      return;
    }

    if (hasUnsavedEditorState) {
      setPendingEditorState(nextState);
      setSwitchDialogOpen(true);
      return;
    }

    applyEditorState(nextState);
  }

  function handleResetEditor() {
    setMutationError(null);

    if (editorState.kind === "create") {
      const nextId = resolveInitialBankRequisiteId(requisites, null);
      applyEditorState(
        nextId ? { kind: "existing", requisiteId: nextId } : { kind: "idle" },
      );
      return;
    }

    form.reset(
      bankRequisiteToFormValues(selectedRequisite, legalEntityNameRef.current),
    );
  }

  async function handleSave(values: BankRequisiteEditorFormData) {
    try {
      setSaving(true);
      setMutationError(null);

      const response = await fetch(
        editorState.kind === "existing"
          ? `${API_BASE_URL}/requisites/${editorState.requisiteId}`
          : `${API_BASE_URL}/requisites`,
        {
          body: JSON.stringify(
            editorState.kind === "existing"
              ? createCounterpartyBankRequisitePatch(values)
              : createCounterpartyBankRequisitePayload({
                  counterpartyId,
                  values,
                }),
          ),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: editorState.kind === "existing" ? "PATCH" : "POST",
        },
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "Не удалось сохранить реквизит" }));
        throw new Error(payload.error ?? "Не удалось сохранить реквизит");
      }

      const saved = (await response.json()) as { id: string };
      const nextRequisites = await refresh();
      const nextId =
        resolveInitialBankRequisiteId(nextRequisites, saved.id) ?? saved.id;
      applyEditorState({ kind: "existing", requisiteId: nextId });
    } catch (saveError) {
      console.error("Failed to save counterparty bank requisite", saveError);
      setMutationError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить реквизит",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (editorState.kind !== "existing") {
      return;
    }

    try {
      setArchiving(true);
      setMutationError(null);

      const response = await fetch(
        `${API_BASE_URL}/requisites/${editorState.requisiteId}`,
        {
          credentials: "include",
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "Не удалось архивировать реквизит" }));
        throw new Error(payload.error ?? "Не удалось архивировать реквизит");
      }

      const nextRequisites = await refresh();
      const nextId = resolveInitialBankRequisiteId(nextRequisites, null);
      applyEditorState(
        nextId ? { kind: "existing", requisiteId: nextId } : { kind: "idle" },
      );
    } catch (archiveError) {
      console.error(
        "Failed to archive counterparty bank requisite",
        archiveError,
      );
      setMutationError(
        archiveError instanceof Error
          ? archiveError.message
          : "Не удалось архивировать реквизит",
      );
    } finally {
      setArchiving(false);
    }
  }

  async function handleMakeDefault() {
    if (editorState.kind !== "existing" || selectedRequisite?.isDefault) {
      return;
    }

    try {
      setSettingDefault(true);
      setMutationError(null);

      const response = await fetch(
        `${API_BASE_URL}/requisites/${editorState.requisiteId}`,
        {
          body: JSON.stringify({ isDefault: true }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "Не удалось обновить основной реквизит" }));
        throw new Error(
          payload.error ?? "Не удалось обновить основной реквизит",
        );
      }

      await refresh();
    } catch (defaultError) {
      console.error(
        "Failed to promote counterparty bank requisite",
        defaultError,
      );
      setMutationError(
        defaultError instanceof Error
          ? defaultError.message
          : "Не удалось обновить основной реквизит",
      );
    } finally {
      setSettingDefault(false);
    }
  }

  const effectiveError = mutationError ?? loadError;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Реквизиты</CardTitle>
            <p className="text-sm text-muted-foreground">
              Управление банковскими реквизитами юридического лица по валютам.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading || isEditorBusy}
            onClick={() => requestEditorState({ kind: "create" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить реквизит
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {effectiveError ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка работы с реквизитами</AlertTitle>
              <AlertDescription>{effectiveError}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : requisites.length === 0 && editorState.kind !== "create" ? (
            <Alert variant="warning">
              <Building2 />
              <AlertTitle>У юрлица пока нет банковских реквизитов</AlertTitle>
              <AlertDescription>
                Создайте первый реквизит, чтобы выбрать счёт и валюту для
                последующей работы с документами и сделками.
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  disabled={loading || isEditorBusy}
                  onClick={() => requestEditorState({ kind: "create" })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить реквизит
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="space-y-4">
                {groupedRequisites.map((group) => (
                  <div key={group.currency.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{group.currency.code}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {group.currency.name}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.requisites.map((requisite) => {
                        const isActive =
                          editorState.kind === "existing" &&
                          editorState.requisiteId === requisite.id;

                        return (
                          <button
                            key={requisite.id}
                            type="button"
                            className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                              isActive
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/40"
                            }`}
                            onClick={() =>
                              requestEditorState({
                                kind: "existing",
                                requisiteId: requisite.id,
                              })
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="truncate font-medium">
                                  {requisite.label}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {getBankProviderLabel(
                                    requisite,
                                    providerOptions,
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatBankRequisiteIdentity(requisite)}
                                </p>
                              </div>
                              {requisite.isDefault ? (
                                <Badge>Основной</Badge>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {editorState.kind === "idle" ? null : (
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {editorState.kind === "create"
                            ? "Новый реквизит"
                            : (selectedRequisite?.label ?? "Реквизит")}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {editorState.kind === "create"
                            ? "Новый банковский реквизит для выбранного юридического лица"
                            : `${currentProviderLabel} · ${getCurrencyLabel(
                                form.watch("currencyId"),
                                currencyOptions,
                              )}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {showEditorSaveActions ? (
                          <>
                            <Button
                              type="submit"
                              form="counterparty-bank-requisite-form"
                              disabled={isEditorBusy}
                            >
                              {saving ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Save className="size-4" />
                              )}
                              Сохранить
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isEditorBusy}
                              onClick={handleResetEditor}
                            >
                              <X className="size-4" />
                              Отменить
                            </Button>
                          </>
                        ) : null}
                        {selectedRequisite?.isDefault ? (
                          <Badge>Основной</Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form
                      id="counterparty-bank-requisite-form"
                      className="space-y-4"
                      onSubmit={form.handleSubmit((values) => {
                        void handleSave(values);
                      })}
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="requisite-label">
                            Название<span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            id="requisite-label"
                            disabled={isEditorBusy}
                            value={form.watch("label")}
                            onChange={(event) =>
                              form.setValue("label", event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          <FieldError
                            message={form.formState.errors.label?.message}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="requisite-currency">
                            Валюта<span className="text-destructive"> *</span>
                          </Label>
                          <Select
                            value={form.watch("currencyId")}
                            onValueChange={(value) => {
                              if (!value) {
                                return;
                              }

                              form.setValue("currencyId", value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            disabled={isEditorBusy}
                          >
                            <SelectTrigger id="requisite-currency">
                              <SelectValue placeholder="Выберите валюту">
                                {selectedCurrencyLabel}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {currencyOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldError
                            message={form.formState.errors.currencyId?.message}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Банк<span className="text-destructive"> *</span>
                        </Label>
                        <ProviderCombobox
                          disabled={isEditorBusy}
                          onSelect={(providerId) =>
                            form.setValue("providerId", providerId, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          options={providerOptions.map((option) => ({
                            id: option.id,
                            label: option.label,
                          }))}
                          value={form.watch("providerId")}
                        />
                        <FieldError
                          message={form.formState.errors.providerId?.message}
                        />
                      </div>

                      {selectedRequisite?.provider ? (
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                          <p className="font-medium">
                            {selectedRequisite.provider.name}
                          </p>
                          <div className="mt-1 space-y-1 text-muted-foreground">
                            {selectedRequisite.provider.country ? (
                              <p>
                                Страна: {selectedRequisite.provider.country}
                              </p>
                            ) : null}
                            {selectedRequisite.provider.address ? (
                              <p>{selectedRequisite.provider.address}</p>
                            ) : null}
                            {selectedRequisite.provider.bic ? (
                              <p>BIC: {selectedRequisite.provider.bic}</p>
                            ) : null}
                            {selectedRequisite.provider.swift ? (
                              <p>SWIFT: {selectedRequisite.provider.swift}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="requisite-beneficiary">
                            Получатель
                            <span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            id="requisite-beneficiary"
                            disabled={isEditorBusy}
                            value={form.watch("beneficiaryName")}
                            onChange={(event) =>
                              form.setValue(
                                "beneficiaryName",
                                event.target.value,
                                {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                },
                              )
                            }
                          />
                          <FieldError
                            message={
                              form.formState.errors.beneficiaryName?.message
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="requisite-account">
                            Номер счёта
                            <span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            id="requisite-account"
                            disabled={isEditorBusy}
                            value={form.watch("accountNo")}
                            onChange={(event) =>
                              form.setValue("accountNo", event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          <FieldError
                            message={form.formState.errors.accountNo?.message}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="requisite-corr-account">
                            Корреспондентский счёт
                          </Label>
                          <Input
                            id="requisite-corr-account"
                            disabled={isEditorBusy}
                            value={form.watch("corrAccount")}
                            onChange={(event) =>
                              form.setValue("corrAccount", event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          <FieldError
                            message={form.formState.errors.corrAccount?.message}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="requisite-iban">IBAN</Label>
                          <Input
                            id="requisite-iban"
                            disabled={isEditorBusy}
                            value={form.watch("iban")}
                            onChange={(event) =>
                              form.setValue("iban", event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          <FieldError
                            message={form.formState.errors.iban?.message}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="requisite-description">
                            Описание
                          </Label>
                          <Input
                            id="requisite-description"
                            disabled={isEditorBusy}
                            value={form.watch("description")}
                            onChange={(event) =>
                              form.setValue("description", event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="requisite-contact">Контакт</Label>
                          <Input
                            id="requisite-contact"
                            disabled={isEditorBusy}
                            value={form.watch("contact")}
                            onChange={(event) =>
                              form.setValue("contact", event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="requisite-notes">Примечание</Label>
                        <Textarea
                          id="requisite-notes"
                          disabled={isEditorBusy}
                          value={form.watch("notes")}
                          onChange={(event) =>
                            form.setValue("notes", event.target.value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          rows={4}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={form.watch("isDefault")}
                          disabled={isEditorBusy}
                          onCheckedChange={(checked) =>
                            form.setValue("isDefault", Boolean(checked), {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                        <Label className="cursor-pointer">
                          Основной реквизит для этой валюты
                        </Label>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {editorState.kind === "existing" &&
                        !selectedRequisite?.isDefault ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isEditorBusy}
                            onClick={() => {
                              void handleMakeDefault();
                            }}
                          >
                            {settingDefault ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Star className="mr-2 h-4 w-4" />
                            )}
                            Сделать основным
                          </Button>
                        ) : null}

                        {editorState.kind === "existing" ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isEditorBusy}
                            onClick={() => {
                              void handleArchive();
                            }}
                          >
                            {archiving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Архивировать
                          </Button>
                        ) : null}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PendingRequisiteSwitchDialog
        open={switchDialogOpen}
        onOpenChange={(open) => {
          setSwitchDialogOpen(open);
          if (!open) {
            setPendingEditorState(null);
          }
        }}
        onConfirm={() => {
          if (pendingEditorState) {
            applyEditorState(pendingEditorState);
          }
        }}
      />
    </>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
