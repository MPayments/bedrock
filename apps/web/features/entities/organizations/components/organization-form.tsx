"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import { Spinner } from "@bedrock/ui/components/spinner";
import { Textarea } from "@bedrock/ui/components/textarea";

import { formatDate } from "@/lib/format";

const OrganizationSchema = z.object({
  shortName: z.string().trim().min(1, "Краткое имя обязательно"),
  fullName: z.string().trim().min(1, "Полное имя обязательно"),
  kind: z.enum(["legal_entity", "individual"]),
  country: z.string().trim(),
  externalId: z.string().trim(),
  description: z.string().trim(),
});

export type OrganizationFormValues = z.infer<typeof OrganizationSchema>;

const DEFAULT_VALUES: OrganizationFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  externalId: "",
  description: "",
};

type OrganizationFormProps = {
  initialValues?: Partial<OrganizationFormValues>;
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSubmit?: (
    values: OrganizationFormValues,
  ) => Promise<OrganizationFormValues | void> | OrganizationFormValues | void;
  onDelete?: () => Promise<boolean | void> | boolean | void;
  submitLabel: string;
  submittingLabel: string;
  showDelete?: boolean;
};

export function OrganizationForm({
  initialValues,
  createdAt,
  updatedAt,
  submitting = false,
  deleting = false,
  error,
  onSubmit,
  onDelete,
  submitLabel,
  submittingLabel,
  showDelete = false,
}: OrganizationFormProps) {
  const resolvedInitialValues = useMemo(
    () => ({ ...DEFAULT_VALUES, ...initialValues }),
    [initialValues],
  );
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(OrganizationSchema),
    defaultValues: resolvedInitialValues,
  });

  useEffect(() => {
    form.reset(resolvedInitialValues);
  }, [form, resolvedInitialValues]);

  async function handleSubmit(values: OrganizationFormValues) {
    const normalized = {
      shortName: values.shortName.trim(),
      fullName: values.fullName.trim(),
      kind: values.kind,
      country: values.country.trim().toUpperCase(),
      externalId: values.externalId.trim(),
      description: values.description.trim(),
    };
    const nextValues = await onSubmit?.(normalized);
    form.reset(nextValues ?? normalized);
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }
    if (!window.confirm("Удалить организацию?\n\nДействие необратимо.")) {
      return;
    }
    await onDelete();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Организация</CardTitle>
        <CardDescription>
          {createdAt || updatedAt
            ? `Создано ${createdAt ? formatDate(createdAt) : "—"} · Обновлено ${updatedAt ? formatDate(updatedAt) : "—"}`
            : "Отдельный каталог собственных организаций без treasury/internal-ledger групп."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
        >
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Краткое имя</FieldLabel>
                <Input
                  {...form.register("shortName")}
                  disabled={submitting || deleting}
                />
                <FieldError>{form.formState.errors.shortName?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Полное имя</FieldLabel>
                <Input
                  {...form.register("fullName")}
                  disabled={submitting || deleting}
                />
                <FieldError>{form.formState.errors.fullName?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Тип</FieldLabel>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || deleting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal_entity">Юридическое лицо</SelectItem>
                        <SelectItem value="individual">Физическое лицо</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{form.formState.errors.kind?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Страна</FieldLabel>
                <Input
                  {...form.register("country")}
                  placeholder="AE"
                  disabled={submitting || deleting}
                />
                <FieldDescription>ISO alpha-2 код, опционально.</FieldDescription>
                <FieldError>{form.formState.errors.country?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Внешний ID</FieldLabel>
                <Input
                  {...form.register("externalId")}
                  disabled={submitting || deleting}
                />
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel>Описание</FieldLabel>
                <Textarea
                  {...form.register("description")}
                  rows={4}
                  disabled={submitting || deleting}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex items-center justify-between gap-3">
            <div>
              {showDelete && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDelete()}
                  disabled={submitting || deleting}
                >
                  {deleting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Удалить
                </Button>
              ) : null}
            </div>

            <Button type="submit" disabled={submitting || deleting}>
              {submitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
