"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  FieldSet,
  Field,
  FieldDescription,
  FieldError,
  FieldSeparator,
} from "@bedrock/ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@bedrock/ui/components/select";
import { Checkbox } from "@bedrock/ui/components/checkbox";
import { Input } from "@bedrock/ui/components/input";
import { Textarea } from "@bedrock/ui/components/textarea";
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";

import type { CounterpartyGroupOption } from "../lib/queries";
import { formatDate } from "@/lib/format";

export type CounterpartyGeneralFormValues = {
  shortName: string;
  fullName: string;
  kind: "legal_entity" | "individual";
  country: string;
  externalId: string;
  description: string;
  customerId: string;
  groupIds: string[];
};

type CounterpartyGeneralFormSubmit =
  | Promise<CounterpartyGeneralFormValues | void>
  | CounterpartyGeneralFormValues
  | void;

type CounterpartyGeneralFormProps = {
  initialValues?: Partial<CounterpartyGeneralFormValues>;
  groupOptions: CounterpartyGroupOption[];
  submitting?: boolean;
  error?: string | null;
  onSubmit?: (
    values: CounterpartyGeneralFormValues,
  ) => CounterpartyGeneralFormSubmit;
  onShortNameChange?: (name: string) => void;
};

type CounterpartyGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  usePlaceholderDates: boolean;
};

type CounterpartyGeneralFormBaseProps = CounterpartyGeneralFormProps & {
  variant: CounterpartyGeneralFormVariant;
};

const ROOT_GROUP = "__root__";

const DEFAULT_VALUES: CounterpartyGeneralFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  externalId: "",
  description: "",
  customerId: "",
  groupIds: [],
};

const CounterpartyGeneralFormSchema = z.object({
  shortName: z.string().trim().min(1, "Краткое наименование обязательно"),
  fullName: z.string().trim().min(1, "Полное наименование обязательно"),
  kind: z.enum(["legal_entity", "individual"]),
  country: z.string(),
  externalId: z.string(),
  description: z.string(),
  customerId: z
    .string()
    .refine(
      (value) =>
        value.trim().length === 0 || z.uuid().safeParse(value.trim()).success,
      "Customer ID должен быть UUID",
    ),
  groupIds: z.array(z.uuid()),
});

function resolveInitialValues(
  initialValues?: Partial<CounterpartyGeneralFormValues>,
): CounterpartyGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

const CREATE_GENERAL_FORM_VARIANT: CounterpartyGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  usePlaceholderDates: true,
};

const EDIT_GENERAL_FORM_VARIANT: CounterpartyGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  usePlaceholderDates: false,
};

