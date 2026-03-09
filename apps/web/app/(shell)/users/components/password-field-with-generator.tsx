"use client";

import { useState, useCallback } from "react";
import { Dices, Eye, EyeOff } from "lucide-react";
import type {
  FieldPathByValue,
  FieldValues,
  PathValue,
  UseFormRegisterReturn,
  UseFormSetValue,
} from "react-hook-form";

import { Input } from "@multihansa/ui/components/input";
import { Button } from "@multihansa/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@multihansa/ui/components/tooltip";
import { toast } from "@multihansa/ui/components/sonner";

import { generatePassword } from "@/lib/generate-password";

type PasswordFieldWithGeneratorProps<
  TFieldValues extends FieldValues,
  TFieldName extends FieldPathByValue<TFieldValues, string>,
> = {
  id: string;
  fieldName: TFieldName;
  registration: UseFormRegisterReturn<TFieldName>;
  setValue: UseFormSetValue<TFieldValues>;
  invalid?: boolean;
  placeholder?: string;
};

export function PasswordFieldWithGenerator<
  TFieldValues extends FieldValues,
  TFieldName extends FieldPathByValue<TFieldValues, string>,
>({
  id,
  fieldName,
  registration,
  setValue,
  invalid,
  placeholder = "Минимум 6 символов",
}: PasswordFieldWithGeneratorProps<TFieldValues, TFieldName>) {
  const [visible, setVisible] = useState(false);

  const handleGenerate = useCallback(() => {
    const password = generatePassword();
    setValue(fieldName, password as PathValue<TFieldValues, TFieldName>, {
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
