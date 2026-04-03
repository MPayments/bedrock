"use client";

import { Fragment, useState } from "react";
import { Stone, X } from "lucide-react";

import { SidebarMenuButton } from "@bedrock/sdk-ui/components/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@bedrock/sdk-ui/components/avatar";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Separator } from "@bedrock/sdk-ui/components/separator";

type Notification = {
  id: number;
  type: "user" | "system";
  title: string;
  avatar?: string;
  initials: string;
  description: string;
  time: string;
};

const initialNotifications: Notification[] = [
  {
    id: 1,
    type: "user",
    title: "Иван Петров",
    avatar: "/avatars/ivan.jpg",
    initials: "ИП",
    description: "Создал новый платежный ордер #1042",
    time: "2 мин назад",
  },
  {
    id: 2,
    type: "user",
    title: "Мария Сидорова",
    avatar: "/avatars/maria.jpg",
    initials: "МС",
    description: "Обновила курс USD/RUB",
    time: "15 мин назад",
  },
  {
    id: 3,
    type: "user",
    title: "Алексей Козлов",
    avatar: "/avatars/alexey.jpg",
    initials: "АК",
    description: "Подтвердил перевод на сумму ₽250,000",
    time: "1 ч назад",
  },
  {
    id: 4,
    type: "system",
    title: "Система",
    initials: "С",
    description: "Резервное копирование завершено успешно",
    time: "3 ч назад",
  },
];

export function NavNotifications({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);

  function dismiss(id: number) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <Popover>
      <PopoverTrigger render={<SidebarMenuButton tooltip={title} />}>
        <span className="relative">
          <Icon />
          {notifications.length > 0 && (
            <span className="bg-destructive text-primary-foreground absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium leading-none">
              {notifications.length}
            </span>
          )}
        </span>
        <span>{title}</span>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-medium">Уведомления</span>
          {notifications.length > 0 && (
            <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[11px]">
              {notifications.length} Новых
            </Badge>
          )}
        </div>
        <Separator />
        {notifications.length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">
            Нет уведомлений
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification, index) => (
              <Fragment key={notification.id}>
                <div className="hover:bg-accent focus-visible:bg-accent group/notification relative flex cursor-default items-start gap-2.5 px-3 py-2.5 text-sm outline-none transition-colors">
                  {notification.type === "system" ? (
                    <div className="mt-0.5 size-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Stone className="size-4" />
                    </div>
                  ) : (
                    <Avatar className="mt-0.5 size-8 shrink-0 rounded-full">
                      <AvatarImage
                        src={notification.avatar}
                        alt={notification.title}
                      />
                      <AvatarFallback className="rounded-full text-xs">
                        {notification.initials}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium leading-snug">
                        {notification.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismiss(notification.id)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/notification:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm leading-normal">
                      {notification.description}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      {notification.time}
                    </span>
                  </div>
                </div>
                {index < notifications.length - 1 && <Separator />}
              </Fragment>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