function CounterpartyGeneralFormBase({
  initialValues,
  groupOptions,
  submitting = false,
  error,
  onSubmit,
  onShortNameChange,
  variant,
}: CounterpartyGeneralFormBaseProps) {
  const initial = useMemo(
    () => resolveInitialValues(initialValues),
    [initialValues],
  );

  const groupById = useMemo(() => {
    return new Map(groupOptions.map((group) => [group.id, group]));
  }, [groupOptions]);

  const rootCodeByGroupId = useMemo(() => {
    const cache = new Map<string, "treasury" | "customers">();

    const resolveRootCode = (
      groupId: string,
    ): "treasury" | "customers" | null => {
      const cached = cache.get(groupId);
      if (cached) {
        return cached;
      }

      const visited = new Set<string>();
      let cursor = groupById.get(groupId);

      while (cursor) {
        if (visited.has(cursor.id)) {
          return null;
        }
        visited.add(cursor.id);

        if (!cursor.parentId) {
          if (cursor.code === "treasury" || cursor.code === "customers") {
            cache.set(groupId, cursor.code);
            return cursor.code;
          }
          return null;
        }

        cursor = groupById.get(cursor.parentId);
      }

      return null;
    };

    for (const group of groupOptions) {
      resolveRootCode(group.id);
    }

    return cache;
  }, [groupById, groupOptions]);

  const groupsByParent = useMemo(() => {
    const map = new Map<string, CounterpartyGroupOption[]>();

    for (const group of groupOptions) {
      const key = group.parentId ?? ROOT_GROUP;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(group);
      } else {
        map.set(key, [group]);
      }
    }

    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name));
    }

    return map;
  }, [groupOptions]);

  const formSchema = useMemo(
    () =>
      CounterpartyGeneralFormSchema.superRefine((values, ctx) => {
        const hasCustomersMembership = values.groupIds.some(
          (groupId) => rootCodeByGroupId.get(groupId) === "customers",
        );

        if (
          hasCustomersMembership &&
          typeof values.customerId === "string" &&
          values.customerId.trim().length === 0
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["customerId"],
            message: "Customer ID обязателен для customers-ветки",
          });
        }
      }),
    [rootCodeByGroupId],
  );

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CounterpartyGeneralFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const selectedGroupIdsValue = useWatch({
    control,
    name: "groupIds",
  });
  const selectedGroupRoots = useMemo(() => {
    const selectedGroupIds = Array.isArray(selectedGroupIdsValue)
      ? selectedGroupIdsValue
      : [];
    const roots = new Set<string>();
    for (const groupId of selectedGroupIds) {
      const rootCode = rootCodeByGroupId.get(groupId);
      if (rootCode) {
        roots.add(rootCode);
      }
    }
    return roots;
  }, [rootCodeByGroupId, selectedGroupIdsValue]);
  const customerIdValue = useWatch({
    control,
    name: "customerId",
  });

  const requiresCustomerId = selectedGroupRoots.has("customers");
  const isTreasuryTree = selectedGroupRoots.has("treasury");
  const showCustomerIdField =
    requiresCustomerId ||
    (typeof customerIdValue === "string" && customerIdValue.trim().length > 0);
  const nowFormatted = formatDate(new Date());

  useEffect(() => {
    reset(initial);
    onShortNameChange?.(initial.shortName);
  }, [initial, onShortNameChange, reset]);

  useEffect(() => {
    if (isTreasuryTree) {
      setValue("customerId", "", {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [isTreasuryTree, setValue]);

  function handleReset() {
    reset(initial);
    onShortNameChange?.(initial.shortName);
  }

  async function handleFormSubmit(values: CounterpartyGeneralFormValues) {
    if (!onSubmit) return;

    const submittedValues = await onSubmit(values);
    if (submittedValues) {
      reset(submittedValues);
      onShortNameChange?.(submittedValues.shortName);
    }
  }

  const submitDisabled =
    submitting || !onSubmit || (variant.disableSubmitUntilDirty && !isDirty);
  const resetDisabled = submitting || !isDirty;

  function renderGroupTree(
    fieldValue: string[],
    onChange: (value: string[]) => void,
    parentId: string,
    depth = 0,
  ): React.ReactNode {
    const children = groupsByParent.get(parentId) ?? [];

    return children.map((group) => {
      const checked = fieldValue.includes(group.id);

      return (
        <div key={group.id} className="space-y-1">
          <div
            className="flex items-start gap-2"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(nextChecked) => {
                const shouldCheck = Boolean(nextChecked);
                const set = new Set(fieldValue);

                if (shouldCheck) {
                  const nextRootCode = rootCodeByGroupId.get(group.id);
                  for (const selectedId of Array.from(set)) {
                    const selectedRootCode = rootCodeByGroupId.get(selectedId);
                    if (
                      selectedRootCode &&
                      nextRootCode &&
                      selectedRootCode !== nextRootCode
                    ) {
                      set.delete(selectedId);
                    }
                  }
                  set.add(group.id);
                } else {
                  set.delete(group.id);
                }

                onChange(Array.from(set));
              }}
            />
            <div className="leading-none">
              <div className="text-sm font-medium">{group.name}</div>
              <div className="text-muted-foreground text-xs">
                {group.code} •{" "}
                {group.customerId
                  ? "customer"
                  : (rootCodeByGroupId.get(group.id) ?? "custom")}
              </div>
            </div>
          </div>
          {renderGroupTree(fieldValue, onChange, group.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
            <CardDescription>
              Просмотр и редактирование общей информации контрагента.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="counterparty-general-form"
              disabled={submitDisabled}
            >
              {submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? variant.submittingLabel : variant.submitLabel}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={resetDisabled}
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="counterparty-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="shortName"
                    control={control}
                    rules={{
                      validate: (value) =>
                        value.trim().length > 0 ||
                        "Краткое наименование обязательно",
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="counterparty-short-name">
                          Краткое наименование
                        </FieldLabel>
                        <Input
                          {...field}
                          id="counterparty-short-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Acme"
                          onChange={(event) => {
                            field.onChange(event);
                            onShortNameChange?.(event.target.value);
                          }}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />{" "}
                  <Controller
                    name="fullName"
                    control={control}
                    rules={{
                      validate: (value) =>
                        value.trim().length > 0 ||
                        "Полное наименование обязательно",
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="counterparty-full-name">
                          Полное наименование
                        </FieldLabel>
                        <Input
                          {...field}
                          id="counterparty-full-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Acme Incorporated"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <Controller
                    name="kind"
                    control={control}
                    rules={{
                      required: "Тип субъекта обязателен",
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="counterparty-kind">
                          Тип субъекта
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="counterparty-kind"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="legal_entity">
                                Юридическое лицо
                              </SelectItem>
                              <SelectItem value="individual">
                                Физическое лицо
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.country)}>
                    <FieldLabel htmlFor="counterparty-country">
                      Страна
                    </FieldLabel>
                    <Input
                      {...register("country")}
                      id="counterparty-country"
                      aria-invalid={Boolean(errors.country)}
                      placeholder="Например: Россия"
                    />
                    <FieldError errors={[errors.country]} />
                  </Field>
                  <Field data-invalid={Boolean(errors.externalId)}>
                    <FieldLabel htmlFor="counterparty-external-id">
                      External ID
                    </FieldLabel>
                    <Input
                      {...register("externalId")}
                      id="counterparty-external-id"
                      aria-invalid={Boolean(errors.externalId)}
                      placeholder="Например: crm-123"
                    />
                    <FieldError errors={[errors.externalId]} />
                  </Field>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="groupIds"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Группы</FieldLabel>
                        <FieldDescription>
                          Контрагент может быть только в одной ветке: treasury
                          или customers.
                        </FieldDescription>
                        <div className="space-y-2 rounded-md border p-3">
                          {groupOptions.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                              Группы не найдены.
                            </p>
                          ) : (
                            renderGroupTree(
                              field.value ?? [],
                              (nextValue) => field.onChange(nextValue),
                              ROOT_GROUP,
                            )
                          )}
                        </div>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.description)}>
                    <FieldLabel htmlFor="counterparty-description">
                      Описание
                    </FieldLabel>
                    <Textarea
                      {...register("description")}
                      id="counterparty-description"
                      aria-invalid={Boolean(errors.description)}
                      placeholder="Дополнительная информация о контрагенте"
                      rows={3}
                    />
                    <FieldError errors={[errors.description]} />
                  </Field>
                </div>
                {showCustomerIdField ? (
                  <Field data-invalid={Boolean(errors.customerId)}>
                    <FieldLabel htmlFor="counterparty-customer-id">
                      Customer ID (UUID)
                    </FieldLabel>
                    <Input
                      {...register("customerId")}
                      id="counterparty-customer-id"
                      aria-invalid={Boolean(errors.customerId)}
                      placeholder="00000000-0000-4000-8000-000000000000"
                      disabled={isTreasuryTree}
                      required={requiresCustomerId}
                    />
                    <FieldDescription>
                      {requiresCustomerId
                        ? "Обязателен при membership в customers-ветке."
                        : "Опционально, если нет customers-membership."}
                    </FieldDescription>
                    <FieldError errors={[errors.customerId]} />
                  </Field>
                ) : null}
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={variant.usePlaceholderDates ? "—" : nowFormatted}
                />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={variant.usePlaceholderDates ? "—" : nowFormatted}
                />
              </Field>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function CounterpartyCreateGeneralForm(
  props: CounterpartyGeneralFormProps,
) {
  return (
    <CounterpartyGeneralFormBase
      variant={CREATE_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}

export function CounterpartyEditGeneralForm(
  props: CounterpartyGeneralFormProps,
) {
  return (
    <CounterpartyGeneralFormBase
      variant={EDIT_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}
