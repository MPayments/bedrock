"use client";

import { Suspense, useState } from "react";

import { Info, Save, X } from "lucide-react";
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
  FieldSeparator,
  FieldContent,
  FieldTitle,
} from "@bedrock/ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@bedrock/ui/components/select";
import { Input } from "@bedrock/ui/components/input";
import { Switch } from "@bedrock/ui/components/switch";
import { Button } from "@bedrock/ui/components/button";
import { formatDate } from "lib/format";

export default function OrganizationPage() {
  const [isTreasury, setIsTreasury] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);
  
  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
            <CardDescription>
              Просмотр и редактирование общей информации организации
            </CardDescription>
          </div>
          <div>
            <Button type="submit" disabled>
              <Save className="size-4" />
              Сохранить
            </Button>
            <Button variant="outline" type="button" disabled>
              <X className="size-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      {/* <CardHeader>
              <CardTitle>Общая информация</CardTitle>
              <CardDescription>
                Просмотр и редактирование общей информации организации
              </CardDescription>
            </CardHeader> */}
      <CardContent>
        <form>
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="checkout-7j9-card-name-43j">
                    Название
                  </FieldLabel>
                  <Input
                    id="checkout-7j9-card-name-43j"
                    placeholder="Наименование организации"
                    required
                  />
                </Field>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="checkout-7j9-exp-month-ts6">
                      Страна
                    </FieldLabel>
                    <Select defaultValue="">
                      <SelectTrigger id="checkout-7j9-exp-month-ts6">
                        <SelectValue placeholder="Выберите страну" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="RU">Россия</SelectItem>
                          <SelectItem value="KZ">Казахстан</SelectItem>
                          <SelectItem value="UA">ОАЭ</SelectItem>
                          <SelectItem value="BY">Беларусь</SelectItem>
                          <SelectItem value="TR">Турция</SelectItem>
                          <SelectItem value="US">США</SelectItem>
                          <SelectItem value="UK">Великобритания</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Клиент</FieldLabel>
                    <Select disabled={!isCustomer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите клиента" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="1">Клиент 1</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
              <FieldGroup>
                <div className="grid md:grid-cols-2 gap-4">
                  <FieldLabel htmlFor="switch-treasury">
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          {isCustomer
                            ? "Принадлежит клиенту"
                            : "Не принадлежит клиенту"}
                        </FieldTitle>
                        <FieldDescription>
                          Является ли организация составной частью клиента
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="switch-customer"
                        checked={isCustomer}
                        onCheckedChange={setIsCustomer}
                      />
                    </Field>
                  </FieldLabel>
                  <FieldLabel htmlFor="switch-treasury">
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          {isTreasury
                            ? "Принадлежит казначейству"
                            : "Не принадлежит казначейству"}
                        </FieldTitle>
                        <FieldDescription>
                          Является ли организация составной частью казначейства
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="switch-share"
                        checked={isTreasury}
                        onCheckedChange={setIsTreasury}
                      />
                    </Field>
                  </FieldLabel>
                </div>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания </FieldLabel>
                <Input
                  placeholder="Дата "
                  readOnly
                  disabled
                  value={formatDate(new Date())}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="checkout-7j9-card-name-43j">
                  Дата обновления
                </FieldLabel>
                <Input
                  id="checkout-7j9-card-name-43j"
                  placeholder="Дата обновления организации"
                  readOnly
                  disabled
                  value={formatDate(new Date())}
                />
              </Field>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
