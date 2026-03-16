"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import { getCounterpartyGroupDisplayLabel } from "../lib/group-label";
import type { CounterpartyGroupOption } from "../lib/queries";

const CreateCounterpartyGroupFormSchema = z.object({
  name: z.string().trim().min(1, "Название группы обязательно"),
  code: z.string().trim().min(1, "Код группы обязателен"),
  description: z.string(),
  parentId: z.string(),
});

const NO_PARENT_VALUE = "__none__";

type CreateCounterpartyGroupFormValues = z.infer<
  typeof CreateCounterpartyGroupFormSchema
>;

type CreateCounterpartyGroupFormClientProps = {
  initialGroupOptions: CounterpartyGroupOption[];
  initialLoadError?: string | null;
};

export function CreateCounterpartyGroupFormClient({
  initialGroupOptions,
  initialLoadError = null,
}: CreateCounterpartyGroupFormClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);

  const parentOptions = useMemo(() => {
    return [...initialGroupOptions].sort((a, b) =>
      getCounterpartyGroupDisplayLabel(a).localeCompare(
        getCounterpartyGroupDisplayLabel(b),
      ),
    );
  }, [initialGroupOptions]);

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<CreateCounterpartyGroupFormValues>({
    resolver: zodResolver(CreateCounterpartyGroupFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      parentId: NO_PARENT_VALUE,
    },
    mode: "onChange",
    shouldUnregister: false,
  });

  async function onSubmit(values: CreateCounterpartyGroupFormValues) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation({
      request: () =>
        apiClient.v1["counterparty-groups"].$post({
          json: {
            name: values.name.trim(),
            code: values.code.trim(),
            description: values.description.trim() || undefined,
            parentId:
              values.parentId && values.parentId !== NO_PARENT_VALUE
                ? values.parentId
                : undefined,
          },
        }),
      fallbackMessage: "Не удалось создать группу",
      parseData: async () => undefined,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Группа контрагентов создана");
    router.push("/entities/counterparties");
    router.refresh();
  }

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">Параметры группы</CardTitle>
            <CardDescription>
              Укажите название и код новой группы контрагентов.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/entities/counterparties" />}
            >
              <ArrowLeft className="size-4" />
              Назад
            </Button>
            <Button type="submit" form="create-counterparty-group-form" disabled={submitting}>
              {submitting ? <Spinner className="size-4" /> : <Save className="size-4" />}
              {submitting ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="create-counterparty-group-form" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="counterparty-group-name">Название</FieldLabel>
                  <Input
                    {...register("name")}
                    id="counterparty-group-name"
                    aria-invalid={Boolean(errors.name)}
                    placeholder="Например: Поставщики ЕС"
                  />
                  <FieldError errors={[errors.name]} />
                </Field>
                <Field data-invalid={Boolean(errors.code)}>
                  <FieldLabel htmlFor="counterparty-group-code">Код</FieldLabel>
                  <Input
                    {...register("code")}
                    id="counterparty-group-code"
                    aria-invalid={Boolean(errors.code)}
                    placeholder="Например: vendors:eu"
                  />
                  <FieldDescription>
                    Используйте стабильный код для интеграций и фильтров.
                  </FieldDescription>
                  <FieldError errors={[errors.code]} />
                </Field>
                <Controller
                  name="parentId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="counterparty-group-parent">Родительская группа</FieldLabel>
                      <Select
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="counterparty-group-parent"
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        >
                          <SelectValue placeholder="Без родителя" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={NO_PARENT_VALUE}>
                              Без родителя
                            </SelectItem>
                            {parentOptions.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {getCounterpartyGroupDisplayLabel(group)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Можно выбрать любую существующую группу или оставить
                        новую группу на верхнем уровне.
                      </FieldDescription>
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="counterparty-group-description">Описание</FieldLabel>
                  <Textarea
                    {...register("description")}
                    id="counterparty-group-description"
                    aria-invalid={Boolean(errors.description)}
                    placeholder="Опционально"
                  />
                  <FieldError errors={[errors.description]} />
                </Field>
              </FieldGroup>
            </FieldSet>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
