"use client";

import { useState, useCallback } from "react";
import { Dices, Eye, EyeOff } from "lucide-react";
import type {
  FieldPathByValue,
  FieldPathValue,
  FieldValues,
  UseFormRegisterReturn,
  UseFormSetValue,
} from "react-hook-form";

import { Input } from "@bedrock/ui/components/input";
import { Button } from "@bedrock/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bedrock/ui/components/tooltip";
import { toast } from "@bedrock/ui/components/sonner";

import { generatePassword } from "@/lib/generate-password";

type PasswordFieldWithGeneratorProps<
  TValues extends FieldValues,
  TFieldName extends FieldPathByValue<TValues, string>,
> = {
  id: string;
  fieldName: TFieldName;
  registration: UseFormRegisterReturn<TFieldName>;
  setValue: UseFormSetValue<TValues>;
  invalid?: boolean;
  placeholder?: string;
};

export function PasswordFieldWithGenerator<
  TValues extends FieldValues,
  TFieldName extends FieldPathByValue<TValues, string>,
>({
  id,
  fieldName,
  registration,
  setValue,
  invalid,
  placeholder = "Минимум 6 символов",
}: PasswordFieldWithGeneratorProps<TValues, TFieldName>) {
  const [visible, setVisible] = useState(false);

  const handleGenerate = useCallback(() => {
    const password = generatePassword();
    setValue(fieldName, password as FieldPathValue<TValues, TFieldName>, {
      shouldValidate: true,
    });
    setVisible(true);
    navigator.clipboard.writeText(password).then(
      () => toast.success("Пароль сгенерирован и скопирован"),
      () => toast.success("Пароль сгенерирован"),
    );
  }, [fieldName, setValue]);

  return (
    <div className="relative">
      <Input
        {...registration}
        id={id}
        type={visible ? "text" : "password"}
        aria-invalid={invalid}
        placeholder={placeholder}
        className="pr-18"
      />
      <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setVisible((v) => !v)}
              />
            }
          >
            {visible ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            <span className="sr-only">
              {visible ? "Скрыть пароль" : "Показать пароль"}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {visible ? "Скрыть пароль" : "Показать пароль"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleGenerate}
              />
            }
          >
            <Dices className="size-3.5" />
            <span className="sr-only">Сгенерировать пароль</span>
          </TooltipTrigger>
          <TooltipContent>Сгенерировать пароль</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
